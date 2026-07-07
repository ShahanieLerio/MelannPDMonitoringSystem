const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Client } = require('pg');

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('Usage: node temp_migration/reconcile-affected-extra-payments.cjs <fix-report.json>');
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue';
const JCASHDB_PATH = process.env.JCASHDB_PATH || '\\\\SERVERPC\\LendingV2Melan\\db\\jcashdb.mdb';
const JCASHDB_PASSWORD = process.env.JCASHDB_PASSWORD || 'kim123';

const psQuote = (value) => String(value).replace(/'/g, "''");
const num = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const getReportedMonthForDueDate = (dueDateStr) => {
  const [yearPart, monthPart, dayPart] = String(dueDateStr || '').split('-').map(Number);
  if (!yearPart || !monthPart || !dayPart) return String(dueDateStr || '').slice(0, 7);
  const reported = new Date(Date.UTC(yearPart, monthPart + 1, dayPart));
  return `${reported.getUTCFullYear()}-${String(reported.getUTCMonth() + 1).padStart(2, '0')}`;
};

const runAccessJson = (ids) => new Promise((resolve, reject) => {
  const snapshotPath = path.join('C:\\tmp', `jcashdb-reconcile-${Date.now()}-${Math.random().toString(36).slice(2)}.mdb`);
  const idLiteral = ids.map(id => `'${psQuote(id)}'`).join(',');
  const script = `
$ErrorActionPreference = 'Stop'
$src = '${psQuote(JCASHDB_PATH)}'
$dst = '${psQuote(snapshotPath)}'
Copy-Item -LiteralPath $src -Destination $dst
$conn = New-Object -ComObject ADODB.Connection
$conn.ConnectionString = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=' + $dst + ';Jet OLEDB:Database Password=${psQuote(JCASHDB_PASSWORD)};Mode=Read;'
function RowsToArray($rs) {
  $rows = New-Object System.Collections.ArrayList
  while (-not $rs.EOF) {
    $row = @{}
    for ($i = 0; $i -lt $rs.Fields.Count; $i++) {
      $field = $rs.Fields.Item($i)
      if ($field.Value -is [datetime]) {
        $row[$field.Name] = ([datetime]$field.Value).ToString('yyyy-MM-dd')
      } else {
        $row[$field.Name] = $field.Value
      }
    }
    [void]$rows.Add((New-Object psobject -Property $row))
    [void]$rs.MoveNext()
  }
  return $rows.ToArray()
}
try {
  $conn.Open()
  $loanRows = New-Object System.Collections.ArrayList
  $paymentRows = New-Object System.Collections.ArrayList
  $loanIds = @(${idLiteral})
  for ($offset = 0; $offset -lt $loanIds.Count; $offset += 40) {
    $end = [Math]::Min($offset + 39, $loanIds.Count - 1)
    $chunk = @($loanIds[$offset..$end])
    $ids = ($chunk | ForEach-Object { "$_".Trim() }) -join ','
    if ($ids.Trim() -ne '') {
      foreach ($row in RowsToArray($conn.Execute("SELECT LoanID, Maturity, DateRelease, TotalPayment, Balance, Status FROM tblLoan WHERE [LoanID] IN ($ids)"))) { [void]$loanRows.Add($row) }
      foreach ($row in RowsToArray($conn.Execute("SELECT ID, LoanID, [Date], PaymentsMade, NewBalance, Status FROM tblPayment WHERE [LoanID] IN ($ids)"))) { [void]$paymentRows.Add($row) }
    }
  }
  @{ loans = $loanRows.ToArray(); payments = $paymentRows.ToArray() } | ConvertTo-Json -Depth 8 -Compress
} finally {
  if ($conn.State -eq 1) { $conn.Close() }
  if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
}
`;
  execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { maxBuffer: 1024 * 1024 * 40, timeout: 180000 }, (err, stdout, stderr) => {
    if (err) return reject(new Error(stderr || err.message));
    try {
      resolve(JSON.parse(stdout || '{}'));
    } catch (parseErr) {
      reject(parseErr);
    }
  });
});

async function main() {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const targets = report.affectedLoans.filter(row => !row.skipped);
  const ids = targets.map(row => String(row.sourceLoanId));
  const source = await runAccessJson(ids);
  const sourceLoans = new Map((Array.isArray(source.loans) ? source.loans : [source.loans]).filter(Boolean).map(row => [String(row.LoanID), row]));
  const sourceDates = new Map();
  for (const payment of (Array.isArray(source.payments) ? source.payments : [source.payments]).filter(Boolean)) {
    const loanId = String(payment.LoanID);
    if (!sourceDates.has(loanId)) sourceDates.set(loanId, new Set());
    sourceDates.get(loanId).add(toDateOnly(payment.Date));
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query('BEGIN');
  const reversed = [];
  try {
    for (const target of targets) {
      const sourceLoan = sourceLoans.get(String(target.sourceLoanId));
      const dates = sourceDates.get(String(target.sourceLoanId)) || new Set();
      const activeLocal = await client.query(`SELECT id, date, amount, or_number, remarks FROM payments WHERE loan_id = $1 AND status <> 'REVERSED' ORDER BY date`, [target.localLoanId]);
      for (const payment of activeLocal.rows) {
        if (!dates.has(toDateOnly(payment.date))) {
          await client.query(
            `UPDATE payments SET status = 'REVERSED', remarks = $1 WHERE id = $2`,
            [`${payment.remarks || ''}${payment.remarks ? ' ' : ''}(REVERSED: Not found in jcashdb.mdb during maturity/payment audit)`, payment.id]
          );
          reversed.push({ loanId: target.localLoanId, code: target.code, borrowerName: target.borrowerName, date: payment.date, amount: payment.amount, orNumber: payment.or_number });
        }
      }
      if (sourceLoan) {
        const maturity = toDateOnly(sourceLoan.Maturity);
        const runningBalance = num(sourceLoan.Balance);
        const statusText = String(sourceLoan.Status || '').toUpperCase();
        await client.query(
          `UPDATE loans SET due_date = $1, month_reported = $2, running_balance = $3, amount_collected = $4, status = $5 WHERE id = $6`,
          [maturity, getReportedMonthForDueDate(maturity), runningBalance, num(sourceLoan.TotalPayment), runningBalance <= 0 || statusText.includes('PAID') || statusText.includes('FULL') ? 'Paid' : 'M', target.localLoanId]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
  console.log(JSON.stringify({ reconciledLoans: targets.length, reversedExtraPayments: reversed.length, reversed }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

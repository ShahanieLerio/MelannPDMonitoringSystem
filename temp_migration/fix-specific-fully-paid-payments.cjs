const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Client } = require('pg');

const TARGET_CODES = ['3323', '2822', '3967', '3925', '3668', '3474', '2094', '3613', '3672', '859'];
const APPLY = process.argv.includes('--apply');
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue';
const JCASHDB_PATH = process.env.JCASHDB_PATH || '\\\\SERVERPC\\LendingV2Melan\\db\\jcashdb.mdb';
const JCASHDB_PASSWORD = process.env.JCASHDB_PASSWORD || 'kim123';
const OUT_DIR = __dirname;

const psQuote = (value) => String(value).replace(/'/g, "''");
const norm = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
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

const dateDiffDays = (a, b) => {
  const da = toDateOnly(a);
  const db = toDateOnly(b);
  if (!da || !db) return null;
  return Math.round((Date.parse(`${da}T00:00:00Z`) - Date.parse(`${db}T00:00:00Z`)) / 86400000);
};

const isGoodSourcePayment = (payment) => {
  const status = norm(payment.Status);
  if (status.includes('REVERSE') || status.includes('VOID') || status.includes('CANCEL')) return false;
  return !status || status.includes('GOOD') || status.includes('POST') || status.includes('PAID') || status === 'OK';
};

const getReportedMonthForDueDate = (dueDateStr) => {
  const [yearPart, monthPart, dayPart] = String(dueDateStr || '').split('-').map(Number);
  if (!yearPart || !monthPart || !dayPart) return String(dueDateStr || '').slice(0, 7);
  const reported = new Date(Date.UTC(yearPart, monthPart + 1, dayPart));
  return `${reported.getUTCFullYear()}-${String(reported.getUTCMonth() + 1).padStart(2, '0')}`;
};

const runAccessJson = (bodyScript) => new Promise((resolve, reject) => {
  const snapshotPath = path.join('C:\\tmp', `jcashdb-specific-${Date.now()}-${Math.random().toString(36).slice(2)}.mdb`);
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
${bodyScript}
} finally {
  if ($conn.State -eq 1) { $conn.Close() }
  if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
}
`;
  execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    maxBuffer: 1024 * 1024 * 80,
    timeout: 180000
  }, (err, stdout, stderr) => {
    if (err) return reject(new Error(stderr || err.message));
    try {
      resolve(JSON.parse(stdout || '{}'));
    } catch (parseErr) {
      reject(new Error(`Unable to parse Access JSON: ${parseErr.message}`));
    }
  });
});

const readJcashLoans = async () => {
  const codes = TARGET_CODES.join(',');
  const parsed = await runAccessJson(`
  $loanRows = RowsToArray($conn.Execute("SELECT LoanID, Code, Customer, FirstName, DateRelease, Maturity, Principal, Total, TotalPayment, Balance, Status FROM tblLoan WHERE [Code] IN (${codes})"))
  @{ loans = $loanRows } | ConvertTo-Json -Depth 8 -Compress
`);
  return Array.isArray(parsed.loans) ? parsed.loans : (parsed.loans ? [parsed.loans] : []);
};

const readJcashPayments = async (loanIds) => {
  if (loanIds.length === 0) return [];
  const ids = loanIds.map(id => `'${psQuote(id)}'`).join(',');
  const parsed = await runAccessJson(`
  $paymentRows = New-Object System.Collections.ArrayList
  $loanIds = @(${ids})
  for ($offset = 0; $offset -lt $loanIds.Count; $offset += 40) {
    $end = [Math]::Min($offset + 39, $loanIds.Count - 1)
    $chunk = @($loanIds[$offset..$end])
    $idText = ($chunk | ForEach-Object { "$_".Trim() }) -join ','
    if ($idText.Trim() -ne '') {
      foreach ($row in RowsToArray($conn.Execute("SELECT ID, LoanID, [Date], PaymentsMade, NewBalance, [User], Status FROM tblPayment WHERE [LoanID] IN ($idText)"))) { [void]$paymentRows.Add($row) }
    }
  }
  @{ payments = $paymentRows.ToArray() } | ConvertTo-Json -Depth 8 -Compress
`);
  return Array.isArray(parsed.payments) ? parsed.payments : (parsed.payments ? [parsed.payments] : []);
};

const chooseJcashLoan = (localLoan, sourceLoans) => {
  const candidates = sourceLoans.filter(loan => String(loan.Code || '').trim() === String(localLoan.code || '').trim());
  let best = null;
  for (const source of candidates) {
    const releaseDiff = dateDiffDays(localLoan.date_release, source.DateRelease);
    const maturityDiff = dateDiffDays(localLoan.due_date, source.Maturity);
    const principalDiff = Math.abs(num(localLoan.principal) - num(source.Principal));
    const totalDiff = Math.abs(num(localLoan.total_loan || localLoan.outstanding_balance) - num(source.Total));
    let score = 0;
    if (releaseDiff === 0) score += 120;
    else if (releaseDiff !== null && Math.abs(releaseDiff) <= 1) score += 95;
    else if (releaseDiff !== null && Math.abs(releaseDiff) <= 7) score += 30;
    if (maturityDiff === 0) score += 120;
    else if (maturityDiff !== null && Math.abs(maturityDiff) <= 1) score += 95;
    else if (maturityDiff !== null && Math.abs(maturityDiff) <= 7) score += 30;
    if (principalDiff <= 0.01) score += 35;
    if (totalDiff <= 0.01) score += 20;
    if (norm(localLoan.last_name) === norm(source.Customer)) score += 15;
    if (norm(localLoan.first_name) === norm(source.FirstName)) score += 15;
    if (!best || score > best.score) best = { source, score, releaseDiff, maturityDiff };
  }
  return best && best.score >= 190 ? best : null;
};

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const localResult = await client.query(
    `SELECT id, code, first_name, last_name, borrower_name, date_release, due_date, month_reported, principal, total_loan, outstanding_balance, amount_collected, running_balance, status
     FROM loans WHERE code = ANY($1) ORDER BY code, date_release, due_date`,
    [TARGET_CODES]
  );
  const sourceLoans = await readJcashLoans();

  const matches = [];
  const unmatched = [];
  for (const local of localResult.rows) {
    const match = chooseJcashLoan(local, sourceLoans);
    if (match) matches.push({ local, ...match, sourceLoanId: String(match.source.LoanID || '').trim() });
    else unmatched.push({ code: local.code, borrowerName: local.borrower_name, localLoanId: local.id, dateRelease: local.date_release, maturity: local.due_date, reason: 'No confident JCASH loan matched by Code + DateRelease + Maturity.' });
  }

  const sourcePayments = await readJcashPayments([...new Set(matches.map(match => match.sourceLoanId))]);
  const paymentsByLoan = new Map();
  for (const payment of sourcePayments) {
    if (!isGoodSourcePayment(payment)) continue;
    const date = toDateOnly(payment.Date);
    const amount = num(payment.PaymentsMade);
    if (!date || amount <= 0) continue;
    const sourceLoanId = String(payment.LoanID || '').trim();
    if (!paymentsByLoan.has(sourceLoanId)) paymentsByLoan.set(sourceLoanId, []);
    paymentsByLoan.get(sourceLoanId).push({
      sourcePaymentId: String(payment.ID || '').trim(),
      date,
      amount,
      balanceAfter: num(payment.NewBalance),
      recorder: String(payment.User || 'JCASH').trim() || 'JCASH'
    });
  }
  for (const rows of paymentsByLoan.values()) {
    rows.sort((a, b) => a.date.localeCompare(b.date) || num(a.sourcePaymentId) - num(b.sourcePaymentId));
  }

  for (const [loanId, rows] of paymentsByLoan.entries()) {
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.date)) {
        grouped.set(row.date, { ...row, sourcePaymentIds: [row.sourcePaymentId] });
      } else {
        const existing = grouped.get(row.date);
        existing.amount += row.amount;
        existing.balanceAfter = row.balanceAfter;
        existing.recorder = row.recorder;
        existing.sourcePaymentIds.push(row.sourcePaymentId);
        existing.sourcePaymentId = existing.sourcePaymentIds.join('_');
      }
    }
    paymentsByLoan.set(loanId, [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }

  const localPaymentsResult = await client.query(`SELECT id, loan_id, date, amount, balance_after, status FROM payments WHERE loan_id = ANY($1)`, [matches.map(match => match.local.id)]);
  const localPaymentsByLoan = new Map();
  for (const payment of localPaymentsResult.rows) {
    if (!localPaymentsByLoan.has(payment.loan_id)) localPaymentsByLoan.set(payment.loan_id, []);
    localPaymentsByLoan.get(payment.loan_id).push(payment);
  }

  const reportRows = [];
  let inserted = 0;
  let updated = 0;
  let loanUpdated = 0;
  if (APPLY) await client.query('BEGIN');
  try {
    for (const match of matches) {
      const local = match.local;
      const source = match.source;
      const sourceLoanId = match.sourceLoanId;
      const sourceRows = paymentsByLoan.get(sourceLoanId) || [];
      const localRows = (localPaymentsByLoan.get(local.id) || []).filter(payment => payment.status !== 'REVERSED');
      const localByDate = new Map(localRows.map(payment => [toDateOnly(payment.date), payment]));
      const missing = sourceRows.filter(payment => !localByDate.has(payment.date));
      const differing = sourceRows.filter(payment => {
        const existing = localByDate.get(payment.date);
        return existing && (Math.abs(num(existing.amount) - payment.amount) > 0.01 || Math.abs(num(existing.balance_after) - payment.balanceAfter) > 0.01);
      });
      const sourceBalance = num(source.Balance);
      const sourcePaid = sourceBalance <= 0 || norm(source.Status).includes('PAID') || norm(source.Status).includes('FULL');
      const sourceMaturity = toDateOnly(source.Maturity);
      const sourceRelease = toDateOnly(source.DateRelease);

      if (APPLY) {
        for (const payment of sourceRows) {
          const result = await client.query(`
            INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, remarks, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Migrated from jcashdb.mdb', 'GOOD', CURRENT_TIMESTAMP)
            ON CONFLICT (loan_id, date) DO UPDATE SET
              amount = EXCLUDED.amount,
              or_number = EXCLUDED.or_number,
              balance_after = EXCLUDED.balance_after,
              recorder = EXCLUDED.recorder,
              remarks = EXCLUDED.remarks,
              status = 'GOOD'
            WHERE payments.status <> 'REVERSED'
            RETURNING (xmax = 0) AS inserted
          `, [
            `jcash-payment-${payment.sourcePaymentId}-L${sourceLoanId}`,
            local.id,
            payment.amount,
            `JCASH-${payment.sourcePaymentId}-L${sourceLoanId}`,
            payment.date,
            payment.balanceAfter,
            payment.recorder
          ]);
          if (result.rows[0]?.inserted) inserted++;
          else updated++;
        }

        await client.query(
          `UPDATE loans
           SET date_release = $1,
               due_date = $2,
               month_reported = $3,
               amount_collected = $4,
               running_balance = $5,
               status = $6
           WHERE id = $7`,
          [
            sourceRelease || local.date_release,
            sourceMaturity || local.due_date,
            getReportedMonthForDueDate(sourceMaturity || local.due_date),
            num(source.TotalPayment),
            sourceBalance,
            sourcePaid ? 'Paid' : 'M',
            local.id
          ]
        );
        loanUpdated++;
      } else {
        inserted += missing.length;
        updated += differing.length;
        loanUpdated++;
      }

      reportRows.push({
        code: local.code,
        borrowerName: local.borrower_name,
        localLoanId: local.id,
        sourceLoanId,
        localDateRelease: toDateOnly(local.date_release),
        jcashDateRelease: sourceRelease,
        releaseDiffDays: match.releaseDiff,
        localMaturity: toDateOnly(local.due_date),
        jcashMaturity: sourceMaturity,
        maturityDiffDays: match.maturityDiff,
        localStatusBefore: local.status,
        jcashStatus: source.Status,
        localRunningBefore: num(local.running_balance),
        jcashRunningBalance: sourceBalance,
        localPaymentCountBefore: localRows.length,
        jcashPaymentCount: sourceRows.length,
        missingPaymentCount: missing.length,
        sameDatePaymentDiffCount: differing.length,
        jcashPaymentTotal: sourceRows.reduce((sum, payment) => sum + payment.amount, 0),
        jcashTotalPaymentField: num(source.TotalPayment)
      });
    }
    if (APPLY) await client.query('COMMIT');
  } catch (err) {
    if (APPLY) await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(OUT_DIR, `specific-fully-paid-${APPLY ? 'fix' : 'audit'}-${stamp}.json`);
  const csvPath = path.join(OUT_DIR, `specific-fully-paid-${APPLY ? 'fix' : 'audit'}-${stamp}.csv`);
  fs.writeFileSync(jsonPath, JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', targetCodes: TARGET_CODES, summary: { matched: matches.length, unmatched: unmatched.length, inserted, updated, loanUpdated }, affectedLoans: reportRows, unmatched }, null, 2));
  const columns = ['code','borrowerName','localLoanId','sourceLoanId','localDateRelease','jcashDateRelease','releaseDiffDays','localMaturity','jcashMaturity','maturityDiffDays','localStatusBefore','jcashStatus','localRunningBefore','jcashRunningBalance','localPaymentCountBefore','jcashPaymentCount','missingPaymentCount','sameDatePaymentDiffCount','jcashPaymentTotal','jcashTotalPaymentField'];
  fs.writeFileSync(csvPath, [
    columns.join(','),
    ...reportRows.map(row => columns.map(col => `"${String(row[col] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n'));

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    summary: { matched: matches.length, unmatched: unmatched.length, inserted, updated, loanUpdated },
    jsonPath,
    csvPath,
    affectedLoans: reportRows,
    unmatched
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

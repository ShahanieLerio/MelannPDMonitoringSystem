const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue';
const JCASHDB_PATH = process.env.JCASHDB_PATH || '\\\\SERVERPC\\LendingV2Melan\\db\\jcashdb.mdb';
const JCASHDB_PASSWORD = process.env.JCASHDB_PASSWORD || 'kim123';
const RANGE_START = process.env.JCASH_AUDIT_START || '2016-01-01';
const RANGE_END = process.env.JCASH_AUDIT_END || '2026-03-31';
const OUT_DIR = path.join(__dirname);
const MAX_REASONABLE_PAYMENTS_PER_LOAN = 365;

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

const num = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const norm = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();

const sourceStatusOk = (value) => {
  const status = norm(value);
  if (!status) return true;
  if (status.includes('REVERSE') || status.includes('VOID') || status.includes('CANCEL')) return false;
  return status.includes('GOOD') || status.includes('PAID') || status.includes('FULL');
};

const getReportedMonthForDueDate = (dueDateStr) => {
  if (!dueDateStr) return '';
  const [yearPart, monthPart, dayPart] = String(dueDateStr).split('-').map(Number);
  if (!yearPart || !monthPart || !dayPart) return String(dueDateStr).slice(0, 7);
  const reported = new Date(Date.UTC(yearPart, monthPart + 1, dayPart));
  return `${reported.getUTCFullYear()}-${String(reported.getUTCMonth() + 1).padStart(2, '0')}`;
};

const psQuote = (value) => String(value).replace(/'/g, "''");

const runAccessJson = (bodyScript, timeout = 180000) => new Promise((resolve, reject) => {
  const snapshotPath = path.join('C:\\tmp', `jcashdb-maturity-payment-audit-${Date.now()}-${Math.random().toString(36).slice(2)}.mdb`);
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
    maxBuffer: 1024 * 1024 * 120,
    timeout
  }, (err, stdout, stderr) => {
    if (err) return reject(new Error(stderr || err.message));
    try {
      resolve(JSON.parse(stdout || '{}'));
    } catch (parseErr) {
      reject(new Error(`Unable to parse JCASH snapshot JSON: ${parseErr.message}`));
    }
  });
});

const readJcashLoansSnapshot = async () => {
  const parsed = await runAccessJson(`
  $loanSql = "SELECT LoanID, Code, Customer, FirstName, DateRelease, Maturity, Principal, Total, TotalPayment, Balance, Status FROM tblLoan WHERE [Maturity] >= #${RANGE_START}# AND [Maturity] <= #${RANGE_END}#"
  $loanRows = RowsToArray($conn.Execute($loanSql))
  @{ loans = $loanRows } | ConvertTo-Json -Depth 8 -Compress
`, 120000);
  return Array.isArray(parsed.loans) ? parsed.loans : (parsed.loans ? [parsed.loans] : []);
};

const readJcashPaymentsSnapshot = async (loanIds) => {
  if (loanIds.length === 0) return [];
  const idLiteral = loanIds.map(id => `'${psQuote(id)}'`).join(',');
  const parsed = await runAccessJson(`
  $paymentRows = New-Object System.Collections.ArrayList
  $loanIds = @(${idLiteral})
  for ($offset = 0; $offset -lt $loanIds.Count; $offset += 40) {
    $end = [Math]::Min($offset + 39, $loanIds.Count - 1)
    $chunk = @($loanIds[$offset..$end])
    $ids = ($chunk | ForEach-Object { "$_".Trim() }) -join ','
    if ($ids.Trim() -ne '') {
      $paymentSql = "SELECT ID, LoanID, [Date], PaymentsMade, NewBalance, [User], Status FROM tblPayment WHERE [LoanID] IN ($ids)"
      $chunkRows = RowsToArray($conn.Execute($paymentSql))
      foreach ($paymentRow in $chunkRows) { [void]$paymentRows.Add($paymentRow) }
    }
  }
  @{ payments = $paymentRows.ToArray() } | ConvertTo-Json -Depth 8 -Compress
`, 180000);
  return Array.isArray(parsed.payments) ? parsed.payments : (parsed.payments ? [parsed.payments] : []);
};

const chooseLocalLoan = (sourceLoan, candidates) => {
  let best = null;
  for (const local of candidates) {
    const releaseDiff = dateDiffDays(local.date_release, sourceLoan.DateRelease);
    const maturityDiff = dateDiffDays(local.due_date, sourceLoan.Maturity);
    const principalDiff = Math.abs(num(local.principal) - num(sourceLoan.Principal));
    const totalDiff = Math.abs(num(local.total_loan || local.outstanding_balance) - num(sourceLoan.Total));
    let score = 0;
    if (releaseDiff === 0) score += 100;
    else if (releaseDiff !== null && Math.abs(releaseDiff) <= 1) score += 85;
    else if (releaseDiff !== null && Math.abs(releaseDiff) <= 7) score += 35;
    if (maturityDiff === 0) score += 100;
    else if (maturityDiff !== null && Math.abs(maturityDiff) <= 1) score += 95;
    else if (maturityDiff !== null && Math.abs(maturityDiff) <= 7) score += 25;
    if (principalDiff <= 0.01) score += 40;
    if (totalDiff <= 0.01) score += 20;
    if (norm(local.last_name) === norm(sourceLoan.Customer)) score += 20;
    if (norm(local.first_name) === norm(sourceLoan.FirstName)) score += 20;
    if (!best || score > best.score) best = { local, score, releaseDiff, maturityDiff };
  }
  return best && (best.score >= 140 || candidates.length === 1) ? best : null;
};

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const [localLoansResult, localPaymentsResult, sourceLoans] = await Promise.all([
    client.query(`SELECT id, code, first_name, last_name, borrower_name, date_release, due_date, month_reported, principal, total_loan, outstanding_balance, amount_collected, running_balance, status FROM loans`),
    client.query(`SELECT id, loan_id, amount, or_number, date, balance_after, recorder, remarks, status FROM payments`),
    readJcashLoansSnapshot()
  ]);

  const localsByCode = new Map();
  for (const loan of localLoansResult.rows) {
    const key = String(loan.code || '').trim();
    if (!key) continue;
    if (!localsByCode.has(key)) localsByCode.set(key, []);
    localsByCode.get(key).push(loan);
  }

  const localPaymentsByLoan = new Map();
  for (const payment of localPaymentsResult.rows) {
    if (!localPaymentsByLoan.has(payment.loan_id)) localPaymentsByLoan.set(payment.loan_id, []);
    localPaymentsByLoan.get(payment.loan_id).push(payment);
  }

  const matched = [];
  const unmatched = [];
  const usedLocalIds = new Set();

  for (const sourceLoan of sourceLoans.filter(loan => sourceStatusOk(loan.Status))) {
    const sourceLoanId = String(sourceLoan.LoanID || '').trim();
    const code = String(sourceLoan.Code || '').trim();
    const candidates = (localsByCode.get(code) || []).filter(loan => !usedLocalIds.has(loan.id));
    if (candidates.length === 0) {
      unmatched.push({ sourceLoanId, code, name: `${sourceLoan.Customer || ''}, ${sourceLoan.FirstName || ''}`.trim(), reason: 'No local loan with same code.' });
      continue;
    }
    const chosen = chooseLocalLoan(sourceLoan, candidates);
    if (!chosen) {
      unmatched.push({ sourceLoanId, code, name: `${sourceLoan.Customer || ''}, ${sourceLoan.FirstName || ''}`.trim(), reason: 'No confident local match.' });
      continue;
    }
    usedLocalIds.add(chosen.local.id);
    matched.push({ sourceLoan, sourceLoanId, local: chosen.local, score: chosen.score, releaseDiff: chosen.releaseDiff, maturityDiff: chosen.maturityDiff });
  }

  const affectedMatches = matched.filter(match => {
    const maturityDiff = dateDiffDays(match.local.due_date, match.sourceLoan.Maturity);
    const releaseDiff = dateDiffDays(match.local.date_release, match.sourceLoan.DateRelease);
    return (maturityDiff !== null && Math.abs(maturityDiff) <= 1 && maturityDiff !== 0) ||
      (releaseDiff !== null && Math.abs(releaseDiff) <= 1 && releaseDiff !== 0);
  });

  const sourcePayments = await readJcashPaymentsSnapshot(affectedMatches.map(match => match.sourceLoanId));
  const sourcePaymentsByLoan = new Map();
  for (const payment of sourcePayments) {
    if (!sourceStatusOk(payment.Status)) continue;
    const amount = num(payment.PaymentsMade);
    const date = toDateOnly(payment.Date);
    if (!date || amount <= 0) continue;
    const key = String(payment.LoanID || '').trim();
    if (!sourcePaymentsByLoan.has(key)) sourcePaymentsByLoan.set(key, []);
    sourcePaymentsByLoan.get(key).push({
      sourcePaymentId: String(payment.ID || '').trim(),
      sourceLoanId: key,
      date,
      amount,
      balanceAfter: num(payment.NewBalance),
      recorder: String(payment.User || 'JCASH').trim() || 'JCASH',
      status: norm(payment.Status).includes('REVERSE') ? 'REVERSED' : 'GOOD'
    });
  }

  for (const rows of sourcePaymentsByLoan.values()) {
    rows.sort((a, b) => a.date.localeCompare(b.date) || num(a.sourcePaymentId) - num(b.sourcePaymentId));
  }

  const reportRows = [];
  let maturityFixes = 0;
  let releaseFixes = 0;
  let paymentInserted = 0;
  let paymentUpdated = 0;
  let loanStatusFixes = 0;
  let suspiciousPaymentLoans = 0;

  if (APPLY) await client.query('BEGIN');
  try {
    for (const match of affectedMatches) {
      const sourceLoan = match.sourceLoan;
      const local = match.local;
      const sourceLoanId = match.sourceLoanId;
      const sourceMaturity = toDateOnly(sourceLoan.Maturity);
      const sourceRelease = toDateOnly(sourceLoan.DateRelease);
      const localMaturity = toDateOnly(local.due_date);
      const localRelease = toDateOnly(local.date_release);
      const maturityDiff = dateDiffDays(localMaturity, sourceMaturity);
      const releaseDiff = dateDiffDays(localRelease, sourceRelease);
      const sourcePayments = sourcePaymentsByLoan.get(sourceLoanId) || [];
      const localPayments = localPaymentsByLoan.get(local.id) || [];
      if (sourcePayments.length > MAX_REASONABLE_PAYMENTS_PER_LOAN) {
        suspiciousPaymentLoans++;
        reportRows.push({
          localLoanId: local.id,
          sourceLoanId,
          code: local.code,
          borrowerName: local.borrower_name,
          localDateRelease: localRelease,
          jcashDateRelease: sourceRelease,
          releaseDiffDays: releaseDiff,
          localMaturity,
          jcashMaturity: sourceMaturity,
          maturityDiffDays: maturityDiff,
          localPaymentCount: localPayments.filter(p => p.status !== 'REVERSED').length,
          jcashPaymentCount: sourcePayments.length,
          missingPaymentCount: sourcePayments.length,
          sameDatePaymentDiffCount: 0,
          localRunningBalance: num(local.running_balance),
          jcashRunningBalance: num(sourceLoan.Balance),
          localStatus: local.status,
          jcashStatus: sourceLoan.Status,
          skipped: true,
          notes: `Skipped automatic payment migration: ${sourcePayments.length} source payments exceeds ${MAX_REASONABLE_PAYMENTS_PER_LOAN}.`
        });
        continue;
      }
      const localByDate = new Map(localPayments.filter(p => p.status !== 'REVERSED').map(p => [toDateOnly(p.date), p]));
      const missing = sourcePayments.filter(p => !localByDate.has(p.date));
      const differingSameDate = sourcePayments.filter(p => {
        const existing = localByDate.get(p.date);
        return existing && (Math.abs(num(existing.amount) - p.amount) > 0.01 || Math.abs(num(existing.balance_after) - p.balanceAfter) > 0.01);
      });
      const sourceBalance = num(sourceLoan.Balance);
      const sourcePaid = sourceBalance <= 0 || norm(sourceLoan.Status).includes('PAID') || norm(sourceLoan.Status).includes('FULL');
      const statusNeedsFix = Math.abs(num(local.running_balance) - sourceBalance) > 0.01 || (sourcePaid && local.status !== 'Paid');

      const shouldCorrectMaturity = sourceMaturity && localMaturity && localMaturity !== sourceMaturity && maturityDiff !== null && Math.abs(maturityDiff) <= 1;
      const shouldCorrectRelease = sourceRelease && localRelease && localRelease !== sourceRelease && releaseDiff !== null && Math.abs(releaseDiff) <= 1;

      if (APPLY && (shouldCorrectMaturity || shouldCorrectRelease || statusNeedsFix)) {
        const updates = [];
        const params = [];
        let idx = 1;
        if (shouldCorrectMaturity) {
          updates.push(`due_date = $${idx++}`);
          params.push(sourceMaturity);
          updates.push(`month_reported = $${idx++}`);
          params.push(getReportedMonthForDueDate(sourceMaturity));
          maturityFixes++;
        }
        if (shouldCorrectRelease) {
          updates.push(`date_release = $${idx++}`);
          params.push(sourceRelease);
          releaseFixes++;
        }
        if (statusNeedsFix) {
          updates.push(`running_balance = $${idx++}`);
          params.push(sourceBalance);
          updates.push(`status = $${idx++}`);
          params.push(sourcePaid ? 'Paid' : 'M');
          if (Number.isFinite(num(sourceLoan.TotalPayment))) {
            updates.push(`amount_collected = $${idx++}`);
            params.push(num(sourceLoan.TotalPayment));
          }
          loanStatusFixes++;
        }
        params.push(local.id);
        await client.query(`UPDATE loans SET ${updates.join(', ')} WHERE id = $${idx}`, params);
      } else {
        if (shouldCorrectMaturity) maturityFixes++;
        if (shouldCorrectRelease) releaseFixes++;
        if (statusNeedsFix) loanStatusFixes++;
      }

      if (APPLY) {
        for (const payment of sourcePayments) {
          const result = await client.query(`
            INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, remarks, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'GOOD', CURRENT_TIMESTAMP)
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
            payment.recorder,
            'Migrated from jcashdb.mdb'
          ]);
          if (result.rows[0]?.inserted) paymentInserted++;
          else paymentUpdated++;
        }
      } else {
        paymentInserted += missing.length;
        paymentUpdated += differingSameDate.length;
      }

      if (shouldCorrectMaturity || shouldCorrectRelease || missing.length || differingSameDate.length || statusNeedsFix) {
        reportRows.push({
          localLoanId: local.id,
          sourceLoanId,
          code: local.code,
          borrowerName: local.borrower_name,
          localDateRelease: localRelease,
          jcashDateRelease: sourceRelease,
          releaseDiffDays: releaseDiff,
          localMaturity,
          jcashMaturity: sourceMaturity,
          maturityDiffDays: maturityDiff,
          localPaymentCount: localPayments.filter(p => p.status !== 'REVERSED').length,
          jcashPaymentCount: sourcePayments.length,
          missingPaymentCount: missing.length,
          sameDatePaymentDiffCount: differingSameDate.length,
          localRunningBalance: num(local.running_balance),
          jcashRunningBalance: sourceBalance,
          localStatus: local.status,
          jcashStatus: sourceLoan.Status,
          missingPayments: missing
        });
      }
    }

    if (APPLY) await client.query('COMMIT');
  } catch (err) {
    if (APPLY) await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(OUT_DIR, `maturity-payment-shift-${APPLY ? 'fix' : 'audit'}-${stamp}.json`);
  const csvPath = path.join(OUT_DIR, `maturity-payment-shift-${APPLY ? 'fix' : 'audit'}-${stamp}.csv`);
  fs.writeFileSync(jsonPath, JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', rangeStart: RANGE_START, rangeEnd: RANGE_END, matchedCount: matched.length, affectedMatchCount: affectedMatches.length, unmatchedCount: unmatched.length, summary: { maturityFixes, releaseFixes, paymentInserted, paymentUpdated, loanStatusFixes, suspiciousPaymentLoans, affectedLoans: reportRows.length }, affectedLoans: reportRows, unmatched }, null, 2));
  const csvHeader = ['localLoanId','sourceLoanId','code','borrowerName','localDateRelease','jcashDateRelease','releaseDiffDays','localMaturity','jcashMaturity','maturityDiffDays','localPaymentCount','jcashPaymentCount','missingPaymentCount','sameDatePaymentDiffCount','localRunningBalance','jcashRunningBalance','localStatus','jcashStatus','skipped','notes'];
  const csvLines = [csvHeader.join(',')];
  for (const row of reportRows) {
    csvLines.push(csvHeader.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'));

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    matchedCount: matched.length,
    affectedMatchCount: affectedMatches.length,
    unmatchedCount: unmatched.length,
    summary: { maturityFixes, releaseFixes, paymentInserted, paymentUpdated, loanStatusFixes, suspiciousPaymentLoans, affectedLoans: reportRows.length },
    jsonPath,
    csvPath,
    etang: reportRows.find(row => String(row.code) === '3943') || null
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

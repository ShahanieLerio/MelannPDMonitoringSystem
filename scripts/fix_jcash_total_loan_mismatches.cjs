const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const TARGET_CODES = [
  '442', '1415', '1025', '2100', '3011', '3451', '1771', '2588',
  '3202', '3508', '3471', '4013', '3578', '4016', '3132', '2381',
  '2092', '3946', '3699', '3697', '3487', '2702', '3795', '3874'
];

const COMPARISON_PATH = path.join(__dirname, '..', 'output', 'jcash_compare_data.json');
const APPLY = process.argv.includes('--apply');

const toNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDate = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  return raw.slice(0, 10);
};

const loadTargetRows = () => {
  const comparison = JSON.parse(fs.readFileSync(COMPARISON_PATH, 'utf8'));
  const rows = [...(comparison.mismatches || []), ...(comparison.matches || []), ...(comparison.exact || [])];
  const byCode = new Map();

  for (const row of rows) {
    const code = String(row.code || '').trim();
    if (!TARGET_CODES.includes(code)) continue;
    if (!row.loanid || !row.pdfTotal) continue;
    byCode.set(code, {
      code,
      id: String(row.loanid),
      name: row.name,
      correctTotalLoan: toNumber(row.pdfTotal),
      comparisonDbTotal: toNumber(row.dbTotal),
      releaseDate: normalizeDate(row.pdfRelease),
      dueDate: normalizeDate(row.pdfMaturity)
    });
  }

  const missing = TARGET_CODES.filter(code => !byCode.has(code));
  if (missing.length > 0) {
    throw new Error(`Missing comparison rows for codes: ${missing.join(', ')}`);
  }

  return TARGET_CODES.map(code => byCode.get(code));
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env.local');
  }

  const targetRows = loadTargetRows();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const audit = [];
  try {
    await client.query('BEGIN');

    for (const target of targetRows) {
      const result = await client.query(
        `SELECT id, code, borrower_name, date_release, due_date, total_loan,
                amount_collected, running_balance
         FROM loans
         WHERE id = $1 AND code = $2
         FOR UPDATE`,
        [target.id, target.code]
      );

      if (result.rows.length !== 1) {
        throw new Error(`Expected one DB loan for code ${target.code}, id ${target.id}; found ${result.rows.length}`);
      }

      const loan = result.rows[0];
      const currentTotalLoan = toNumber(loan.total_loan);
      const correction = currentTotalLoan - target.correctTotalLoan;

      if (Math.abs(correction) <= 0.01) {
        audit.push({
          code: target.code,
          id: target.id,
          name: loan.borrower_name,
          status: 'already-correct',
          totalLoan: currentTotalLoan
        });
        continue;
      }

      if (correction < 0) {
        throw new Error(`Code ${target.code} DB total (${currentTotalLoan}) is lower than JCASH total (${target.correctTotalLoan}); refusing automatic correction.`);
      }

      const correctedRunningBalance = Math.max(0, toNumber(loan.running_balance) - correction);

      audit.push({
        code: target.code,
        id: target.id,
        name: loan.borrower_name,
        totalLoanBefore: currentTotalLoan,
        totalLoanAfter: target.correctTotalLoan,
        runningBalanceBefore: toNumber(loan.running_balance),
        runningBalanceAfter: correctedRunningBalance,
        correction
      });

      if (APPLY) {
        await client.query(
          `UPDATE loans
           SET total_loan = $1,
               running_balance = $2
           WHERE id = $3`,
          [target.correctTotalLoan, correctedRunningBalance, target.id]
        );

        await client.query(
          `UPDATE payments
           SET balance_after = GREATEST(0, balance_after - $1)
           WHERE loan_id = $2
             AND status <> 'REVERSED'
             AND remarks = 'Migrated from jcashdb.mdb'`,
          [correction, target.id]
        );
      }
    }

    if (APPLY) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  console.table(audit);
  console.log(APPLY ? 'Applied JCASH total loan corrections.' : 'Dry run only. Re-run with --apply to update the database.');
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

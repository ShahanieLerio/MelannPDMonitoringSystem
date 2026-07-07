const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

const toNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env.local');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const audit = [];
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      SELECT l.id, l.code, l.borrower_name, l.total_loan, l.outstanding_balance,
             l.amount_collected, l.running_balance, l.status
      FROM loans l
      WHERE l.branch = 'Ormoc Branch'
        AND COALESCE(l.amount_collected, 0) = 0
        AND COALESCE(l.running_balance, 0) = 0
        AND GREATEST(COALESCE(l.total_loan, 0), COALESCE(l.outstanding_balance, 0)) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM payments p
          WHERE p.loan_id = l.id
            AND p.status <> 'REVERSED'
        )
      ORDER BY NULLIF(REGEXP_REPLACE(l.code, '\\D', '', 'g'), '')::int NULLS LAST,
               l.borrower_name
      FOR UPDATE
    `);

    for (const loan of result.rows) {
      const restoredBalance = Math.max(toNumber(loan.total_loan), toNumber(loan.outstanding_balance));
      audit.push({
        code: loan.code,
        id: loan.id,
        name: loan.borrower_name,
        statusBefore: loan.status,
        statusAfter: 'NMSR',
        runningBalanceBefore: toNumber(loan.running_balance),
        runningBalanceAfter: restoredBalance
      });

      if (APPLY) {
        await client.query(
          `UPDATE loans
           SET running_balance = $1,
               status = 'NMSR'
           WHERE id = $2`,
          [restoredBalance, loan.id]
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
  console.log(`${audit.length} zero-payment JCASH loans ${APPLY ? 'fixed' : 'found'}${APPLY ? '.' : '. Re-run with --apply to update the database.'}`);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

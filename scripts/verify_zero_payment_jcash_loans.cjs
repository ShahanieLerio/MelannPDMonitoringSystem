const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const SAMPLE_CODES = ['415', '599', '2424', '2548'];

const main = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const sample = await client.query(
    `SELECT id, code, borrower_name, total_loan, amount_collected, running_balance, status
     FROM loans
     WHERE code = ANY($1)
     ORDER BY NULLIF(REGEXP_REPLACE(code, '\\D', '', 'g'), '')::int`,
    [SAMPLE_CODES]
  );

  const remaining = await client.query(`
    SELECT COUNT(*)::int AS count
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
  `);

  console.table(sample.rows.map(row => ({
    code: row.code,
    id: row.id,
    name: row.borrower_name,
    totalLoan: Number(row.total_loan),
    remitted: Number(row.amount_collected),
    exposure: Number(row.running_balance),
    status: row.status
  })));
  console.log('remainingZeroPaymentPositiveLoans:', remaining.rows[0].count);

  await client.end();
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

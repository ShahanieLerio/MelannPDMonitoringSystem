const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const loanId = '47009';

const main = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', [loanId]);
    if (loanRes.rowCount === 0) {
      await client.query('ROLLBACK');
      const archived = await client.query(
        'SELECT id, deleted_by, reason, branch, deleted_at FROM deleted_loans WHERE id = $1',
        [loanId]
      );
      console.log(JSON.stringify({ active: [], archived: archived.rows }, null, 2));
      return;
    }

    const loan = loanRes.rows[0];
    await client.query(
      `INSERT INTO deleted_loans (id, original_loan_data, deleted_by, reason, branch)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
          original_loan_data = EXCLUDED.original_loan_data,
          deleted_by = EXCLUDED.deleted_by,
          reason = EXCLUDED.reason,
          branch = EXCLUDED.branch,
          deleted_at = CURRENT_TIMESTAMP`,
      [loan.id, JSON.stringify(loan), 'Admin', 'Deleted via Loan Grid', loan.branch]
    );
    await client.query('DELETE FROM loans WHERE id = $1', [loan.id]);
    await client.query('COMMIT');

    const active = await client.query('SELECT id, code, borrower_name FROM loans WHERE id = $1', [loanId]);
    const archived = await client.query(
      'SELECT id, deleted_by, reason, branch, deleted_at FROM deleted_loans WHERE id = $1',
      [loanId]
    );
    console.log(JSON.stringify({ active: active.rows, archived: archived.rows }, null, 2));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const START = '2016-01-01';
const END = '2026-03-31';
const DEFAULT_REASON = `Removed from active portfolio cleanup: maturity date outside ${START} to ${END}`;

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue';
const apply = process.argv.includes('--apply');

const outputDir = path.join(__dirname, '..', 'temp_migration');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(outputDir, `out-of-range-maturity-cleanup-${stamp}.json`);

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  const counts = await client.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE due_date < $1)::int AS before_start,
        COUNT(*) FILTER (WHERE due_date > $2)::int AS after_end,
        COUNT(*) FILTER (WHERE due_date >= '2026-04-01')::int AS apr_2026_onward,
        COUNT(*) FILTER (WHERE due_date IS NULL OR TRIM(due_date) = '')::int AS missing_due_date
      FROM loans
    `,
    [START, END]
  );

  const affected = await client.query(
    `
      SELECT
        l.*,
        COALESCE(payment_counts.payment_count, 0)::int AS payment_count,
        COALESCE(remark_counts.remark_count, 0)::int AS remark_count,
        COALESCE(activity_counts.activity_count, 0)::int AS activity_count,
        COALESCE(visit_counts.visit_count, 0)::int AS visit_count,
        COALESCE(contact_counts.contact_count, 0)::int AS contact_count,
        COALESCE(demand_counts.demand_count, 0)::int AS demand_letter_count,
        COALESCE(jcash_counts.jcash_payment_count, 0)::int AS jcash_payment_count
      FROM loans l
      LEFT JOIN (
        SELECT loan_id, COUNT(*) AS payment_count FROM payments GROUP BY loan_id
      ) payment_counts ON payment_counts.loan_id = l.id
      LEFT JOIN (
        SELECT loan_id, COUNT(*) AS remark_count FROM remarks GROUP BY loan_id
      ) remark_counts ON remark_counts.loan_id = l.id
      LEFT JOIN (
        SELECT loan_id, COUNT(*) AS activity_count FROM activity_logs GROUP BY loan_id
      ) activity_counts ON activity_counts.loan_id = l.id
      LEFT JOIN (
        SELECT loan_id, COUNT(*) AS visit_count FROM visit_logs GROUP BY loan_id
      ) visit_counts ON visit_counts.loan_id = l.id
      LEFT JOIN (
        SELECT loan_id, COUNT(*) AS contact_count FROM contact_logs GROUP BY loan_id
      ) contact_counts ON contact_counts.loan_id = l.id
      LEFT JOIN (
        SELECT loan_id, COUNT(*) AS demand_count FROM demand_letters GROUP BY loan_id
      ) demand_counts ON demand_counts.loan_id = l.id
      LEFT JOIN (
        SELECT loan_id, COUNT(*) AS jcash_payment_count
        FROM payments
        WHERE remarks = 'Migrated from jcashdb.mdb'
        GROUP BY loan_id
      ) jcash_counts ON jcash_counts.loan_id = l.id
      WHERE l.due_date < $1 OR l.due_date > $2 OR l.due_date IS NULL OR TRIM(l.due_date) = ''
      ORDER BY l.due_date NULLS LAST, l.borrower_name
    `,
    [START, END]
  );

  const backup = {
    generatedAt: new Date().toISOString(),
    activePortfolioRange: { start: START, end: END },
    mode: apply ? 'apply' : 'dry-run',
    counts: counts.rows[0],
    affectedCount: affected.rowCount,
    affectedLoans: affected.rows,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  console.log(`Range kept: ${START} to ${END}`);
  console.log(`Before ${START}: ${counts.rows[0].before_start}`);
  console.log(`After ${END}: ${counts.rows[0].after_end}`);
  console.log(`April 1, 2026 onward: ${counts.rows[0].apr_2026_onward}`);
  console.log(`Missing due date: ${counts.rows[0].missing_due_date}`);
  console.log(`Affected loans selected for cleanup: ${affected.rowCount}`);
  console.log(`Backup written: ${backupPath}`);

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to delete affected loans.');
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    const archiveRows = affected.rows.map((loan) => ({
      id: `cleanup-${loan.id}-${stamp}`,
      originalLoanData: loan,
      branch: loan.branch || 'Naval Branch',
    }));

    for (const row of archiveRows) {
      await client.query(
        `
          INSERT INTO deleted_loans (id, original_loan_data, deleted_by, reason, branch)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `,
        [row.id, row.originalLoanData, 'System Cleanup', DEFAULT_REASON, row.branch]
      );
    }

    const deleted = await client.query(
      `
        DELETE FROM loans
        WHERE due_date < $1 OR due_date > $2 OR due_date IS NULL OR TRIM(due_date) = ''
      `,
      [START, END]
    );

    await client.query('COMMIT');
    console.log(`Deleted loans: ${deleted.rowCount}`);
    console.log(`Archived to recycle bin: ${archiveRows.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

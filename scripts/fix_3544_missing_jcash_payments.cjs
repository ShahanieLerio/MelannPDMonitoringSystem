const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

const loanId = '39550';
const code = '3544';
const payments = [
  { id: '991598', date: '2024-08-19', amount: 250, balanceAfter: 11100, recorder: 'shan' },
  { id: '991599', date: '2024-08-20', amount: 250, balanceAfter: 10850, recorder: 'shan' },
  { id: '991600', date: '2024-08-21', amount: 250, balanceAfter: 10600, recorder: 'shan' },
  { id: '991601', date: '2024-08-23', amount: 500, balanceAfter: 10100, recorder: 'shan' },
  { id: '991602', date: '2024-08-27', amount: 750, balanceAfter: 9350, recorder: 'shan' },
  { id: '991603', date: '2024-08-28', amount: 250, balanceAfter: 9100, recorder: 'shan' },
  { id: '991604', date: '2024-08-29', amount: 250, balanceAfter: 8850, recorder: 'shan' },
  { id: '991605', date: '2024-09-02', amount: 500, balanceAfter: 8350, recorder: 'shan' },
  { id: '991606', date: '2024-09-03', amount: 500, balanceAfter: 7850, recorder: 'shan' },
  { id: '991607', date: '2024-09-04', amount: 250, balanceAfter: 7600, recorder: 'shan' }
];

const main = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const audit = {
    code,
    loanId,
    paymentCount: payments.length,
    totalPayment: payments.reduce((sum, payment) => sum + payment.amount, 0),
    finalBalance: payments[payments.length - 1].balanceAfter
  };

  try {
    await client.query('BEGIN');

    const loan = await client.query(
      `SELECT id, code, borrower_name, total_loan, amount_collected, running_balance, status
       FROM loans
       WHERE id = $1 AND code = $2
       FOR UPDATE`,
      [loanId, code]
    );
    if (loan.rows.length !== 1) {
      throw new Error(`Expected loan ${loanId}/${code}; found ${loan.rows.length}`);
    }

    audit.before = loan.rows[0];

    if (APPLY) {
      for (const payment of payments) {
        await client.query(
          `INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, remarks, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'Migrated from jcashdb.mdb', 'GOOD', $8)
           ON CONFLICT (loan_id, date) DO UPDATE SET
             id = EXCLUDED.id,
             amount = EXCLUDED.amount,
             or_number = EXCLUDED.or_number,
             balance_after = EXCLUDED.balance_after,
             recorder = EXCLUDED.recorder,
             remarks = EXCLUDED.remarks,
             status = EXCLUDED.status,
             created_at = EXCLUDED.created_at`,
          [
            `jcash-payment-${payment.id}`,
            loanId,
            payment.amount,
            `JCASH-${payment.id}`,
            payment.date,
            payment.balanceAfter,
            payment.recorder,
            '2026-06-17T00:00:00.000Z'
          ]
        );
      }

      await client.query(
        `UPDATE loans
         SET amount_collected = $1,
             running_balance = $2,
             status = 'NM'
         WHERE id = $3`,
        [audit.totalPayment, audit.finalBalance, loanId]
      );
    }

    const afterPayments = await client.query(
      `SELECT date, amount, balance_after, or_number, recorder, status
       FROM payments
       WHERE loan_id = $1
       ORDER BY date, id`,
      [loanId]
    );
    audit.paymentRowsAfter = afterPayments.rows.length;

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

  console.log(JSON.stringify(audit, null, 2));
  console.log(APPLY ? 'Applied missing JCASH payments for client 3544.' : 'Dry run only. Re-run with --apply to insert payments.');
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

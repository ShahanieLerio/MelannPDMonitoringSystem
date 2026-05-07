const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();
    console.log('Connected to DB. Fixing all loan statuses...\n');

    const loansRes = await client.query('SELECT id, outstanding_balance FROM loans');
    const loans = loansRes.rows;

    let paidCount = 0;
    let nmsrCount = 0;
    let movingCount = 0;
    let nmCount = 0;

    for (const loan of loans) {
        const payRes = await client.query('SELECT date, amount, status FROM payments WHERE loan_id = $1 AND status != \'REVERSED\' ORDER BY date ASC', [loan.id]);
        const payments = payRes.rows;

        let currentBalance = Number(loan.outstanding_balance || 0);
        for (const p of payments) {
            currentBalance -= Number(p.amount);
        }
        const finalRunning = Math.max(0, currentBalance);

        let newStatus = '';
        if (finalRunning <= 0) {
            newStatus = 'Paid';
            paidCount++;
        } else if (payments.length === 0) {
            newStatus = 'NMSR';
            nmsrCount++;
        } else {
            const latestPayment = payments[payments.length - 1];
            const latestDate = new Date(latestPayment.date).getTime();
            const now = new Date().getTime();
            const msIn30Days = 30 * 24 * 60 * 60 * 1000;
            
            if (now - latestDate <= msIn30Days) {
                newStatus = 'M';
                movingCount++;
            } else {
                newStatus = 'NM';
                nmCount++;
            }
        }

        await client.query('UPDATE loans SET status = $1, running_balance = $2 WHERE id = $3', [newStatus, finalRunning, loan.id]);
    }

    console.log(`\nUpdated ${loans.length} loans.`);
    console.log(`  Paid: ${paidCount}`);
    console.log(`  NMSR: ${nmsrCount}`);
    console.log(`  M (Moving): ${movingCount}`);
    console.log(`  NM (Not Moving): ${nmCount}`);

    await client.end();
}

run().catch(console.error);

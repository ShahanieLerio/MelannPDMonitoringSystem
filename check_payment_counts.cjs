const { Client } = require('pg');

async function check() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();

    const loanIds = ['42356', '8239', '16245', '11051'];
    const codeMap = { '42356': '1064', '8239': '1254', '16245': '957', '11051': '1423' };

    const r = await client.query(
        `SELECT loan_id, COUNT(*) as cnt FROM payments WHERE loan_id = ANY($1) GROUP BY loan_id ORDER BY loan_id`,
        [loanIds]
    );

    console.log('=== Current DB payment counts ===');
    loanIds.forEach(lid => {
        const row = r.rows.find(x => x.loan_id === lid);
        console.log(`  Code ${codeMap[lid]} (LoanID ${lid}): ${row ? row.cnt : 0} payments`);
    });

    // Show sample from 16245
    const sample = await client.query(
        `SELECT id, loan_id, date, amount FROM payments WHERE loan_id = $1 ORDER BY date LIMIT 5`,
        ['16245']
    );
    console.log('\n=== Sample payments for Code 957 (LoanID 16245) ===');
    if (sample.rows.length === 0) {
        console.log('  (no payments found)');
    } else {
        sample.rows.forEach(r => console.log(`  ID:${r.id} date:${r.date} amount:${r.amount}`));
    }

    await client.end();
}

check().catch(console.error);

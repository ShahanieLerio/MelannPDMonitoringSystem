const { Client } = require('pg');

async function check() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();

    const res = await client.query(`SELECT id, code, first_name, last_name, borrower_name FROM loans WHERE code = '3079' OR id = '3079'`);
    console.log("Loans:", res.rows);

    if (res.rows.length > 0) {
        for (let row of res.rows) {
            const pRes = await client.query(`SELECT count(*) as cnt FROM payments WHERE loan_id = $1`, [row.id]);
            console.log(`Payments for loan_id ${row.id}: ${pRes.rows[0].cnt}`);
        }
    }

    const cRes = await client.query(`SELECT id, code, first_name, last_name FROM loans WHERE last_name ILIKE '%son%' AND first_name ILIKE '%chereyl%'`);
    console.log("Loans by name:", cRes.rows);
    
    if (cRes.rows.length > 0) {
        for (let row of cRes.rows) {
            const pRes = await client.query(`SELECT count(*) as cnt FROM payments WHERE loan_id = $1`, [row.id]);
            console.log(`Payments for loan_id ${row.id}: ${pRes.rows[0].cnt}`);
        }
    }

    await client.end();
}
check();

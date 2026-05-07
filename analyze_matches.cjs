const { Client } = require('pg');

async function analyze() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();

    // Let's get all numeric IDs
    const resNumeric = await client.query(`SELECT id, code, first_name, last_name FROM loans WHERE id ~ '^[0-9]+$'`);
    console.log(`Numeric IDs (Access records): ${resNumeric.rows.length}`);

    // Let's get all alphanumeric IDs (Web App records)
    const resAlpha = await client.query(`SELECT id, code, first_name, last_name FROM loans WHERE id !~ '^[0-9]+$'`);
    console.log(`Alpha IDs (Web App records): ${resAlpha.rows.length}`);

    // Find overlaps by code
    let matches = 0;
    for (let acc of resNumeric.rows) {
        const match = resAlpha.rows.find(w => w.code === acc.code);
        if (match) {
            matches++;
        }
    }
    console.log(`Matches by Code: ${matches}`);

    await client.end();
}
analyze();

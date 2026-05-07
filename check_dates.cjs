const { Client } = require('pg');

async function checkDates() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();

    // Check payments matching OR- followed by numbers
    const pRes = await client.query(`SELECT id, or_number, date FROM payments WHERE or_number ~ '^OR-[0-9]+$' LIMIT 5`);
    console.log("Imported payments:", pRes.rows);

    // Also check loans dates (due_date)
    const lRes = await client.query(`SELECT id, code, first_name, last_name, due_date FROM loans WHERE code = '1312'`);
    console.log("Loans (Abainza):", lRes.rows);

    await client.end();
}
checkDates();

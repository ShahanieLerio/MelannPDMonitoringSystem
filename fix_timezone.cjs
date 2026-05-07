const { Client } = require('pg');

async function fixDates() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();

    // Fix payment dates
    console.log("Fixing payment dates...");
    const pRes = await client.query(`
        UPDATE payments 
        SET date = to_char(date(date) + interval '1 day', 'YYYY-MM-DD')
        WHERE or_number ~ '^OR-[0-9]+$'
        RETURNING id;
    `);
    console.log(`Updated ${pRes.rows.length} payments.`);

    // Fix loan dates for those that were merged or imported
    console.log("Fixing loan dates...");
    // 1. Loans that have imported payments (which include the merged ones)
    // 2. Loans that are purely numeric (unmerged Access records)
    const lRes = await client.query(`
        UPDATE loans 
        SET 
            due_date = to_char(date(due_date) + interval '1 day', 'YYYY-MM-DD'),
            month_reported = to_char(date(due_date) + interval '1 day', 'YYYY-MM')
        WHERE id IN (
            SELECT DISTINCT loan_id FROM payments WHERE or_number ~ '^OR-[0-9]+$'
        ) OR id ~ '^[0-9]+$'
        RETURNING id;
    `);
    console.log(`Updated ${lRes.rows.length} loans.`);

    await client.end();
}
fixDates().catch(console.error);

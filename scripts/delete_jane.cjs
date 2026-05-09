const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgres://postgres:admin123@localhost:5432/melannDB_Pastdue"
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Connecting to database...');
        
        // Find if Jane Smith has loans
        const loansRes = await client.query("SELECT count(*) FROM loans WHERE collector = 'Jane Smith'");
        const loanCount = parseInt(loansRes.rows[0].count);
        console.log(`Loans assigned to Jane Smith: ${loanCount}`);

        if (loanCount > 0) {
            console.log('Reassigning loans to UNASSIGNED...');
            const updateRes = await client.query("UPDATE loans SET collector = 'UNASSIGNED' WHERE collector = 'Jane Smith'");
            console.log(`Updated ${updateRes.rowCount} loans to UNASSIGNED.`);
        }

        // Delete Jane Smith
        const res = await client.query("DELETE FROM collectors WHERE name = 'Jane Smith' RETURNING *");
        console.log(`Deleted ${res.rowCount} collector(s) named Jane Smith.`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        pool.end();
    }
}
run();

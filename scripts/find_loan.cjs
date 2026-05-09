const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgres://postgres:admin123@localhost:5432/melannDB_Pastdue"
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Finding UNASSIGNED loans...');
        const res = await client.query("SELECT id, code, borrower_name, outstanding_balance, collector FROM loans WHERE collector = 'UNASSIGNED'");
        console.log(res.rows);

        // We can just delete this loan if it is indeed the sample one
        // If there's only one and it was the one we changed
        if (res.rowCount === 1) {
            console.log('Deleting the unassigned sample loan...');
            const delRes = await client.query("DELETE FROM loans WHERE id = $1", [res.rows[0].id]);
            console.log(`Deleted ${delRes.rowCount} loan.`);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        pool.end();
    }
}
run();

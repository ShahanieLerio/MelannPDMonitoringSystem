const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgres://postgres:admin123@localhost:5432/melannDB_Pastdue"
});

async function run() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT id, code, borrower_name, outstanding_balance, collector FROM loans WHERE borrower_name ILIKE '%Dalisay%'");
        console.log('Dalisay loans in DB:', res.rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        pool.end();
    }
}
run();

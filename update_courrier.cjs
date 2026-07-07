const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    try {
        await pool.query("ALTER TABLE demand_letters ADD COLUMN IF NOT EXISTS courrier VARCHAR(50);");
        const res = await pool.query("UPDATE demand_letters SET courrier = 'Personal Service' WHERE courrier IS NULL OR courrier = ''");
        console.log('Update successful! Rows affected:', res.rowCount);
    } catch (err) {
        console.error('Error updating database:', err);
    } finally {
        await pool.end();
    }
}

run();

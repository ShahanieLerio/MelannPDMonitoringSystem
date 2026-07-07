const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        console.log('Adding date_release, principal, and total_loan columns to loans table if not exists...');
        await client.query(`
            ALTER TABLE loans
            ADD COLUMN IF NOT EXISTS date_release TEXT,
            ADD COLUMN IF NOT EXISTS principal NUMERIC(15, 2),
            ADD COLUMN IF NOT EXISTS total_loan NUMERIC(15, 2);
        `);
        console.log('Successfully altered loans table.');
        client.release();
    } catch (err) {
        console.error('Error modifying table:', err);
    } finally {
        pool.end();
    }
}

main();

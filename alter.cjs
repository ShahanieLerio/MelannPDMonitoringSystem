const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        console.log('Adding ptp_date and follow_up_date columns to remarks table if not exists...');
        await client.query(`
            ALTER TABLE remarks
            ADD COLUMN IF NOT EXISTS ptp_date TEXT,
            ADD COLUMN IF NOT EXISTS follow_up_date TEXT;
        `);
        console.log('Successfully altered remarks table.');
        client.release();
    } catch (err) {
        console.error('Error modifying table:', err);
    } finally {
        pool.end();
    }
}

main();

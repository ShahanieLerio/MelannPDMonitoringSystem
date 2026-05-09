const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        console.log('Adding action_note and action_stage columns to loans table if not exists...');
        await client.query(`
            ALTER TABLE loans
            ADD COLUMN IF NOT EXISTS action_note TEXT,
            ADD COLUMN IF NOT EXISTS action_stage TEXT;
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

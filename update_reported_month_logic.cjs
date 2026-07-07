const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateMonthReported() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log('Running update on month_reported...');
        
        const res = await client.query(`
            UPDATE loans
            SET month_reported = to_char((due_date::date + interval '2 months'), 'YYYY-MM')
            WHERE due_date >= '2016-01-01' 
              AND due_date <= '2024-12-31'
        `);
        
        console.log(`Successfully updated ${res.rowCount} records.`);
        
        await client.query('COMMIT');
        console.log('Transaction committed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during update, transaction rolled back.', err);
    } finally {
        client.release();
        pool.end();
    }
}

updateMonthReported();

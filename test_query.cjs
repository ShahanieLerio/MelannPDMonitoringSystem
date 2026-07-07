const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const res = await pool.query(`
        SELECT due_date, 
               month_reported as old_reported,
               to_char((due_date::date + interval '2 months'), 'YYYY-MM') as new_reported
        FROM loans
        WHERE due_date >= '2016-01-01' AND due_date <= '2024-12-31'
        LIMIT 10
    `);
    console.log(res.rows);
    pool.end();
}
check();

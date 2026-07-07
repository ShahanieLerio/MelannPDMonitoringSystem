const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const res = await pool.query('SELECT due_date, month_reported FROM loans LIMIT 10');
    console.log(res.rows);
    pool.end();
}
check();

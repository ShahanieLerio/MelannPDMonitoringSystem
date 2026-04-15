
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function init() {
    const client = await pool.connect();
    try {
        console.log('Reading schema.sql...');
        const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');

        console.log('Executing schema...');
        await client.query(schema);

        console.log('Database initialized successfully! 🚀');
    } catch (err) {
        console.error('Initialization failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

init();

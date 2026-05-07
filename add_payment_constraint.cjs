const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const c = new Client({ connectionString: process.env.DATABASE_URL });

c.connect()
  .then(() => {
    console.log('Adding unique index on (loan_id, date)...');
    return c.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payments_loan_id_date_unique
      ON payments (loan_id, date)
    `);
  })
  .then(() => {
    console.log('Unique index is ready.');
    return c.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    c.end();
  });

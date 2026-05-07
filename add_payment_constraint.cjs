const { Client } = require('pg');
const c = new Client({ connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue' });
c.connect()
  .then(() => {
    console.log('Adding unique constraint on (loan_id, date)...');
    return c.query(`
      ALTER TABLE payments
      ADD CONSTRAINT payments_loan_id_date_unique UNIQUE (loan_id, date)
    `);
  })
  .then(() => {
    console.log('✅ Unique constraint added successfully!');
    return c.end();
  })
  .catch(e => {
    if (e.message.includes('already exists')) {
      console.log('ℹ️  Constraint already exists — no action needed.');
    } else {
      console.error('❌ Error:', e.message);
    }
    c.end();
  });

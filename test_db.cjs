const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Check CABONITA after fix
pool.query("SELECT id, code, borrower_name, due_date, date_release, principal, total_loan FROM loans WHERE borrower_name LIKE '%CABONITA%'")
  .then(res => {
    console.log('=== CABONITA in PostgreSQL after LoanID fix ===');
    console.log(JSON.stringify(res.rows, null, 2));
    
    // Also check how many records still have the old (wrong) data vs corrected
    return pool.query("SELECT count(*) as total, count(principal) as has_principal, count(date_release) as has_date_release, count(total_loan) as has_total_loan FROM loans");
  })
  .then(res => {
    console.log('\n=== Overall data coverage ===');
    console.log(JSON.stringify(res.rows, null, 2));
    pool.end();
  })
  .catch(err => { console.error(err); pool.end(); });

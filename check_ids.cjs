const { Client } = require('pg');

async function run() {
    const c = new Client({connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'});
    await c.connect();
    
    // Show sample DB IDs
    const res = await c.query("SELECT id, code, borrower_name FROM loans LIMIT 10");
    console.log('Sample DB records:');
    res.rows.forEach(r => console.log('  ID:', r.id, 'Code:', r.code, 'Name:', r.borrower_name));
    
    // Check if CSV LoanIDs exist at all
    const check = await c.query("SELECT id FROM loans WHERE id = '3079'");
    console.log('\nLoanID 3079 exists?', check.rows.length > 0);
    
    const check2 = await c.query("SELECT id FROM loans WHERE id = '686'");
    console.log('ID 686 exists?', check2.rows.length > 0);
    
    // Check by code
    const check3 = await c.query("SELECT id, code, borrower_name FROM loans WHERE code = '686'");
    console.log('Code 686:', check3.rows);
    
    // How many DB loans are there total?
    const total = await c.query("SELECT count(*) FROM loans");
    console.log('\nTotal DB loans:', total.rows[0].count);
    
    // What format are the IDs in?
    const ids = await c.query("SELECT id FROM loans LIMIT 20");
    console.log('Sample IDs:', ids.rows.map(r => r.id));
    
    await c.end();
}

run().catch(console.error);

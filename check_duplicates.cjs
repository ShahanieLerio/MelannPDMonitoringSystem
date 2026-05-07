const { Client } = require('pg');

async function run() {
    const c = new Client({connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'});
    await c.connect();
    
    console.log("=== MORATA ===");
    const morata = await c.query("SELECT id, code, borrower_name, month_reported, outstanding_balance FROM loans WHERE code = '1384'");
    console.log(morata.rows);
    
    console.log("=== ARCALA ===");
    const arcala = await c.query("SELECT id, code, borrower_name, month_reported FROM loans WHERE code = '77'");
    console.log(arcala.rows);
    
    console.log("=== UNKNOWN ===");
    const unk = await c.query("SELECT id, code, borrower_name, month_reported, outstanding_balance FROM loans WHERE code = '0'");
    console.log(`Unknown loans total: ${unk.rows.length}`);
    if(unk.rows.length > 0) {
       console.log(unk.rows[0]);
    }
    
    await c.end();
}
run();

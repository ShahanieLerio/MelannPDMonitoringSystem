const { Client } = require('pg');

async function run() {
    const c = new Client({connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'});
    await c.connect();
    
    const p1 = await c.query("SELECT count(*) FROM payments WHERE loan_id = 'x7hl2cj'");
    console.log('x7hl2cj payments:', p1.rows[0].count);
    
    const p2 = await c.query("SELECT count(*) FROM payments WHERE loan_id = '10368'");
    console.log('10368 payments:', p2.rows[0].count);
    
    await c.end();
}
run();

const { Client } = require('pg');
async function run() {
    const c = new Client({connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'});
    await c.connect();
    const r = await c.query("SELECT * FROM payments WHERE loan_id='6ubw174' ORDER BY date");
    console.table(r.rows);
    await c.end();
}
run().catch(console.error);

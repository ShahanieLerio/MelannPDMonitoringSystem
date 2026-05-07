const { Client } = require('pg');

async function run() {
    const c = new Client({connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'});
    await c.connect();
    const res = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'loans'");
    console.log(res.rows.map(r => r.column_name));
    await c.end();
}
run();

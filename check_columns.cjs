const { Client } = require('pg');
const c = new Client({connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'});
c.connect().then(()=> c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'loans'")).then(r => console.log(r.rows.map(x=>x.column_name))).then(()=>c.end());

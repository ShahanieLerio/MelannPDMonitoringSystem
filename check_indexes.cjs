const { Client } = require('pg');
const c = new Client({ connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue' });
c.connect()
  .then(() => c.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='payments'"))
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); return c.end(); })
  .catch(e => { console.error(e.message); c.end(); });

const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue' });

client.connect().then(() => {
    return client.query("SELECT borrower_name, promise_to_pay_date, follow_up_date, recurring_schedule FROM loans WHERE borrower_name ILIKE '%Amoyen%' OR borrower_name ILIKE '%Rallos%'");
}).then(res => {
    console.log(res.rows);
    client.end();
}).catch(console.error);

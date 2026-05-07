const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue' });

async function fix() {
    await client.connect();

    // Fix Amoyen
    await client.query(`
        UPDATE loans 
        SET promise_to_pay_date = '2026-04-30',
            recurring_schedule = jsonb_set(recurring_schedule::jsonb, '{nextDueDate}', '"2026-04-30"')
        WHERE borrower_name ILIKE '%Amoyen%'
    `);

    // Fix Rallos
    await client.query(`
        UPDATE loans 
        SET promise_to_pay_date = NULL,
            follow_up_date = '2026-04-30'
        WHERE borrower_name ILIKE '%Rallos%'
    `);

    console.log("Clients fixed successfully.");
    await client.end();
}

fix().catch(console.error);

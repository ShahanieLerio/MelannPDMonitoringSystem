/**
 * Diagnose the actual state of these 4 clients in the DB
 */
const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();

    // Search by borrower name
    const names = ['Alvarez', 'Manatad', 'Nayga', 'Velarde'];
    
    console.log('=== All loan records matching these borrowers ===\n');
    for (const name of names) {
        const r = await client.query(
            `SELECT id, code, first_name, last_name, borrower_name, collector, branch, outstanding_balance, running_balance, amount_collected
             FROM loans 
             WHERE last_name ILIKE $1 OR borrower_name ILIKE $2
             ORDER BY id`,
            [`%${name}%`, `%${name}%`]
        );
        console.log(`--- ${name} (${r.rows.length} records) ---`);
        r.rows.forEach(row => {
            console.log(`  LoanID: ${row.id}, Code: ${row.code}, Name: ${row.borrower_name}, Collector: ${row.collector}, Branch: ${row.branch}`);
            console.log(`    O/S: ${row.outstanding_balance}, Collected: ${row.amount_collected}, Running: ${row.running_balance}`);
        });
        console.log('');
    }

    // Check codes that appear in the screenshot
    console.log('=== Checking specific codes visible in screenshot ===\n');
    const codes = ['3620', '1257', '1426', '957', '1064', '1254', '1423'];
    for (const code of codes) {
        const r = await client.query(`SELECT id, code, borrower_name, collector FROM loans WHERE code = $1`, [code]);
        if (r.rows.length > 0) {
            r.rows.forEach(row => console.log(`  Code ${code}: LoanID=${row.id}, Name=${row.borrower_name}, Collector=${row.collector}`));
        } else {
            console.log(`  Code ${code}: NOT FOUND in DB`);
        }
    }

    // Check payment counts for all found loan IDs
    console.log('\n=== Payment counts for all relevant loan IDs ===\n');
    const allLoans = await client.query(
        `SELECT id, code, borrower_name FROM loans 
         WHERE last_name ILIKE ANY($1) OR borrower_name ILIKE ANY($1)`,
        [names.map(n => `%${n}%`)]
    );
    for (const loan of allLoans.rows) {
        const pc = await client.query(`SELECT COUNT(*) FROM payments WHERE loan_id = $1`, [loan.id]);
        console.log(`  LoanID ${loan.id} (Code ${loan.code}, ${loan.borrower_name}): ${pc.rows[0].count} payments`);
    }

    await client.end();
}

run().catch(console.error);

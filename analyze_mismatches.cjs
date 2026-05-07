const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

async function run() {
    const c = new Client({connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'});
    await c.connect();

    const parseCSVLine = (line) => {
        if (!line) return [];
        let clean = line.trim();
        if (clean.startsWith('"')) clean = clean.substring(1);
        if (clean.endsWith('"')) clean = clean.substring(0, clean.length - 1);
        return clean.split('","');
    };

    const formatDateStr = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    };

    // Categorize mismatches
    const dbRes = await c.query("SELECT id, code, date_release, due_date, principal, total_loan, outstanding_balance, amount_collected, running_balance FROM loans");
    const dbLoansById = {};
    dbRes.rows.forEach(r => { dbLoansById[r.id] = r; });

    const stream = fs.createReadStream('loans.csv');
    const rl = readline.createInterface({ input: stream });

    let isHeader = true;
    let headers = [];

    let onlyRunningBalance = 0;
    let onlyDateOff = 0;
    let principalIssue = 0;
    let samplePrincipal = [];
    let sampleDateOff = [];
    let dateOnlyCSV0 = 0;

    for await (const line of rl) {
        if (isHeader) { headers = parseCSVLine(line); isHeader = false; continue; }

        const values = parseCSVLine(line);
        const csv = {};
        headers.forEach((h, i) => csv[h] = values[i]);
        if (csv.Status !== 'Good') continue;

        const db = dbLoansById[csv.LoanID];
        if (!db) continue;

        const csvBalance = parseFloat(csv.Balance || '0');
        const dbRunning = parseFloat(db.running_balance || '0');
        const balanceDiff = Math.abs(dbRunning - csvBalance) > 0.01;

        const csvPrincipal = parseFloat(csv.Principal || '0');
        const dbPrincipal = parseFloat(db.principal || '0');
        const principalDiff = Math.abs(dbPrincipal - csvPrincipal) > 0.01;

        const csvTotal = parseFloat(csv.Total || '0');
        const dbOutstanding = parseFloat(db.outstanding_balance || '0');
        const totalDiff = Math.abs(dbOutstanding - csvTotal) > 0.01;

        const csvMaturity = formatDateStr(csv.Maturity);
        const dbMaturity = formatDateStr(db.due_date);
        const maturityDiff = csvMaturity && dbMaturity && dbMaturity !== csvMaturity;

        const csvDateRelease = formatDateStr(csv.DateRelease);
        const dbDateRelease = formatDateStr(db.date_release);
        const dateReleaseDiff = csvDateRelease && dbDateRelease && dbDateRelease !== csvDateRelease;

        // Count: CSV Balance = 0 but DB has actual balance (this is normal - CSV snapshot was "fully paid")
        if (csvBalance === 0 && dbRunning > 0) dateOnlyCSV0++;

        if (balanceDiff && !principalDiff && !totalDiff && !maturityDiff && !dateReleaseDiff) {
            onlyRunningBalance++;
        }
        if (maturityDiff && !principalDiff && !totalDiff) {
            onlyDateOff++;
            if (sampleDateOff.length < 5) {
                sampleDateOff.push('Code ' + csv.Code + ': DB=' + dbMaturity + ' CSV=' + csvMaturity);
            }
        }
        if (principalDiff) {
            principalIssue++;
            if (samplePrincipal.length < 10) {
                samplePrincipal.push('Code ' + csv.Code + ' ' + csv.Customer + ': DB principal=' + dbPrincipal + ' CSV=' + csvPrincipal + ', DB outstanding=' + dbOutstanding + ' CSV total=' + csvTotal);
            }
        }
    }

    console.log('=== MISMATCH ANALYSIS ===');
    console.log('Running balance only mismatch (CSV=0, DB has real balance):', onlyRunningBalance);
    console.log('  -> Of those, CSV Balance was 0:', dateOnlyCSV0);
    console.log('Maturity date off by ~1 day:', onlyDateOff);
    console.log('Principal/Total mismatch:', principalIssue);
    console.log('\nSample date-off:');
    sampleDateOff.forEach(s => console.log('  ' + s));
    console.log('\nSample principal issues:');
    samplePrincipal.forEach(s => console.log('  ' + s));

    await c.end();
}

run().catch(console.error);

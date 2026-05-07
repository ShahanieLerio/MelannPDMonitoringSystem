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

    const minDate = new Date('2016-01-01T00:00:00').getTime();
    const maxDate = new Date('2026-02-15T23:59:59').getTime();

    // Fetch ALL loans from DB indexed by code (as array since codes can repeat for renewals)
    const dbRes = await c.query("SELECT id, code, date_release, due_date, principal, total_loan, outstanding_balance, amount_collected, running_balance, status FROM loans");
    const dbByCode = {};
    dbRes.rows.forEach(r => {
        if (!dbByCode[r.code]) dbByCode[r.code] = [];
        dbByCode[r.code].push(r);
    });
    console.log('DB total loans:', dbRes.rows.length);

    const stream = fs.createReadStream('loans.csv');
    const rl = readline.createInterface({ input: stream });

    let isHeader = true;
    let headers = [];
    let totalInRange = 0;
    let totalMatched = 0;
    let missingInDB = [];
    let codeMismatchCount = 0;
    let dateReleaseMismatchList = [];
    let maturityMismatchList = [];
    let principalMismatchList = [];
    let totalLoanMismatchList = [];
    let runBalMismatchList = [];
    let perfectMatch = 0;

    for await (const line of rl) {
        if (isHeader) { headers = parseCSVLine(line); isHeader = false; continue; }

        const values = parseCSVLine(line);
        const csv = {};
        headers.forEach((h, i) => csv[h] = values[i]);
        if (csv.Status !== 'Good') continue;

        const maturityDate = new Date(csv.Maturity);
        if (isNaN(maturityDate.getTime())) continue;
        if (maturityDate.getTime() < minDate || maturityDate.getTime() > maxDate) continue;

        totalInRange++;

        // Skip empty/garbage codes
        if (!csv.Code || csv.Code === '0') continue;

        // Find DB record by code
        const candidates = dbByCode[csv.Code];
        if (!candidates || candidates.length === 0) {
            missingInDB.push('Code=' + csv.Code + ' ' + csv.Customer + ', ' + csv.FirstName);
            continue;
        }

        // If multiple candidates (renewals), pick the best match by due_date
        const csvMaturity = formatDateStr(csv.Maturity);
        let db = candidates[0]; // default to first
        if (candidates.length > 1 && csvMaturity) {
            const exact = candidates.find(c => formatDateStr(c.due_date) === csvMaturity);
            if (exact) db = exact;
        }

        totalMatched++;
        let hasError = false;

        // 1. Date Release
        const csvDR = formatDateStr(csv.DateRelease);
        const dbDR = formatDateStr(db.date_release);
        if (csvDR && dbDR && dbDR !== csvDR) {
            dateReleaseMismatchList.push('Code ' + csv.Code + ' ' + csv.Customer + ': DB=' + dbDR + ' CSV=' + csvDR);
            hasError = true;
        }

        // 2. Maturity Date
        const dbMat = formatDateStr(db.due_date);
        if (csvMaturity && dbMat && dbMat !== csvMaturity) {
            maturityMismatchList.push('Code ' + csv.Code + ' ' + csv.Customer + ': DB=' + dbMat + ' CSV=' + csvMaturity);
            hasError = true;
        }

        // 3. Principal
        const csvPrincipal = parseFloat(csv.Principal || '0');
        const dbPrincipal = parseFloat(db.principal || '0');
        if (Math.abs(dbPrincipal - csvPrincipal) > 0.01) {
            principalMismatchList.push('Code ' + csv.Code + ' ' + csv.Customer + ': DB=' + dbPrincipal + ' CSV=' + csvPrincipal);
            hasError = true;
        }

        // 4. Loan Total (CSV "Total" -> DB "outstanding_balance")
        const csvTotal = parseFloat(csv.Total || '0');
        const dbOutstanding = parseFloat(db.outstanding_balance || '0');
        if (Math.abs(dbOutstanding - csvTotal) > 0.01) {
            totalLoanMismatchList.push('Code ' + csv.Code + ' ' + csv.Customer + ': DB=' + dbOutstanding + ' CSV=' + csvTotal);
            hasError = true;
        }

        // 5. Running Balance (CSV "Balance" -> DB "running_balance")
        const csvBalance = parseFloat(csv.Balance || '0');
        const dbRunning = parseFloat(db.running_balance || '0');
        if (Math.abs(dbRunning - csvBalance) > 0.01) {
            runBalMismatchList.push('Code ' + csv.Code + ' ' + csv.Customer + ': DB=' + dbRunning + ' CSV=' + csvBalance);
            hasError = true;
        }

        if (!hasError) perfectMatch++;
    }

    let report = '';
    report += '============================================\n';
    report += '  MIGRATION VERIFICATION REPORT\n';
    report += '  Criteria: Status=Good, Maturity 2016-01-01 to 2026-02-15\n';
    report += '============================================\n\n';
    report += 'Total CSV rows in date range: ' + totalInRange + '\n';
    report += 'Found in DB (by Code):        ' + totalMatched + '\n';
    report += 'Missing from DB:              ' + missingInDB.length + '\n';
    report += 'Perfect match (all fields):   ' + perfectMatch + '\n\n';
    report += '--- FIELD-LEVEL MISMATCH COUNTS ---\n';
    report += 'Date Release mismatches:      ' + dateReleaseMismatchList.length + '\n';
    report += 'Maturity Date mismatches:     ' + maturityMismatchList.length + '\n';
    report += 'Principal mismatches:         ' + principalMismatchList.length + '\n';
    report += 'Loan Total mismatches:        ' + totalLoanMismatchList.length + '\n';
    report += 'Running Balance mismatches:   ' + runBalMismatchList.length + '\n\n';

    if (missingInDB.length > 0) {
        report += '=== MISSING FROM DB ===\n';
        missingInDB.forEach(m => report += m + '\n');
        report += '\n';
    }
    if (dateReleaseMismatchList.length > 0) {
        report += '=== DATE RELEASE MISMATCHES ===\n';
        dateReleaseMismatchList.forEach(m => report += m + '\n');
        report += '\n';
    }
    if (maturityMismatchList.length > 0) {
        report += '=== MATURITY DATE MISMATCHES ===\n';
        maturityMismatchList.forEach(m => report += m + '\n');
        report += '\n';
    }
    if (principalMismatchList.length > 0) {
        report += '=== PRINCIPAL MISMATCHES ===\n';
        principalMismatchList.forEach(m => report += m + '\n');
        report += '\n';
    }
    if (totalLoanMismatchList.length > 0) {
        report += '=== LOAN TOTAL MISMATCHES ===\n';
        totalLoanMismatchList.forEach(m => report += m + '\n');
        report += '\n';
    }
    if (runBalMismatchList.length > 0) {
        report += '=== RUNNING BALANCE MISMATCHES (showing all) ===\n';
        report += '(Note: DB balance = outstanding_balance - sum(payments). CSV Balance is snapshot from jcashdb.mdb)\n';
        runBalMismatchList.forEach(m => report += m + '\n');
        report += '\n';
    }

    if (missingInDB.length === 0 && dateReleaseMismatchList.length === 0 && maturityMismatchList.length === 0 && principalMismatchList.length === 0 && totalLoanMismatchList.length === 0) {
        report += '\n[SUCCESS] Code, Date Release, Maturity Date, Principal, and Loan Total are ALL CORRECT!\n';
    }

    fs.writeFileSync('verification_results.txt', report);
    console.log(report);
    await c.end();
}

run().catch(console.error);

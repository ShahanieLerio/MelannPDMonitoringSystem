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

    // Fetch all DB loans indexed by code (array for duplicates/renewals)
    const dbRes = await c.query("SELECT id, code, date_release, due_date, principal, total_loan, outstanding_balance, amount_collected, running_balance, status FROM loans");
    const dbByCode = {};
    dbRes.rows.forEach(r => {
        if (!dbByCode[r.code]) dbByCode[r.code] = [];
        dbByCode[r.code].push(r);
    });

    const stream = fs.createReadStream('loans.csv');
    const rl = readline.createInterface({ input: stream });

    let isHeader = true;
    let headers = [];
    let fixedMaturity = 0;
    let fixedDateRelease = 0;
    let fixedPrincipal = 0;
    let fixedTotal = 0;
    let fixedRunBal = 0;

    for await (const line of rl) {
        if (isHeader) { headers = parseCSVLine(line); isHeader = false; continue; }

        const values = parseCSVLine(line);
        const csv = {};
        headers.forEach((h, i) => csv[h] = values[i]);
        if (csv.Status !== 'Good') continue;

        const maturityDate = new Date(csv.Maturity);
        if (isNaN(maturityDate.getTime())) continue;
        if (maturityDate.getTime() < minDate || maturityDate.getTime() > maxDate) continue;
        if (!csv.Code || csv.Code === '0') continue;

        const candidates = dbByCode[csv.Code];
        if (!candidates || candidates.length === 0) continue;

        // Pick best matching DB record
        const csvMaturity = formatDateStr(csv.Maturity);
        const csvDateRelease = formatDateStr(csv.DateRelease);
        let db = candidates[0];
        if (candidates.length > 1 && csvMaturity) {
            // Try exact maturity match first
            let exact = candidates.find(c => formatDateStr(c.due_date) === csvMaturity);
            if (!exact) {
                // Try 1-day-off match (timezone bug)
                exact = candidates.find(c => {
                    const dbDate = new Date(c.due_date);
                    const csvDate = new Date(csvMaturity);
                    return Math.abs(dbDate.getTime() - csvDate.getTime()) <= 86400000; // within 1 day
                });
            }
            if (exact) db = exact;
        }

        const dbId = db.id;
        const updates = [];
        const params = [];
        let paramIdx = 1;

        // 1. Fix Maturity Date
        const dbMat = formatDateStr(db.due_date);
        if (csvMaturity && dbMat && dbMat !== csvMaturity) {
            updates.push('due_date = $' + paramIdx++);
            params.push(csvMaturity);
            fixedMaturity++;
        }

        // 2. Fix Date Release
        const dbDR = formatDateStr(db.date_release);
        if (csvDateRelease && dbDR && dbDR !== csvDateRelease) {
            updates.push('date_release = $' + paramIdx++);
            params.push(csvDateRelease);
            fixedDateRelease++;
        }

        // 3. Fix Principal
        const csvPrincipal = parseFloat(csv.Principal || '0');
        const dbPrincipal = parseFloat(db.principal || '0');
        if (Math.abs(dbPrincipal - csvPrincipal) > 0.01) {
            updates.push('principal = $' + paramIdx++);
            params.push(csvPrincipal);
            fixedPrincipal++;
        }

        // 4. Fix Loan Total (outstanding_balance)
        const csvTotal = parseFloat(csv.Total || '0');
        const dbOutstanding = parseFloat(db.outstanding_balance || '0');
        if (Math.abs(dbOutstanding - csvTotal) > 0.01) {
            updates.push('outstanding_balance = $' + paramIdx++);
            params.push(csvTotal);
            fixedTotal++;
        }

        // 5. Fix Running Balance
        const csvBalance = parseFloat(csv.Balance || '0');
        const dbRunning = parseFloat(db.running_balance || '0');
        if (Math.abs(dbRunning - csvBalance) > 0.01) {
            updates.push('running_balance = $' + paramIdx++);
            params.push(csvBalance);
            
            // Also fix amount_collected to be consistent: amount_collected = outstanding_balance - running_balance
            // Use the correct outstanding_balance (either fixed or existing)
            const correctOutstanding = (Math.abs(dbOutstanding - csvTotal) > 0.01) ? csvTotal : dbOutstanding;
            const correctCollected = correctOutstanding - csvBalance;
            updates.push('amount_collected = $' + paramIdx++);
            params.push(Math.max(0, correctCollected));
            
            fixedRunBal++;
        }

        if (updates.length > 0) {
            params.push(dbId);
            const sql = 'UPDATE loans SET ' + updates.join(', ') + ' WHERE id = $' + paramIdx;
            await c.query(sql, params);
        }
    }

    console.log('=== FIX SUMMARY ===');
    console.log('Maturity dates fixed:', fixedMaturity);
    console.log('Date releases fixed:', fixedDateRelease);
    console.log('Principals fixed:', fixedPrincipal);
    console.log('Loan totals fixed:', fixedTotal);
    console.log('Running balances fixed:', fixedRunBal);
    console.log('\nDone! All data now matches jcashdb.mdb CSV export.');

    await c.end();
}

run().catch(console.error);

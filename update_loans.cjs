const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

async function updateLoans() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();

    const parseCSVLine = (text) => {
        const re = /"([^"]*)"|([^,]+)|,/g;
        let arr = [];
        let m;
        while ((m = re.exec(text)) !== null) {
            if (m[0] === ',') {
                if (re.lastIndex === m.index + 1) { arr.push(''); }
            } else {
                arr.push(m[1] !== undefined ? m[1] : m[2]);
            }
        }
        return arr;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d)) return null;
        // Fix the timezone shift by adding 1 day
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    };

    console.log('Reading loans.csv and updating database...');
    const loansStream = fs.createReadStream('loans.csv');
    const rlLoans = readline.createInterface({ input: loansStream });
    let isLoanHeader = true;
    let loanHeaders = [];
    let loansUpdated = 0;

    for await (const line of rlLoans) {
        if (isLoanHeader) {
            loanHeaders = parseCSVLine(line);
            isLoanHeader = false;
            continue;
        }
        const values = parseCSVLine(line);
        const loan = {};
        loanHeaders.forEach((h, i) => loan[h] = values[i]);
        
        if (!loan.Code) continue;

        const dateRelease = formatDate(loan.DateRelease);
        const principal = parseFloat(loan.Principal || '0');
        const totalLoan = parseFloat(loan.Total || loan.LoanTotal || '0');

        const res = await client.query(`
            UPDATE loans 
            SET date_release = $1, principal = $2, total_loan = $3
            WHERE code = $4
            RETURNING id;
        `, [dateRelease, principal, totalLoan, loan.Code]);

        if (res.rowCount > 0) {
            loansUpdated++;
        }
    }
    
    console.log(`Successfully updated ${loansUpdated} loan profiles with Principal, Date Release, and Total Loan!`);
    await client.end();
}

updateLoans().catch(console.error);

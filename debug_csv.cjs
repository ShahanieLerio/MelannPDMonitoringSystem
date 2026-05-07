const fs = require('fs');
const readline = require('readline');

async function run() {
    const parseCSVLine = (line) => {
        if (!line) return [];
        let clean = line.trim();
        if (clean.startsWith('"')) clean = clean.substring(1);
        if (clean.endsWith('"')) clean = clean.substring(0, clean.length - 1);
        return clean.split('","');
    };

    const stream = fs.createReadStream('loans.csv');
    const rl = readline.createInterface({ input: stream });

    let isHeader = true;
    let headers = [];
    let goodCount = 0;
    let totalCount = 0;
    let statusValues = new Set();
    let firstGoodRow = null;

    for await (const line of rl) {
        if (isHeader) {
            headers = parseCSVLine(line);
            console.log('Status index:', headers.indexOf('Status'));
            console.log('LoanStatus index:', headers.indexOf('LoanStatus'));
            isHeader = false;
            continue;
        }

        const values = parseCSVLine(line);
        const csv = {};
        headers.forEach((h, i) => csv[h] = values[i]);

        totalCount++;
        statusValues.add(csv.Status);

        if (csv.Status === 'Good') {
            goodCount++;
            if (!firstGoodRow) {
                firstGoodRow = csv;
            }
        }
    }

    console.log('Total rows:', totalCount);
    console.log('Good status count:', goodCount);
    console.log('All unique Status values:', [...statusValues]);
    if (firstGoodRow) {
        console.log('First Good row sample:', {
            LoanID: firstGoodRow.LoanID,
            Code: firstGoodRow.Code,
            Customer: firstGoodRow.Customer,
            Status: firstGoodRow.Status,
            Maturity: firstGoodRow.Maturity,
            DateRelease: firstGoodRow.DateRelease,
            Principal: firstGoodRow.Principal,
            Total: firstGoodRow.Total,
            Balance: firstGoodRow.Balance
        });
    }
}

run().catch(console.error);

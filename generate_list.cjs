const fs = require('fs');
const readline = require('readline');

async function run() {
    const loansStream = fs.createReadStream('loans.csv');
    const rlLoans = readline.createInterface({ input: loansStream });
    let isHeader = true;
    let list = "MIGRATED CLIENTS (Good Status, Maturity 2016-01-01 to 2026-02-15):\n";
    list += "----------------------------------------------------------------------\n";
    
    let count = 0;
    for await (const line of rlLoans) {
        if (isHeader) { isHeader = false; continue; }
        const arr = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if(!arr) continue;
        const parse = (s) => s ? s.replace(/^"|"$/g, '') : '';
        // In CSV: LoanID(0), Collector(1), Code(2), Customer(3), FirstName(4)
        const parts = line.split(',');
        const id = parts[0] ? parts[0].replace(/"/g, '') : '';
        const lastName = parts[3] ? parts[3].replace(/"/g, '') : '';
        const firstName = parts[4] ? parts[4].replace(/"/g, '') : '';
        if(id && id !== 'LoanID') {
            list += `${++count}. [ID: ${id}] ${firstName} ${lastName}\n`;
        }
    }
    fs.writeFileSync('migrated_clients_list.txt', list);
}
run();

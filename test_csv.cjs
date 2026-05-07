const fs = require('fs');

const parseCSVLine = (line) => {
    if (!line) return [];
    let clean = line.trim();
    if (clean.startsWith('"')) clean = clean.substring(1);
    if (clean.endsWith('"')) clean = clean.substring(0, clean.length - 1);
    return clean.split('","');
};

const content = fs.readFileSync('loans.csv', 'utf8').split('\n');
console.log('Headers:', parseCSVLine(content[0]));
console.log('Row 1:', parseCSVLine(content[1]));

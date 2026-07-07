const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function getReportedMonth(dueDateStr) {
    const d = new Date(dueDateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    const day = d.getDate();

    let cycleNum;
    if (month === 1) cycleNum = 1;
    else if (month === 2 && day <= 15) cycleNum = 1;
    else if (month === 2 && day > 15) cycleNum = 2;
    else if (month === 3) cycleNum = 2;
    else if (month === 4) cycleNum = 3;
    else if (month === 5 && day <= 15) cycleNum = 3;
    else if (month === 5 && day > 15) cycleNum = 4;
    else if (month === 6) cycleNum = 4;
    else if (month === 7) cycleNum = 5;
    else if (month === 8 && day <= 15) cycleNum = 5;
    else if (month === 8 && day > 15) cycleNum = 6;
    else if (month === 9) cycleNum = 6;
    else if (month === 10) cycleNum = 7;
    else if (month === 11 && day <= 15) cycleNum = 7;
    else if (month === 11 && day > 15) cycleNum = 8;
    else if (month === 12) cycleNum = 8;

    let reportedMonthNum = 0;
    let reportedYear = year;

    if (cycleNum === 1) reportedMonthNum = 4;
    else if (cycleNum === 2) reportedMonthNum = 5;
    else if (cycleNum === 3) reportedMonthNum = 7;
    else if (cycleNum === 4) reportedMonthNum = 8;
    else if (cycleNum === 5) reportedMonthNum = 10;
    else if (cycleNum === 6) reportedMonthNum = 11;
    else if (cycleNum === 7) { reportedMonthNum = 1; reportedYear++; }
    else if (cycleNum === 8) { reportedMonthNum = 2; reportedYear++; }

    return `${reportedYear}-${String(reportedMonthNum).padStart(2, '0')}`;
}

async function updateMonthReported2025() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log('Fetching loans with due_date >= 2025-01-01...');
        const res = await client.query(`SELECT id, due_date FROM loans WHERE due_date >= '2025-01-01'`);
        
        console.log(`Found ${res.rowCount} records to update.`);
        
        let updateCount = 0;
        for (const row of res.rows) {
            const newReported = getReportedMonth(row.due_date);
            await client.query(
                `UPDATE loans SET month_reported = $1 WHERE id = $2`,
                [newReported, row.id]
            );
            updateCount++;
        }
        
        await client.query('COMMIT');
        console.log(`Successfully updated ${updateCount} records with the new 45-day cycle logic.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during update, transaction rolled back.', err);
    } finally {
        client.release();
        pool.end();
    }
}

updateMonthReported2025();

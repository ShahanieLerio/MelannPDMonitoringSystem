function getReportedMonth(dueDateStr) {
    const d = new Date(dueDateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    const day = d.getDate();

    let cycleNum = 0;
    // Each pair of months (Jan-Feb, Mar-Apr, etc) has 2 cycles.
    // Let's find the cycle index based on month and day.
    if (month % 2 !== 0) {
        // Odd months: Jan, Mar, May, Jul, Sep, Nov
        // They form the first part of the cycle.
        // Jan 1 to Jan 31 -> Cycle 1
        cycleNum = (Math.ceil(month / 2) - 1) * 2 + 1;
    } else {
        // Even months: Feb, Apr, Jun, Aug, Oct, Dec
        if (day <= 15) {
            // e.g. Feb 1 to Feb 15 -> Cycle 1
            cycleNum = (Math.ceil(month / 2) - 1) * 2 + 1;
        } else {
            // e.g. Feb 16 to end of month -> Cycle 2
            cycleNum = (Math.ceil(month / 2) - 1) * 2 + 2;
        }
    }

    // Now map cycleNum to Reported Month
    // Cycle 1: Jan 01 - Feb 15 -> April (Month 4)
    // Cycle 2: Feb 16 - Mar 31 -> May (Month 5)
    // Cycle 3: Apr 01 - May 15 -> July (Month 7)
    // Cycle 4: May 16 - Jun 30 -> August (Month 8)
    // Cycle 5: Jul 01 - Aug 15 -> October (Month 10)
    // Cycle 6: Aug 16 - Sep 30 -> November (Month 11)
    // Cycle 7: Oct 01 - Nov 15 -> January next year (Month 1)
    // Cycle 8: Nov 16 - Dec 31 -> February next year (Month 2)

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

// Test cases
console.log("2025-01-10 ->", getReportedMonth("2025-01-10")); // 2025-04
console.log("2025-02-15 ->", getReportedMonth("2025-02-15")); // 2025-04
console.log("2025-02-16 ->", getReportedMonth("2025-02-16")); // 2025-05
console.log("2025-03-31 ->", getReportedMonth("2025-03-31")); // 2025-05
console.log("2025-04-05 ->", getReportedMonth("2025-04-05")); // 2025-07
console.log("2025-05-15 ->", getReportedMonth("2025-05-15")); // 2025-07
console.log("2025-05-16 ->", getReportedMonth("2025-05-16")); // 2025-08
console.log("2025-06-30 ->", getReportedMonth("2025-06-30")); // 2025-08
console.log("2025-10-15 ->", getReportedMonth("2025-10-15")); // 2026-01
console.log("2025-12-31 ->", getReportedMonth("2025-12-31")); // 2026-02


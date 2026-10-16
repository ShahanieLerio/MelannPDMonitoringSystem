const normalizeDate = (value) => String(value || '').slice(0, 10);

function getReportedDateForDueDate(dueDate) {
    const date = normalizeDate(dueDate);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return '';

    if (year < 2025) {
        const reported = new Date(Date.UTC(year, month + 1, day));
        return `${reported.getUTCFullYear()}-${String(reported.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    let reportedMonth;
    let reportedDay;
    let reportedYear = year;
    if (month < 2 || (month === 2 && day <= 15)) [reportedMonth, reportedDay] = [4, 1];
    else if (month < 4) [reportedMonth, reportedDay] = [5, 16];
    else if (month < 5 || (month === 5 && day <= 15)) [reportedMonth, reportedDay] = [7, 1];
    else if (month < 7) [reportedMonth, reportedDay] = [8, 16];
    else if (month < 8 || (month === 8 && day <= 15)) [reportedMonth, reportedDay] = [10, 1];
    else if (month < 10) [reportedMonth, reportedDay] = [11, 16];
    else if (month < 11 || (month === 11 && day <= 15)) {
        [reportedMonth, reportedDay] = [1, 1];
        reportedYear++;
    } else {
        [reportedMonth, reportedDay] = [2, 16];
        reportedYear++;
    }
    return `${reportedYear}-${String(reportedMonth).padStart(2, '0')}-${String(reportedDay).padStart(2, '0')}`;
}

module.exports = { getReportedDateForDueDate };

const NON_CASH_REMARK = /\b(recon|reconstruct|reconstructed|reconstruction|deceased|dead|write[-\s]?off)\b/i;

function calculateReportedAmount(loan, payments, reportedDate) {
    const totalLoan = Number(loan.total_loan);
    if (!Number.isFinite(totalLoan) || totalLoan <= 0) {
        throw new Error(`Loan ${loan.id} has no valid total loan for reported amount recalculation.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportedDate)) {
        throw new Error(`Loan ${loan.id} has no exact reporting date.`);
    }

    // JCASH can contain source collections without itemized payment rows.
    // Its source adjustment matches the finance recalculation in dataStore.
    const recordedTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const sourceAdjustment = /^\d+$/.test(String(loan.id)) && loan.branch === 'Ormoc Branch'
        ? Math.max(0, Number(loan.amount_collected || 0) - recordedTotal)
        : 0;
    const cashBeforeReport = payments
        .filter(payment => payment.status !== 'REVERSED' && String(payment.date).slice(0, 10) < reportedDate && !NON_CASH_REMARK.test(payment.remarks || ''))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
        reportedAmount: Math.round(Math.max(0, totalLoan - sourceAdjustment - cashBeforeReport) * 100) / 100,
        sourceAdjustment: Math.round(sourceAdjustment * 100) / 100,
        cashBeforeReport: Math.round(cashBeforeReport * 100) / 100
    };
}

module.exports = { calculateReportedAmount };

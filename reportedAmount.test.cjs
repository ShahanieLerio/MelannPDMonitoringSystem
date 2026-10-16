const test = globalThis.test || require('node:test');
const assert = require('node:assert/strict');
const { getReportedDateForDueDate } = require('./reportingCycle.cjs');
const { calculateReportedAmount } = require('./reportedAmount.cjs');

test('45-day maturity cycles report on the next cycle after the grace cycle', () => {
    const cases = [
        ['2025-01-01', '2025-04-01'], ['2025-02-15', '2025-04-01'],
        ['2025-02-16', '2025-05-16'], ['2025-03-31', '2025-05-16'],
        ['2025-04-01', '2025-07-01'], ['2025-05-15', '2025-07-01'],
        ['2025-05-16', '2025-08-16'], ['2025-06-30', '2025-08-16'],
        ['2025-07-01', '2025-10-01'], ['2025-08-15', '2025-10-01'],
        ['2025-08-16', '2025-11-16'], ['2025-09-30', '2025-11-16'],
        ['2025-10-01', '2026-01-01'], ['2025-11-15', '2026-01-01'],
        ['2025-11-16', '2026-02-16'], ['2025-12-31', '2026-02-16']
    ];
    for (const [dueDate, expected] of cases) {
        assert.equal(getReportedDateForDueDate(dueDate), expected, dueDate);
    }
});

test('reported amount includes prior cash but not cash paid on the reporting day', () => {
    const loan = { id: '41062', branch: 'Ormoc Branch', total_loan: 1955, amount_collected: 300 };
    const payments = [
        { amount: 100, date: '2025-05-15', status: 'GOOD', remarks: '' },
        { amount: 100, date: '2025-05-16', status: 'GOOD', remarks: '' },
        { amount: 100, date: '2025-05-17', status: 'GOOD', remarks: '' }
    ];
    assert.deepEqual(calculateReportedAmount(loan, payments, '2025-05-16'), {
        reportedAmount: 1855, sourceAdjustment: 0, cashBeforeReport: 100
    });
});

test('reversed and noncash entries do not reduce the reported amount', () => {
    const loan = { id: '41062', branch: 'Ormoc Branch', total_loan: 1955, amount_collected: 300 };
    const payments = [
        { amount: 100, date: '2025-05-01', status: 'GOOD', remarks: '' },
        { amount: 100, date: '2025-05-02', status: 'REVERSED', remarks: '' },
        { amount: 100, date: '2025-05-03', status: 'GOOD', remarks: 'Reconstructed' }
    ];
    assert.equal(calculateReportedAmount(loan, payments, '2025-05-16').reportedAmount, 1855);
});

test('unitemized JCASH collections are deducted once', () => {
    const loan = { id: '41062', branch: 'Ormoc Branch', total_loan: 1955, amount_collected: 300 };
    const payments = [{ amount: 100, date: '2025-05-01', status: 'GOOD', remarks: '' }];
    assert.deepEqual(calculateReportedAmount(loan, payments, '2025-05-16'), {
        reportedAmount: 1655, sourceAdjustment: 200, cashBeforeReport: 100
    });
});

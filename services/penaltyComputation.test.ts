import { describe, expect, it } from 'vitest';
import { computePenaltySchedule, countMonthsFromPeriodLabel } from './penaltyComputation.ts';

describe('computePenaltySchedule', () => {
  it('computes ABAD, GEMMA using simple non-compounding penalty', () => {
    const schedule = computePenaltySchedule(4994, [
      { label: 'March 2024', paymentMade: 0, numberOfMonths: 1 },
      { label: 'Apr 2024 - May 2025', paymentMade: 200, numberOfMonths: 14 },
      { label: 'Jun 2025 - Dec 2025', paymentMade: 120, numberOfMonths: 7 },
      { label: 'Jan 2026 - May 2026', paymentMade: 750, numberOfMonths: 5 },
      { label: 'Jun 2026 - Jul 2026', paymentMade: 100, numberOfMonths: 2 },
    ]);

    expect(schedule.rows).toEqual([
      {
        period: 'March 2024',
        beginningOverdueBalance: 4994,
        paymentsMade: 0,
        balanceUsedForPenaltyBase: 4994,
        numberOfMonths: 1,
        monthlyPenalty: 249.7,
        penaltySubtotal: 249.7,
      },
      {
        period: 'Apr 2024 - May 2025',
        beginningOverdueBalance: 4994,
        paymentsMade: 200,
        balanceUsedForPenaltyBase: 4794,
        numberOfMonths: 14,
        monthlyPenalty: 239.7,
        penaltySubtotal: 3355.8,
      },
      {
        period: 'Jun 2025 - Dec 2025',
        beginningOverdueBalance: 4794,
        paymentsMade: 120,
        balanceUsedForPenaltyBase: 4674,
        numberOfMonths: 7,
        monthlyPenalty: 233.7,
        penaltySubtotal: 1635.9,
      },
      {
        period: 'Jan 2026 - May 2026',
        beginningOverdueBalance: 4674,
        paymentsMade: 750,
        balanceUsedForPenaltyBase: 3924,
        numberOfMonths: 5,
        monthlyPenalty: 196.2,
        penaltySubtotal: 981,
      },
      {
        period: 'Jun 2026 - Jul 2026',
        beginningOverdueBalance: 3924,
        paymentsMade: 100,
        balanceUsedForPenaltyBase: 3824,
        numberOfMonths: 2,
        monthlyPenalty: 191.2,
        penaltySubtotal: 382.4,
      },
    ]);
    expect(schedule.totalPayments).toBe(1170);
    expect(schedule.remainingOverdueBalance).toBe(3824);
    expect(schedule.totalPenaltyAccumulated).toBe(6604.8);
    expect(schedule.correctUpdatedAmountDue).toBe(10428.8);
  });
});

describe('countMonthsFromPeriodLabel', () => {
  it('auto-counts months from manual period labels', () => {
    expect(countMonthsFromPeriodLabel('Oct 2025 - Jan 2026')).toBe(4);
    expect(countMonthsFromPeriodLabel('October 2025 - January 2026')).toBe(4);
    expect(countMonthsFromPeriodLabel('March 2024')).toBe(1);
    expect(countMonthsFromPeriodLabel('Apr 2024 - May 2025')).toBe(14);
  });
});

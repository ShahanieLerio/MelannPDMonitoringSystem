import { describe, expect, it } from 'vitest';
import { get45DayReportedDate, getReportedStartDate } from './loanUtils';

describe('45-day reporting cycle', () => {
  it.each([
    ['2025-01-01', '2025-04-01'],
    ['2025-02-15', '2025-04-01'],
    ['2025-02-16', '2025-05-16'],
    ['2025-03-31', '2025-05-16'],
    ['2025-04-01', '2025-07-01'],
    ['2025-05-15', '2025-07-01'],
    ['2025-05-16', '2025-08-16'],
    ['2025-06-30', '2025-08-16'],
    ['2025-07-01', '2025-10-01'],
    ['2025-08-15', '2025-10-01'],
    ['2025-08-16', '2025-11-16'],
    ['2025-09-30', '2025-11-16'],
    ['2025-10-01', '2026-01-01'],
    ['2025-11-15', '2026-01-01'],
    ['2025-11-16', '2026-02-16'],
    ['2025-12-31', '2026-02-16'],
  ])('maps maturity %s to reporting date %s', (due, reported) => {
    expect(get45DayReportedDate(due)).toBe(reported);
  });

  it('keeps older reporting periods at month precision', () => {
    expect(get45DayReportedDate('2024-12-31')).toBe('');
    expect(getReportedStartDate('2024-08')).toBe('2024-08-01');
    expect(getReportedStartDate('2025-05-16')).toBe('2025-05-16');
  });
});

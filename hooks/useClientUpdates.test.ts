import { describe, expect, it } from 'vitest';
import { Branch, Loan, LocationStatus, MovingStatus, PriorityLevel } from '../types';
import { getActionRemarkForDate, getScheduledRemarkForDate, isRecurringDueOnDate } from './useClientUpdates';

const makeLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan-1',
  collector: 'SHAN',
  code: '1001',
  borrowerName: 'Dela Cruz, Juan',
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  monthReported: '2026-01',
  dueDate: '2026-01-31',
  outstandingBalance: 5000,
  amountCollected: 1000,
  runningBalance: 4000,
  status: MovingStatus.MOVING,
  location: LocationStatus.LOCATED,
  area: 'Area 1',
  city: 'Ormoc',
  barangay: 'District 1',
  fullAddress: 'District 1, Ormoc',
  payments: [],
  remarks: [],
  history: [],
  aiPriority: PriorityLevel.FOLLOW_UP,
  branch: Branch.ORMOC,
  ...overrides
});

describe('scheduled Field Intelligence remarks', () => {
  it('uses the exact follow-up remark instead of the recurring schedule note', () => {
    const loan = makeLoan({
      recurringSchedule: {
        enabled: true,
        type: 'weekly',
        days: [],
        weekDays: [6],
        nextDueDate: '2026-09-26',
        startDate: '2026-09-01',
        note: 'Kada Sabado ang bayad'
      },
      remarks: [
        {
          id: 'recurring-note',
          text: 'Kada Sabado ang bayad',
          timestamp: '2026-09-01T08:00:00Z',
          collector: 'SHAN'
        },
        {
          id: 'monday-follow-up',
          text: 'Follow up kay nisaad by Monday',
          timestamp: '2026-09-19T08:00:00Z',
          collector: 'SHAN',
          followUpDate: '2026-09-21'
        }
      ]
    });

    expect(getActionRemarkForDate(loan, '2026-09-21')?.text).toBe('Follow up kay nisaad by Monday');
    expect(getActionRemarkForDate(loan, '2026-09-26')?.text).toBe('Kada Sabado ang bayad');
  });

  it('keeps multiple dated remarks independently selectable by their schedule date', () => {
    const loan = makeLoan({
      remarks: [
        { id: 'first', text: 'First follow-up', timestamp: '2026-09-01T08:00:00Z', collector: 'SHAN', followUpDate: '2026-09-21' },
        { id: 'second', text: 'Second follow-up', timestamp: '2026-09-02T08:00:00Z', collector: 'SHAN', followUpDate: '2026-09-29' }
      ]
    });

    expect(getScheduledRemarkForDate(loan, '2026-09-21')?.text).toBe('First follow-up');
    expect(getScheduledRemarkForDate(loan, '2026-09-29')?.text).toBe('Second follow-up');
  });

  it('chooses the newest entry when the same date has more than one scheduled remark', () => {
    const loan = makeLoan({
      remarks: [
        { id: 'older', text: 'Old instruction', timestamp: '2026-09-01T08:00:00Z', collector: 'SHAN', ptpDate: '2026-09-29' },
        { id: 'newer', text: 'Updated instruction', timestamp: '2026-09-02T08:00:00Z', collector: 'SHAN', followUpDate: '2026-09-29' }
      ]
    });

    expect(getScheduledRemarkForDate(loan, '2026-09-29')?.text).toBe('Updated instruction');
  });

  it('detects weekly recurring dates using the requested local calendar date', () => {
    const loan = makeLoan({
      recurringSchedule: {
        enabled: true,
        type: 'weekly',
        days: [],
        weekDays: [6],
        nextDueDate: '2026-09-26'
      }
    });

    expect(isRecurringDueOnDate(loan, '2026-09-26')).toBe(true);
    expect(isRecurringDueOnDate(loan, '2026-09-21')).toBe(false);
  });
});

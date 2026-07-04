import { describe, expect, it } from 'vitest';
import { Branch, Loan, LocationStatus, MovingStatus, PaymentStatus } from '../types';
import { getPTPEscalationCases } from './ptpEscalation';

const makeEverydayLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan-everyday',
  collector: 'COLLECTOR',
  code: 'C-001',
  borrowerName: 'Everyday Client',
  firstName: 'Everyday',
  lastName: 'Client',
  monthReported: '2026-07',
  dueDate: '2026-07-31',
  outstandingBalance: 1000,
  amountCollected: 0,
  runningBalance: 1000,
  status: MovingStatus.MOVING,
  location: LocationStatus.LOCATED,
  area: '',
  city: '',
  barangay: '',
  fullAddress: '',
  payments: [],
  remarks: [],
  history: [],
  recurringSchedule: {
    enabled: true,
    type: 'everyday',
    days: [1, 2, 3, 4, 5, 6],
    weekDays: [1, 2, 3, 4, 5, 6],
    startDate: '2026-07-01',
    nextDueDate: '2026-07-01'
  },
  branch: Branch.ORMOC,
  ...overrides
});

describe('getPTPEscalationCases everyday schedules', () => {
  it('escalates after three consecutive unpaid Monday-Saturday commitments', () => {
    const cases = getPTPEscalationCases([makeEverydayLoan()], '2026-07-04');

    expect(cases).toHaveLength(1);
    expect(cases[0].missedCommitments.map(miss => miss.dueDate)).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03'
    ]);
  });

  it('skips Sunday when counting everyday missed commitment streaks', () => {
    const cases = getPTPEscalationCases([
      makeEverydayLoan({
        recurringSchedule: {
          enabled: true,
          type: 'everyday',
          days: [1, 2, 3, 4, 5, 6],
          weekDays: [1, 2, 3, 4, 5, 6],
          startDate: '2026-07-04',
          nextDueDate: '2026-07-04'
        }
      })
    ], '2026-07-08');

    expect(cases).toHaveLength(1);
    expect(cases[0].missedCommitments.map(miss => miss.dueDate)).toEqual([
      '2026-07-04',
      '2026-07-06',
      '2026-07-07'
    ]);
  });

  it('does not escalate everyday schedules when payments break the three-day streak', () => {
    const cases = getPTPEscalationCases([
      makeEverydayLoan({
        payments: [{
          id: 'payment-1',
          loanId: 'loan-everyday',
          date: '2026-07-02',
          orNumber: 'OR-1',
          amount: 100,
          balanceAfter: 900,
          recorder: 'cashier',
          status: PaymentStatus.GOOD,
          createdAt: '2026-07-02T08:00:00.000Z'
        }]
      })
    ], '2026-07-04');

    expect(cases).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { buildPartialPaymentTimelineItems } from './ClientActionTracker.tsx';
import { Payment, PaymentStatus } from '../types.ts';

const makePayment = (overrides: Partial<Payment> = {}): Payment => ({
    id: 'payment-1',
    loanId: 'loan-1',
    date: '2026-09-26',
    orNumber: 'OR-20260926-TEST',
    amount: 500,
    balanceAfter: 2500,
    recorder: 'admin',
    remarks: '',
    status: PaymentStatus.GOOD,
    createdAt: '2026-09-26T06:45:00.000Z',
    ...overrides
});

describe('Action Tracker payment timeline', () => {
    it('creates a visible timeline event for an active partial payment', () => {
        const [item] = buildPartialPaymentTimelineItems([
            makePayment({ remarks: 'Paid despite missed promise date' })
        ]);

        expect(item.type).toBe('Partial Payment');
        expect(item.user).toBe('admin');
        expect(item.payment?.orNumber).toBe('OR-20260926-TEST');
        expect(item.desc).toContain('₱500.00 received');
        expect(item.desc).toContain('Remaining balance: ₱2,500.00');
        expect(item.desc).toContain('Paid despite missed promise date');
    });

    it('omits reversed payments and payments that fully settled the loan', () => {
        const items = buildPartialPaymentTimelineItems([
            makePayment({ id: 'reversed', status: PaymentStatus.REVERSED }),
            makePayment({ id: 'fully-paid', balanceAfter: 0 })
        ]);

        expect(items).toEqual([]);
    });
});

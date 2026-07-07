import { describe, it, expect } from 'vitest';
import {
    UserRole,
    UserStatus,
    Branch,
    MovingStatus,
    LocationStatus,
    PriorityLevel,
    PaymentStatus,
    DemandLetterType,
    DemandLetterStatus,
    canManageUsers
} from './types';

describe('Types and Enums', () => {
    describe('UserRole', () => {
        it('should have correct role values', () => {
            expect(UserRole.SUPER_ADMIN).toBe('SUPER_ADMIN');
            expect(UserRole.COLLECTOR).toBe('COLLECTOR');
            expect(UserRole.CASHIER).toBe('CASHIER');
            expect(UserRole.SUPERVISOR).toBe('SUPERVISOR');
            expect(UserRole.IT_ACCOUNTING_CLERK).toBe('IT_ACCOUNTING_CLERK');
            expect(UserRole.BRANCH_MANAGER).toBe('BRANCH_MANAGER');
            expect(UserRole.OPERATIONS_MANAGER).toBe('OPERATIONS_MANAGER');
            expect(UserRole.EXECUTIVE_VICE_PRESIDENT).toBe('EXECUTIVE_VICE_PRESIDENT');
            expect(UserRole.PRESIDENT).toBe('PRESIDENT');
            expect(UserRole.NAVAL_USER).toBe('NAVAL_USER');
            expect(UserRole.ORMOC_USER).toBe('ORMOC_USER');
        });

        it('should have all required roles', () => {
            const roles = Object.values(UserRole);
            expect(roles).toHaveLength(11);
            expect(roles).toContain('SUPER_ADMIN');
            expect(roles).toContain('COLLECTOR');
            expect(roles).toContain('CASHIER');
            expect(roles).toContain('SUPERVISOR');
            expect(roles).toContain('IT_ACCOUNTING_CLERK');
            expect(roles).toContain('BRANCH_MANAGER');
            expect(roles).toContain('OPERATIONS_MANAGER');
            expect(roles).toContain('EXECUTIVE_VICE_PRESIDENT');
            expect(roles).toContain('PRESIDENT');
            expect(roles).toContain('NAVAL_USER');
            expect(roles).toContain('ORMOC_USER');
        });

        it('allows Branch Manager to manage user approvals', () => {
            expect(canManageUsers(UserRole.SUPER_ADMIN)).toBe(true);
            expect(canManageUsers(UserRole.BRANCH_MANAGER)).toBe(true);
            expect(canManageUsers(UserRole.IT_ACCOUNTING_CLERK)).toBe(false);
        });
    });

    describe('UserStatus', () => {
        it('should have correct status values', () => {
            expect(UserStatus.PENDING).toBe('PENDING');
            expect(UserStatus.ACTIVE).toBe('ACTIVE');
            expect(UserStatus.DEACTIVATED).toBe('DEACTIVATED');
        });

        it('should have all required statuses', () => {
            const statuses = Object.values(UserStatus);
            expect(statuses).toHaveLength(3);
        });
    });

    describe('Branch', () => {
        it('should have correct branch values', () => {
            expect(Branch.NAVAL).toBe('Naval Branch');
            expect(Branch.ORMOC).toBe('Ormoc Branch');
            expect(Branch.ALL).toBe('All Branches');
        });

        it('should have all required branches', () => {
            const branches = Object.values(Branch);
            expect(branches).toHaveLength(3);
        });
    });

    describe('MovingStatus', () => {
        it('should have correct moving status values', () => {
            expect(MovingStatus.PAID).toBe('Paid');
            expect(MovingStatus.MOVING).toBe('M');
            expect(MovingStatus.NM).toBe('NM');
            expect(MovingStatus.NMSR).toBe('NMSR');
        });

        it('should have all required moving statuses', () => {
            const statuses = Object.values(MovingStatus);
            expect(statuses).toHaveLength(4);
        });
    });

    describe('LocationStatus', () => {
        it('should have correct location status values', () => {
            expect(LocationStatus.LOCATED).toBe('L');
            expect(LocationStatus.NOT_LOCATED).toBe('NL');
        });

        it('should have all required location statuses', () => {
            const statuses = Object.values(LocationStatus);
            expect(statuses).toHaveLength(2);
        });
    });

    describe('PriorityLevel', () => {
        it('should have correct priority values', () => {
            expect(PriorityLevel.TOP).toBe('Top Priority');
            expect(PriorityLevel.NEED_ATTENTION).toBe('Need Attention / Full Commitment');
            expect(PriorityLevel.FOLLOW_UP).toBe('Follow-up');
            expect(PriorityLevel.MONITOR).toBe('Monitor Closely');
            expect(PriorityLevel.LOWEST).toBe('Lowest Priority');
        });

        it('should have all required priority levels', () => {
            const priorities = Object.values(PriorityLevel);
            expect(priorities).toHaveLength(5);
        });
    });

    describe('PaymentStatus', () => {
        it('should have correct payment status values', () => {
            expect(PaymentStatus.GOOD).toBe('GOOD');
            expect(PaymentStatus.REVERSED).toBe('REVERSED');
        });

        it('should have all required payment statuses', () => {
            const statuses = Object.values(PaymentStatus);
            expect(statuses).toHaveLength(2);
        });
    });

    describe('DemandLetterType', () => {
        it('should have correct demand letter types', () => {
            expect(DemandLetterType.FIRST).toBe('1st Demand Letter');
            expect(DemandLetterType.SECOND).toBe('2nd Demand Letter');
            expect(DemandLetterType.THIRD).toBe('3rd Demand Letter');
        });

        it('should have all required demand letter types', () => {
            const types = Object.values(DemandLetterType);
            expect(types).toHaveLength(3);
        });
    });

    describe('DemandLetterStatus', () => {
        it('should have correct demand letter status values', () => {
            expect(DemandLetterStatus.PENDING).toBe('Pending');
            expect(DemandLetterStatus.FOLLOW_UP).toBe('For Follow-Up');
            expect(DemandLetterStatus.SETTLED).toBe('Settled');
        });

        it('should have all required demand letter statuses', () => {
            const statuses = Object.values(DemandLetterStatus);
            expect(statuses).toHaveLength(3);
        });
    });

    describe('Type Interfaces', () => {
        it('should allow creating a valid User object', () => {
            const user = {
                id: '1',
                username: 'testuser',
                fullName: 'Test User',
                role: UserRole.NAVAL_USER,
                status: UserStatus.ACTIVE,
                branch: Branch.NAVAL,
                createdAt: '2024-01-01',
                statusHistory: []
            };

            expect(user.id).toBe('1');
            expect(user.role).toBe(UserRole.NAVAL_USER);
        });

        it('should allow creating a valid Loan object', () => {
            const loan = {
                id: 'l1',
                collector: 'John Doe',
                code: 'L001',
                borrowerName: 'Santos, Maria',
                firstName: 'Maria',
                lastName: 'Santos',
                monthReported: '2024-01',
                dueDate: '2024-02-15',
                outstandingBalance: 10000,
                amountCollected: 5000,
                runningBalance: 5000,
                status: MovingStatus.MOVING,
                location: LocationStatus.LOCATED,
                area: 'Area 1',
                city: 'Naval',
                barangay: 'Brgy 1',
                fullAddress: '123 Main St',
                payments: [],
                remarks: [],
                history: [],
                branch: Branch.NAVAL
            };

            expect(loan.id).toBe('l1');
            expect(loan.status).toBe(MovingStatus.MOVING);
        });

        it('should allow creating a valid Payment object', () => {
            const payment = {
                id: 'p1',
                loanId: 'l1',
                date: '2024-02-01',
                orNumber: 'OR-001',
                amount: 5000,
                balanceAfter: 5000,
                recorder: 'Admin',
                status: PaymentStatus.GOOD
            };

            expect(payment.id).toBe('p1');
            expect(payment.status).toBe(PaymentStatus.GOOD);
        });

        it('should allow creating a valid Collector object', () => {
            const collector = {
                id: 'c1',
                name: 'John Doe',
                nickname: 'JOHN',
                address: '123 Main St',
                branch: Branch.NAVAL
            };

            expect(collector.id).toBe('c1');
            expect(collector.branch).toBe(Branch.NAVAL);
        });

        it('should allow creating a valid DemandLetter object', () => {
            const demandLetter = {
                id: 'dl1',
                collectorName: 'John Doe',
                loanId: 'l1',
                borrowerName: 'Santos, Maria',
                type: DemandLetterType.FIRST,
                datePrepared: '2024-02-01',
                status: DemandLetterStatus.PENDING,
                remarks: 'First demand letter',
                branch: Branch.NAVAL
            };

            expect(demandLetter.id).toBe('dl1');
            expect(demandLetter.type).toBe(DemandLetterType.FIRST);
        });
    });
});

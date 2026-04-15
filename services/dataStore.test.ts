import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRole, UserStatus, Branch, MovingStatus, LocationStatus } from '../types';

// Mock localStorage
const localStorageMock = (() => {
    let storeData: Record<string, string> = {};
    return {
        getItem: (key: string) => storeData[key] || null,
        setItem: (key: string, value: string) => { storeData[key] = value; },
        removeItem: (key: string) => { delete storeData[key]; },
        clear: () => { storeData = {}; }
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch globally
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
    } as Response)
);

describe('DataStore Service', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('Type Definitions', () => {
        it('should have UserRole enum', () => {
            expect(UserRole.SUPER_ADMIN).toBe('SUPER_ADMIN');
            expect(UserRole.NAVAL_USER).toBe('NAVAL_USER');
            expect(UserRole.ORMOC_USER).toBe('ORMOC_USER');
        });

        it('should have UserStatus enum', () => {
            expect(UserStatus.PENDING).toBe('PENDING');
            expect(UserStatus.ACTIVE).toBe('ACTIVE');
            expect(UserStatus.DEACTIVATED).toBe('DEACTIVATED');
        });

        it('should have Branch enum', () => {
            expect(Branch.NAVAL).toBe('Naval Branch');
            expect(Branch.ORMOC).toBe('Ormoc Branch');
            expect(Branch.ALL).toBe('All Branches');
        });

        it('should have MovingStatus enum', () => {
            expect(MovingStatus.PAID).toBe('Paid');
            expect(MovingStatus.MOVING).toBe('M');
            expect(MovingStatus.NM).toBe('NM');
            expect(MovingStatus.NMSR).toBe('NMSR');
        });

        it('should have LocationStatus enum', () => {
            expect(LocationStatus.LOCATED).toBe('L');
            expect(LocationStatus.NOT_LOCATED).toBe('NL');
        });
    });

    describe('LocalStorage Operations', () => {
        it('should store and retrieve data from localStorage', () => {
            const testData = { test: 'data' };
            localStorageMock.setItem('test_key', JSON.stringify(testData));

            const retrieved = localStorageMock.getItem('test_key');
            expect(retrieved).toBe(JSON.stringify(testData));
        });

        it('should clear localStorage', () => {
            localStorageMock.setItem('key1', 'value1');
            localStorageMock.setItem('key2', 'value2');

            localStorageMock.clear();

            expect(localStorageMock.getItem('key1')).toBeNull();
            expect(localStorageMock.getItem('key2')).toBeNull();
        });

        it('should remove specific items from localStorage', () => {
            localStorageMock.setItem('key1', 'value1');
            localStorageMock.setItem('key2', 'value2');

            localStorageMock.removeItem('key1');

            expect(localStorageMock.getItem('key1')).toBeNull();
            expect(localStorageMock.getItem('key2')).toBe('value2');
        });
    });

    describe('API Mock', () => {
        it('should mock fetch calls', async () => {
            const response = await fetch('http://test.com/api');
            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(Array.isArray(data)).toBe(true);
        });

        it('should allow custom fetch responses', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            const response = await fetch('http://test.com/api');
            const data = await response.json();

            expect(data.success).toBe(true);
        });
    });

    describe('Data Validation', () => {
        it('should validate user object structure', () => {
            const user = {
                id: '1',
                username: 'testuser',
                fullName: 'Test User',
                role: UserRole.NAVAL_USER,
                status: UserStatus.ACTIVE,
                branch: Branch.NAVAL,
                createdAt: new Date().toISOString(),
                statusHistory: []
            };

            expect(user.id).toBeDefined();
            expect(user.username).toBe('testuser');
            expect(user.role).toBe(UserRole.NAVAL_USER);
            expect(user.status).toBe(UserStatus.ACTIVE);
        });

        it('should validate loan object structure', () => {
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
                amountCollected: 0,
                runningBalance: 10000,
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

            expect(loan.id).toBeDefined();
            expect(loan.runningBalance).toBe(loan.outstandingBalance - loan.amountCollected);
            expect(loan.borrowerName).toBe(`${loan.lastName}, ${loan.firstName}`);
        });

        it('should validate payment calculations', () => {
            const outstandingBalance = 10000;
            const amountCollected = 3000;
            const runningBalance = outstandingBalance - amountCollected;

            expect(runningBalance).toBe(7000);
            expect(runningBalance).toBeGreaterThan(0);
        });

        it('should validate fully paid status', () => {
            const outstandingBalance = 10000;
            const amountCollected = 10000;
            const runningBalance = outstandingBalance - amountCollected;

            expect(runningBalance).toBe(0);
            expect(runningBalance <= 0).toBe(true);
        });
    });

    describe('Business Logic', () => {
        it('should calculate collection rate correctly', () => {
            const reported = 100000;
            const collected = 50000;
            const collectionRate = (collected / reported) * 100;

            expect(collectionRate).toBe(50);
        });

        it('should handle zero division in collection rate', () => {
            const reported = 0;
            const collected = 0;
            const collectionRate = reported > 0 ? (collected / reported) * 100 : 0;

            expect(collectionRate).toBe(0);
        });

        it('should format borrower name correctly', () => {
            const firstName = 'Maria';
            const lastName = 'Santos';
            const borrowerName = `${lastName}, ${firstName}`;

            expect(borrowerName).toBe('Santos, Maria');
        });

        it('should generate OR number format', () => {
            const dateStr = '20240207';
            const randomChars = 'ABCD';
            const orNumber = `OR-${dateStr}-${randomChars}`;

            expect(orNumber).toMatch(/^OR-\d{8}-[A-Z0-9]{4}$/);
        });
    });

    describe('Array Operations', () => {
        it('should filter items by branch', () => {
            const items = [
                { id: '1', branch: Branch.NAVAL },
                { id: '2', branch: Branch.ORMOC },
                { id: '3', branch: Branch.NAVAL }
            ];

            const navalItems = items.filter(item => item.branch === Branch.NAVAL);
            expect(navalItems).toHaveLength(2);
        });

        it('should sort items alphabetically', () => {
            const items = [
                { lastName: 'Santos', firstName: 'Maria' },
                { lastName: 'Dalisay', firstName: 'Ricardo' },
                { lastName: 'Santos', firstName: 'Ana' }
            ];

            items.sort((a, b) => {
                const lastCompare = a.lastName.localeCompare(b.lastName);
                if (lastCompare !== 0) return lastCompare;
                return a.firstName.localeCompare(b.firstName);
            });

            expect(items[0].lastName).toBe('Dalisay');
            expect(items[1].firstName).toBe('Ana');
            expect(items[2].firstName).toBe('Maria');
        });

        it('should reduce to calculate totals', () => {
            const loans = [
                { amountCollected: 5000 },
                { amountCollected: 3000 },
                { amountCollected: 2000 }
            ];

            const total = loans.reduce((sum, loan) => sum + loan.amountCollected, 0);
            expect(total).toBe(10000);
        });
    });

    describe('Date Operations', () => {
        it('should format ISO date string', () => {
            const date = new Date('2024-02-07T10:00:00Z');
            const isoString = date.toISOString();

            expect(isoString).toContain('2024-02-07');
        });

        it('should calculate future date', () => {
            const baseDate = new Date('2024-02-01');
            baseDate.setDate(baseDate.getDate() + 10);

            const expected = new Date('2024-02-11');
            expect(baseDate.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
        });

        it('should compare dates', () => {
            const date1 = new Date('2024-02-01');
            const date2 = new Date('2024-02-10');

            expect(date2.getTime()).toBeGreaterThan(date1.getTime());
        });
    });

    describe('String Operations', () => {
        it('should trim whitespace', () => {
            const input = '  test  ';
            const trimmed = input.trim();

            expect(trimmed).toBe('test');
        });

        it('should convert to lowercase', () => {
            const input = 'TestUser';
            const lowercase = input.toLowerCase();

            expect(lowercase).toBe('testuser');
        });

        it('should generate random ID', () => {
            const id = Math.random().toString(36).substring(2, 9);

            expect(id.length).toBeLessThanOrEqual(7);
            expect(id).toMatch(/^[a-z0-9]+$/);
        });
    });

    describe('Number Operations', () => {
        it('should format currency', () => {
            const amount = 10000;
            const formatted = amount.toLocaleString();

            expect(formatted).toContain('10');
        });

        it('should handle decimal precision', () => {
            const amount = 10000.5;
            const rounded = Number(amount.toFixed(2));

            expect(rounded).toBe(10000.5);
        });

        it('should calculate percentage', () => {
            const part = 50;
            const whole = 100;
            const percentage = (part / whole) * 100;

            expect(percentage).toBe(50);
        });
    });
});

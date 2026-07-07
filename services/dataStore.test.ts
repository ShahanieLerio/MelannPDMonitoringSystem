import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRole, UserStatus, Branch, MovingStatus, LocationStatus, PaymentStatus, DispositionStatus, DispositionType, PriorityLevel } from '../types';

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

    describe('Daily Collection Report', () => {
        it('includes fully paid collections and excludes dead/deceased and approved write-off accounts', async () => {
            const { store } = await import('./dataStore');
            const baseLoan = {
                id: 'loan-base',
                collector: 'CABALLES',
                code: 'C-001',
                borrowerName: 'BASE, CLIENT',
                firstName: 'Base',
                lastName: 'Client',
                monthReported: '2026-05',
                dueDate: '2026-03-15',
                totalLoan: 1000,
                outstandingBalance: 1000,
                amountCollected: 0,
                runningBalance: 1000,
                status: MovingStatus.MOVING,
                location: LocationStatus.LOCATED,
                area: 'CARIGARA',
                city: 'Carigara',
                barangay: 'Poblacion',
                fullAddress: 'Carigara, Leyte',
                payments: [],
                remarks: [],
                history: [],
                branch: Branch.ORMOC
            };

            (store as any).collectors = [
                { id: 'collector-1', name: 'CABALLES', nickname: 'CABALLES', address: 'CARIGARA', branch: Branch.ORMOC }
            ];
            (store as any).managementDispositions = [
                {
                    id: 'disp-1',
                    loanId: 'loan-write-off',
                    type: DispositionType.PROSPECT_WRITE_OFF,
                    reason: 'Approved write-off',
                    evidence: [],
                    status: DispositionStatus.APPROVED,
                    decidedBy: 'admin',
                    decisionDate: '2026-06-20T00:00:00.000Z'
                }
            ];
            (store as any).loans = [
                {
                    ...baseLoan,
                    id: 'loan-paid',
                    borrowerName: 'FULLY PAID, CLIENT',
                    status: MovingStatus.PAID,
                    outstandingBalance: 0,
                    runningBalance: 0,
                    amountCollected: 1000,
                    payments: [{
                        id: 'pay-paid',
                        loanId: 'loan-paid',
                        date: '2026-06-20',
                        orNumber: 'OR-PAID',
                        amount: 1000,
                        balanceAfter: 0,
                        recorder: 'Admin',
                        remarks: '',
                        status: PaymentStatus.GOOD,
                        createdAt: '2026-06-20T08:00:00.000Z'
                    }]
                },
                {
                    ...baseLoan,
                    id: 'loan-deceased',
                    borrowerName: 'DECEASED, CLIENT',
                    remarks: [{ id: 'remark-1', text: 'Client deceased', timestamp: '2026-06-20T00:00:00.000Z', collector: 'CABALLES' }],
                    payments: [{
                        id: 'pay-deceased',
                        loanId: 'loan-deceased',
                        date: '2026-06-20',
                        orNumber: 'OR-DECEASED',
                        amount: 5000,
                        balanceAfter: 0,
                        recorder: 'Admin',
                        remarks: '',
                        status: PaymentStatus.GOOD,
                        createdAt: '2026-06-20T08:00:00.000Z'
                    }]
                },
                {
                    ...baseLoan,
                    id: 'loan-write-off',
                    borrowerName: 'WRITE OFF, CLIENT',
                    payments: [{
                        id: 'pay-write-off',
                        loanId: 'loan-write-off',
                        date: '2026-06-20',
                        orNumber: 'OR-WRITEOFF',
                        amount: 3000,
                        balanceAfter: 0,
                        recorder: 'Admin',
                        remarks: '',
                        status: PaymentStatus.GOOD,
                        createdAt: '2026-06-20T08:00:00.000Z'
                    }]
                },
                {
                    ...baseLoan,
                    id: 'loan-special-remarks',
                    borrowerName: 'SPECIAL REMARKS, CLIENT',
                    payments: [
                        {
                            id: 'pay-recon',
                            loanId: 'loan-special-remarks',
                            date: '2026-06-20',
                            orNumber: 'OR-RECON',
                            amount: 700,
                            balanceAfter: 300,
                            recorder: 'Admin',
                            remarks: 'Recon payment',
                            status: PaymentStatus.GOOD,
                            createdAt: '2026-06-20T08:00:00.000Z'
                        },
                        {
                            id: 'pay-dead',
                            loanId: 'loan-special-remarks',
                            date: '2026-06-20',
                            orNumber: 'OR-DEAD',
                            amount: 800,
                            balanceAfter: 0,
                            recorder: 'Admin',
                            remarks: 'Dead / Write-Off',
                            status: PaymentStatus.GOOD,
                            createdAt: '2026-06-20T09:00:00.000Z'
                        }
                    ]
                }
            ];

            const report = store.getDailyCollections('2026-06-20', '2026-06-20', Branch.ORMOC);

            expect(report.grandTotal).toBe(1000);
            expect(report.grandTotalAccounts).toBe(1);
            expect(report.transactions).toHaveLength(1);
            expect(report.transactions[0].borrowerName).toBe('FULLY PAID, CLIENT');
            expect(report.transactions[0].orNumber).toBe('OR-PAID');
        });
    });

    describe('Collector Performance', () => {
        it('keeps total accounts historical while active accounts exclude paid and terminal outcomes', async () => {
            const { store } = await import('./dataStore');
            const baseLoan = {
                id: 'collector-base',
                collector: 'OFFICE',
                code: 'CP-001',
                borrowerName: 'BASE, CLIENT',
                firstName: 'Base',
                lastName: 'Client',
                monthReported: '2026-06',
                dueDate: '2026-03-15',
                totalLoan: 1000,
                outstandingBalance: 1000,
                amountCollected: 0,
                runningBalance: 1000,
                status: MovingStatus.MOVING,
                location: LocationStatus.LOCATED,
                area: 'Ormoc',
                city: 'Ormoc',
                barangay: 'Poblacion',
                fullAddress: 'Ormoc, Leyte',
                payments: [],
                remarks: [],
                history: [],
                branch: Branch.ORMOC
            };

            (store as any).collectors = [
                { id: 'collector-office', name: 'OFFICE', nickname: 'OFFICE', address: 'Ormoc', branch: Branch.ORMOC }
            ];
            (store as any).managementDispositions = [];
            (store as any).loans = [
                {
                    ...baseLoan,
                    id: 'collector-active',
                    payments: [{
                        id: 'pay-active',
                        loanId: 'collector-active',
                        date: '2026-06-20',
                        orNumber: 'OR-ACTIVE',
                        amount: 200,
                        balanceAfter: 800,
                        recorder: 'Admin',
                        remarks: '',
                        status: PaymentStatus.GOOD,
                        createdAt: '2026-06-20T08:00:00.000Z'
                    }]
                },
                {
                    ...baseLoan,
                    id: 'collector-paid',
                    status: MovingStatus.PAID,
                    runningBalance: 0,
                    payments: [{
                        id: 'pay-paid',
                        loanId: 'collector-paid',
                        date: '2026-06-20',
                        orNumber: 'OR-PAID',
                        amount: 1000,
                        balanceAfter: 0,
                        recorder: 'Admin',
                        remarks: '',
                        status: PaymentStatus.GOOD,
                        createdAt: '2026-06-20T08:00:00.000Z'
                    }]
                },
                {
                    ...baseLoan,
                    id: 'collector-deceased',
                    remarks: [{ id: 'dead-remark', text: 'Client deceased', timestamp: '2026-06-20T00:00:00.000Z', collector: 'OFFICE' }]
                },
                {
                    ...baseLoan,
                    id: 'collector-reconstructed',
                    remarks: [{ id: 'recon-remark', text: 'Reconstructed account', timestamp: '2026-06-20T00:00:00.000Z', collector: 'OFFICE' }]
                },
                {
                    ...baseLoan,
                    id: 'collector-write-off',
                    actionStage: 'Write-off'
                }
            ];

            const [performance] = store.getCollectorPerformance(Branch.ORMOC);

            expect(performance.totalAccounts).toBe(5);
            expect(performance.activeAccountCount).toBe(1);
            expect(performance.reportedAmount).toBe(2000);
            expect(performance.collectedAmount).toBe(1200);
            expect(performance.runningBalance).toBe(800);
            expect(performance.collectionRate).toBe(60);
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
        it('persists recalculated balance when replacing a same-date payment', async () => {
            const { store } = await import('./dataStore');
            const loan = {
                id: '8456',
                collector: 'EPEN',
                code: '1218',
                borrowerName: 'FORTALIZA, ROCHELLE',
                firstName: 'ROCHELLE',
                lastName: 'FORTALIZA',
                monthReported: '2019-03',
                dueDate: '2019-03-30',
                totalLoan: 5450,
                outstandingBalance: 2710,
                amountCollected: 2440,
                runningBalance: 3010,
                status: MovingStatus.NM,
                location: LocationStatus.LOCATED,
                area: '',
                city: '',
                barangay: '',
                fullAddress: '',
                payments: [
                    {
                        id: 'p-0327',
                        loanId: '8456',
                        date: '2019-03-27',
                        orNumber: 'JCASH-152396',
                        amount: 150,
                        balanceAfter: 3010,
                        recorder: 'EPEN',
                        remarks: 'Migrated from jcashdb.mdb',
                        status: PaymentStatus.GOOD,
                        createdAt: '2026-06-16T05:27:05.713Z'
                    },
                    {
                        id: 'p-old',
                        loanId: '8456',
                        date: '2019-03-30',
                        orNumber: 'JCASH-153000',
                        amount: 150,
                        balanceAfter: 2860,
                        recorder: 'EPEN',
                        remarks: 'Migrated from jcashdb.mdb (REVERSED: wrong OR)',
                        status: PaymentStatus.REVERSED,
                        createdAt: '2026-06-16T05:27:05.713Z'
                    }
                ],
                remarks: [],
                history: [],
                branch: Branch.ORMOC
            };
            (store as any).loans = [loan];

            await store.recordPayment('8456', 150, '2019-03-30', '', 'Shan', UserRole.ORMOC_USER, 'OR-20260619-79FU');

            const postedPayment = (store as any).loans[0].payments.find((p: any) => p.orNumber === 'OR-20260619-79FU');
            expect(postedPayment.balanceAfter).toBe(2860);
            expect((store as any).loans[0].runningBalance).toBe(2860);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/payments'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"balanceAfter":2860')
                })
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/loans/8456'),
                expect.objectContaining({
                    method: 'PUT',
                    body: expect.stringContaining('"runningBalance":2860')
                })
            );
        });

        it('rebuilds migrated payment stream balances from total loan minus source remitted adjustment', async () => {
            const { store } = await import('./dataStore');
            const loan = {
                id: '11188',
                collector: 'PD BAYBAY',
                code: '1318',
                borrowerName: 'TOONG, DESERIE',
                firstName: 'DESERIE',
                lastName: 'TOONG',
                monthReported: '2019-09',
                dueDate: '2019-07-28',
                totalLoan: 13407,
                outstandingBalance: 11407,
                amountCollected: 5990,
                runningBalance: 7417,
                status: MovingStatus.NM,
                location: LocationStatus.LOCATED,
                area: '',
                city: '',
                barangay: '',
                fullAddress: '',
                payments: [
                    {
                        id: 'p-0112',
                        loanId: '11188',
                        date: '2026-01-12',
                        orNumber: 'JCASH-942318',
                        amount: 5980,
                        balanceAfter: 7417,
                        recorder: 'mia',
                        remarks: 'Migrated from jcashdb.mdb',
                        status: PaymentStatus.GOOD,
                        createdAt: '2026-01-12T00:00:00.000Z'
                    }
                ],
                remarks: [],
                history: [],
                branch: Branch.ORMOC
            };
            (store as any).loans = [loan];

            await store.recordPayment('11188', 20, '2026-02-05', '', 'Shan', UserRole.ORMOC_USER, 'JCASH-950501');

            const postedPayment = (store as any).loans[0].payments.find((p: any) => p.orNumber === 'JCASH-950501');
            expect((store as any).loans[0].payments[0].balanceAfter).toBe(7417);
            expect(postedPayment.balanceAfter).toBe(7397);
            expect((store as any).loans[0].amountCollected).toBe(6010);
            expect((store as any).loans[0].runningBalance).toBe(7397);
        });

        it('rebuilds stale JCASH payment balances on refresh instead of displaying stored zero balances', async () => {
            vi.resetModules();
            localStorageMock.clear();

            const stalePayments = [
                ['p-jan-09', '2026-01-09', 'JCASH-941418', 100, 3350, 'Migrated from jcashdb.mdb'],
                ['p-jan-12', '2026-01-12', 'JCASH-942191', 100, 3250, 'Migrated from jcashdb.mdb'],
                ['p-jan-13', '2026-01-13', 'JCASH-942703', 100, 3150, 'Migrated from jcashdb.mdb'],
                ['p-jan-21', '2026-01-21', 'JCASH-945109', 100, 3050, 'Migrated from jcashdb.mdb'],
                ['p-jan-22', '2026-01-22', 'JCASH-945477', 100, 2950, 'Migrated from jcashdb.mdb'],
                ['p-jan-28', '2026-01-28', 'JCASH-947551', 100, 2850, 'Migrated from jcashdb.mdb'],
                ['p-jan-30', '2026-01-30', 'JCASH-948262', 100, 2750, 'Migrated from jcashdb.mdb'],
                ['p-feb-10', '2026-02-10', 'JCASH-951999', 200, 2550, 'Migrated from jcashdb.mdb'],
                ['p-feb-13', '2026-02-13', 'JCASH-953906', 100, 2450, 'Migrated from jcashdb.mdb'],
                ['p-jun-02', '2026-06-02', 'OR-20260602-PSZK', 100, 0, ''],
                ['p-jun-03', '2026-06-03', 'OR-20260604-IS0X', 100, 0, ''],
                ['p-jun-04', '2026-06-04', 'OR-20260604-GB41', 200, 0, ''],
                ['p-jun-08', '2026-06-08', 'OR-20260608-Q1YR', 200, 0, ''],
                ['p-jun-09', '2026-06-09', 'OR-20260609-HOPA', 100, 0, ''],
                ['p-jun-10', '2026-06-10', 'OR-20260610-W7Y3', 100, 0, ''],
                ['p-jun-11', '2026-06-11', 'OR-20260611-YOL7', 100, 0, ''],
                ['p-jun-12', '2026-06-12', 'OR-20260612-ALPE', 200, 0, ''],
                ['p-jun-13', '2026-06-13', 'OR-20260613-45PJ', 100, 0, '']
            ].map(([id, date, orNumber, amount, balanceAfter, remarks]) => ({
                id,
                loan_id: '46995',
                date,
                or_number: orNumber,
                amount,
                balance_after: balanceAfter,
                recorder: 'Shan',
                status: PaymentStatus.GOOD,
                remarks,
                created_at: `${date}T08:00:00.000Z`
            }));

            (global.fetch as any).mockImplementation((url: string) => {
                let payload: any[] = [];
                if (url.includes('/loans')) {
                    payload = [{
                        id: '46995',
                        collector: 'TORRETA',
                        code: '3773',
                        borrower_name: 'GASPAN, REGIE',
                        first_name: 'REGIE',
                        last_name: 'GASPAN',
                        month_reported: '2026-01',
                        due_date: '2026-02-23',
                        total_loan: 3450,
                        outstanding_balance: 2450,
                        amount_collected: 1000,
                        running_balance: 2450,
                        status: MovingStatus.MOVING,
                        location: LocationStatus.LOCATED,
                        area: 'Isabel',
                        city: 'Villaba',
                        barangay: 'Tagbubunga',
                        full_address: '',
                        branch: Branch.ORMOC
                    }];
                } else if (url.includes('/payments')) {
                    payload = stalePayments;
                }
                return Promise.resolve({ ok: true, json: async () => payload } as Response);
            });

            const { store } = await import('./dataStore');
            await store.refresh();

            const [loan] = store.getLoans(Branch.ALL).filter(l => l.code === '3773');
            const latestPayment = loan.payments.find(p => p.orNumber === 'OR-20260613-45PJ');

            expect(latestPayment?.balanceAfter).toBe(1250);
            expect(loan.runningBalance).toBe(1250);
            expect(loan.amountCollected).toBe(2200);
        });

        it('syncs edited collector nicknames across loans, remarks, and demand letters', async () => {
            const { store } = await import('./dataStore');
            const loan = {
                id: 'loan-collector-sync',
                collector: 'EDDIE',
                code: 'SYNC-001',
                borrowerName: 'CABALLES, SAMPLE',
                firstName: 'SAMPLE',
                lastName: 'CABALLES',
                monthReported: '2026-03',
                dueDate: '2026-03-15',
                outstandingBalance: 1000,
                amountCollected: 0,
                runningBalance: 1000,
                status: MovingStatus.MOVING,
                location: LocationStatus.LOCATED,
                area: 'Carigara',
                city: 'Carigara',
                barangay: '',
                fullAddress: '',
                payments: [],
                remarks: [
                    {
                        id: 'remark-collector-sync',
                        loanId: 'loan-collector-sync',
                        text: 'Follow up',
                        timestamp: '2026-06-20T00:00:00.000Z',
                        collector: 'EDDIE'
                    }
                ],
                history: [],
                branch: Branch.ORMOC
            };

            (store as any).collectors = [
                { id: 'collector-1', name: 'Eddie Caballes', nickname: 'EDDIE', branch: Branch.ORMOC }
            ];
            (store as any).loans = [loan];
            (store as any).demandLetters = [
                {
                    id: 'dl-collector-sync',
                    loanId: 'loan-collector-sync',
                    borrowerName: 'CABALLES, SAMPLE',
                    collectorName: 'EDDIE',
                    type: '1st Demand Letter',
                    datePrepared: '2026-06-20',
                    status: 'Pending',
                    remarks: '',
                    branch: Branch.ORMOC
                }
            ];
            (store as any).deletedLoans = [];

            await store.updateCollector('collector-1', 'Eddie Caballes', Branch.ORMOC, 'Carigara', 'CABALLES');

            expect((store as any).loans[0].collector).toBe('CABALLES');
            expect((store as any).loans[0].remarks[0].collector).toBe('CABALLES');
            expect((store as any).demandLetters[0].collectorName).toBe('CABALLES');
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/loans/loan-collector-sync'),
                expect.objectContaining({
                    method: 'PUT',
                    body: expect.stringContaining('"collector":"CABALLES"')
                })
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/remarks/remark-collector-sync'),
                expect.objectContaining({
                    method: 'PUT',
                    body: expect.stringContaining('"collector":"CABALLES"')
                })
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/demand_letters/dl-collector-sync'),
                expect.objectContaining({
                    method: 'PUT',
                    body: expect.stringContaining('"collectorName":"CABALLES"')
                })
            );
        });

        it('uses active collector nickname in performance data even when loans still contain legacy labels', async () => {
            const { store } = await import('./dataStore');
            (store as any).collectors = [
                { id: 'collector-1', name: 'Eddie Caballes', nickname: 'CABALLES', branch: Branch.ORMOC },
                { id: 'collector-2', name: 'Renato Dominggono', nickname: 'DOMINGGONO', branch: Branch.ORMOC },
                { id: 'collector-3', name: 'Reynaldo Laude', nickname: 'LAUDE', branch: Branch.ORMOC },
                { id: 'collector-4', name: 'Angelito Torreta', nickname: 'TORRETA', branch: Branch.ORMOC }
            ];
            (store as any).loans = [
                {
                    id: 'loan-legacy-display',
                    collector: 'EDDIE',
                    code: 'SYNC-002',
                    borrowerName: 'CABALLES, LEGACY',
                    firstName: 'LEGACY',
                    lastName: 'CABALLES',
                    monthReported: '2026-03',
                    dueDate: '2026-03-15',
                    outstandingBalance: 1000,
                    amountCollected: 250,
                    runningBalance: 750,
                    status: MovingStatus.MOVING,
                    location: LocationStatus.LOCATED,
                    area: 'Carigara',
                    city: 'Carigara',
                    barangay: '',
                    fullAddress: '',
                    payments: [],
                    remarks: [],
                    history: [],
                    branch: Branch.ORMOC
                },
                {
                    id: 'loan-legacy-renato',
                    collector: 'MASOY',
                    code: 'SYNC-003',
                    borrowerName: 'DOMINGGONO, LEGACY',
                    firstName: 'LEGACY',
                    lastName: 'DOMINGGONO',
                    monthReported: '2026-03',
                    dueDate: '2026-03-16',
                    outstandingBalance: 1000,
                    amountCollected: 250,
                    runningBalance: 750,
                    status: MovingStatus.MOVING,
                    location: LocationStatus.LOCATED,
                    area: 'Baybay',
                    city: 'Baybay',
                    barangay: '',
                    fullAddress: '',
                    payments: [],
                    remarks: [
                        {
                            id: 'remark-legacy-renato',
                            loanId: 'loan-legacy-renato',
                            text: 'Imported spelling variant',
                            timestamp: '2026-06-20T00:00:00.000Z',
                            collector: 'DOMINGONO'
                        }
                    ],
                    history: [],
                    branch: Branch.ORMOC
                },
                {
                    id: 'loan-legacy-reynaldo',
                    collector: 'TATA',
                    code: 'SYNC-004',
                    borrowerName: 'LAUDE, LEGACY',
                    firstName: 'LEGACY',
                    lastName: 'LAUDE',
                    monthReported: '2026-03',
                    dueDate: '2026-03-17',
                    outstandingBalance: 1000,
                    amountCollected: 250,
                    runningBalance: 750,
                    status: MovingStatus.MOVING,
                    location: LocationStatus.LOCATED,
                    area: 'San Isidro',
                    city: 'San Isidro',
                    barangay: '',
                    fullAddress: '',
                    payments: [],
                    remarks: [],
                    history: [],
                    branch: Branch.ORMOC
                },
                {
                    id: 'loan-legacy-angelito',
                    collector: 'LITO',
                    code: 'SYNC-005',
                    borrowerName: 'TORRETA, LEGACY',
                    firstName: 'LEGACY',
                    lastName: 'TORRETA',
                    monthReported: '2026-03',
                    dueDate: '2026-03-18',
                    outstandingBalance: 1000,
                    amountCollected: 250,
                    runningBalance: 750,
                    status: MovingStatus.MOVING,
                    location: LocationStatus.LOCATED,
                    area: 'Isabel',
                    city: 'Isabel',
                    barangay: '',
                    fullAddress: '',
                    payments: [],
                    remarks: [],
                    history: [],
                    branch: Branch.ORMOC
                }
            ];

            expect(store.getCollectorPerformance(Branch.ORMOC)[0].collector).toBe('CABALLES');
            const displayLoans = store.getLoans(Branch.ORMOC);
            expect(displayLoans.find(loan => loan.id === 'loan-legacy-renato')?.collector).toBe('DOMINGGONO');
            expect(displayLoans.find(loan => loan.id === 'loan-legacy-renato')?.remarks[0].collector).toBe('DOMINGGONO');
            expect(displayLoans.find(loan => loan.id === 'loan-legacy-reynaldo')?.collector).toBe('LAUDE');
            expect(displayLoans.find(loan => loan.id === 'loan-legacy-angelito')?.collector).toBe('TORRETA');
        });

        it('clears stale loan commitment dates when the latest remark is edited without dates', async () => {
            const { store } = await import('./dataStore');
            (store as any).collectors = [
                { id: 'collector-1', name: 'TORRETA', nickname: 'TORRETA', branch: Branch.ORMOC }
            ];
            (store as any).loans = [{
                id: 'loan-remark-date-sync',
                collector: 'TORRETA',
                code: 'SYNC-006',
                borrowerName: 'DATE, CLIENT',
                firstName: 'CLIENT',
                lastName: 'DATE',
                monthReported: '2026-03',
                dueDate: '2026-03-15',
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
                remarks: [{
                    id: 'remark-date-sync',
                    text: 'Promise to pay tomorrow',
                    timestamp: '2026-06-20T00:00:00.000Z',
                    collector: 'TORRETA',
                    ptpDate: '2026-06-21',
                    followUpDate: '2026-06-22'
                }],
                history: [],
                promiseToPayDate: '2026-06-21',
                followUpDate: '2026-06-22',
                aiPriority: PriorityLevel.FOLLOW_UP,
                branch: Branch.ORMOC
            }];

            await store.updateRemark(
                'loan-remark-date-sync',
                'remark-date-sync',
                'Updated field note only',
                PriorityLevel.NEED_ATTENTION,
                'Admin',
                UserRole.SUPER_ADMIN,
                null,
                null
            );

            const [loan] = store.getLoans(Branch.ORMOC).filter(l => l.id === 'loan-remark-date-sync');
            expect(loan.remarks[0].text).toBe('Updated field note only');
            expect(loan.remarks[0].ptpDate).toBeNull();
            expect(loan.remarks[0].followUpDate).toBeNull();
            expect(loan.promiseToPayDate).toBeNull();
            expect(loan.followUpDate).toBeNull();
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/loans/loan-remark-date-sync'),
                expect.objectContaining({
                    method: 'PUT',
                    body: expect.stringContaining('"promiseToPayDate":null')
                })
            );
        });

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

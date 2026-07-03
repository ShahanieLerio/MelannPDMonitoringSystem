import { Loan, MovingStatus, LocationStatus, Payment, PaymentStatus, User, UserRole, UserStatus, CollectorPerformance, Remark, PriorityLevel, Collector, DemandLetter, DemandLetterType, DemandLetterStatus, Branch, HistoryRecord, RecurringSchedule, VisitLog, VisitLogAction, ContactLog, ContactMethod, DeletedLoan, MigrationBatch, ManagementDisposition, DispositionType, DispositionStatus, isAllBranchRole, canApproveWriteOff } from '../types';
import { dedupeCollectors, getCollectorDisplayMatchKeys, getCollectorDisplayName, hasDuplicateCollectorIdentity, normalizeCollectorAliasKey, normalizeCollectorKey, normalizeCollectorLooseKey } from './collectorUtils';
import { hasActiveClientBalance, isLoanAllowedInActivePortfolio, isLoanMaturityInActivePortfolioRange, isReportableCollectionPayment } from './loanUtils';
const API_URL = `http://${window.location.hostname}:5000/api`;

const INITIAL_USERS: User[] = [
  {
    id: '1',
    username: 'admin',
    fullName: 'System Administrator',
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    branch: Branch.ALL,
    createdAt: new Date().toISOString(),
    statusHistory: [{ status: UserStatus.ACTIVE, updatedAt: new Date().toISOString(), updatedBy: 'System' }]
  },
];

const INITIAL_COLLECTORS: Collector[] = [
  { id: 'c1', name: 'John Doe', nickname: 'JOHN', address: '123 Collector St, Baybay City', branch: Branch.NAVAL },
];

const INITIAL_LOANS: Loan[] = [
  {
    id: 'l1',
    collector: 'John Doe',
    code: '1001',
    firstName: 'Maria',
    lastName: 'Santos',
    borrowerName: 'Santos, Maria',
    monthReported: '2023-10',
    dueDate: '2023-11-15',
    outstandingBalance: 50000,
    amountCollected: 15000,
    runningBalance: 35000,
    status: MovingStatus.MOVING,
    location: LocationStatus.LOCATED,
    area: 'Area 1',
    city: 'Quezon City',
    barangay: 'San Bartolome',
    fullAddress: '123 Main St, Brgy. San Bartolome, QC',
    payments: [],
    remarks: [
      { id: 'r1', text: 'Promised to pay tomorrow morning.', timestamp: new Date().toISOString(), collector: 'John Doe' }
    ],
    history: [],
    aiPriority: PriorityLevel.TOP,
    promiseToPayDate: null,
    branch: Branch.NAVAL
  }
];

class DataStore {
  private loans: Loan[] = [];
  private users: User[] = [];
  private collectors: Collector[] = [];
  private demandLetters: DemandLetter[] = [];
  private visitLogs: VisitLog[] = [];
  private contactLogs: ContactLog[] = [];
  private deletedLoans: DeletedLoan[] = [];
  private managementDispositions: ManagementDisposition[] = [];
  private listeners: (() => void)[] = [];

  private getCollectorDisplayName(collector?: string | null) {
    return getCollectorDisplayName(collector, this.collectors);
  }

  private hashPassword(password: string): string {
    const input = `melann-v1:${password}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `melann-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  private normalizeCollectorReferences(matchNames: (string | undefined)[], activeName: string) {
    const matchKeys = new Set(matchNames.flatMap(name => [
      normalizeCollectorKey(name),
      normalizeCollectorAliasKey(name),
      normalizeCollectorLooseKey(name)
    ]).filter(Boolean));
    const activeCollector = this.collectors.find(c => normalizeCollectorKey(c.nickname || c.name) === normalizeCollectorKey(activeName));
    activeCollector?.name
      .split(' ')
      .forEach(namePart => {
        const normalized = normalizeCollectorKey(namePart);
        if (normalized) matchKeys.add(normalized);
      });
    if (activeCollector) {
      getCollectorDisplayMatchKeys(activeCollector).forEach(key => matchKeys.add(key));
    }
    const shouldUpdate = (value?: string | null) => {
      const key = normalizeCollectorKey(value);
      const aliasKey = normalizeCollectorAliasKey(value);
      const looseKey = normalizeCollectorLooseKey(value);
      return matchKeys.has(key) ||
        Boolean(aliasKey && matchKeys.has(aliasKey)) ||
        Boolean(looseKey && matchKeys.has(looseKey));
    };
    const normalizedActiveName = normalizeCollectorKey(activeName);

    const affectedLoans: Loan[] = [];
    const affectedRemarks: Remark[] = [];
    const affectedDemandLetters: DemandLetter[] = [];

    this.loans.forEach(loan => {
      let loanChanged = false;

      if (shouldUpdate(loan.collector)) {
        loan.collector = normalizedActiveName;
        loanChanged = true;
      }

      loan.remarks.forEach(remark => {
        if (shouldUpdate(remark.collector)) {
          remark.collector = normalizedActiveName;
          affectedRemarks.push(remark);
          loanChanged = true;
        }
      });

      if (loanChanged) {
        affectedLoans.push(loan);
      }
    });

    this.demandLetters.forEach(dl => {
      if (shouldUpdate(dl.collectorName)) {
        dl.collectorName = normalizedActiveName;
        affectedDemandLetters.push(dl);
      }
    });

    this.deletedLoans.forEach(deleted => {
      if (shouldUpdate(deleted.originalLoanData.collector)) {
        deleted.originalLoanData.collector = normalizedActiveName;
      }
      deleted.originalLoanData.remarks?.forEach(remark => {
        if (shouldUpdate(remark.collector)) {
          remark.collector = normalizedActiveName;
        }
      });
    });

    return { affectedLoans, affectedRemarks, affectedDemandLetters };
  }

  constructor() {
    this.loadFromLocalStorage();
    this.refresh();
  }

  async refresh() {
    try {
      console.log('Syncing with Local PostgreSQL via Bridge...');
      const [dbLoans, dbUsers, dbCollectors, dbDLs, dbPayments, dbRemarks, dbLogs, dbVisitLogs, dbContactLogs, dbDeletedLoans, dbDispositions] = await Promise.all([
        fetch(`${API_URL}/loans`).then(r => r.json()),
        fetch(`${API_URL}/users`).then(r => r.json()),
        fetch(`${API_URL}/collectors`).then(r => r.json()),
        fetch(`${API_URL}/demand_letters`).then(r => r.json()),
        fetch(`${API_URL}/payments`).then(r => r.json()),
        fetch(`${API_URL}/remarks`).then(r => r.json()),
        fetch(`${API_URL}/activity_logs`).then(r => r.json()),
        fetch(`${API_URL}/visit_logs`).then(r => r.json()),
        fetch(`${API_URL}/contact_logs`).then(r => r.json()),
        fetch(`${API_URL}/recycle_bin`).then(r => r.json()),
        fetch(`${API_URL}/management_dispositions`).then(r => r.json()).catch(() => [])
      ]);

      // Mapping logic...
      const parseJson = (val: any) => {
        if (typeof val === 'string') {
          try { return JSON.parse(val); } catch (e) { return val; }
        }
        return val;
      };

      const mappedCollectors = dedupeCollectors(dbCollectors.map((c: any) => {
        const existingCollector = this.collectors.find(local => local.id === c.id);
        return {
          ...c,
          assignedSupervisor: c.assignedSupervisor || c.assigned_supervisor || existingCollector?.assignedSupervisor || '',
          photoUrl: c.photoUrl || c.photo_url || existingCollector?.photoUrl || '',
        };
      }) as Collector[]);

      const mappedLoans = dbLoans.map((l: any) => ({
        id: l.id,
        collector: getCollectorDisplayName(l.collector || 'UNASSIGNED', mappedCollectors),
        code: l.code || 'N/A',
        firstName: l.first_name || '',
        lastName: l.last_name || '',
        outstandingBalance: Number(l.outstanding_balance || 0),
        amountCollected: Number(l.amount_collected || 0),
        runningBalance: Number(l.running_balance || 0),
        borrowerName: l.borrower_name || 'Unnamed Client',
        monthReported: l.month_reported || '',
        dueDate: l.due_date || '',
        dateRelease: l.date_release || null,
        principal: l.principal != null ? Number(l.principal) : null,
        totalLoan: l.total_loan != null ? Number(l.total_loan) : null,
        status: l.status || MovingStatus.MOVING,
        location: l.location || LocationStatus.LOCATED,
        area: l.area || 'N/A',
        city: l.city || 'N/A',
        barangay: l.barangay || 'N/A',
        fullAddress: l.full_address || '',
        contactNumber: l.contact_number || 'N/A',
        promiseToPayDate: l.promise_to_pay_date || null,
        followUpDate: l.follow_up_date || null,
        aiPriority: l.ai_priority,
        recurringSchedule: parseJson(l.recurring_schedule) || null,
        actionNote: l.action_note || null,
        actionStage: l.action_stage || null,
        branch: l.branch || Branch.ALL,
        payments: dbPayments.filter((p: any) => p.loan_id === l.id).map((p: any) => ({ 
          id: p.id,
          loanId: p.loan_id, 
          date: p.date,
          amount: Number(p.amount), 
          balanceAfter: Number(p.balance_after), 
          orNumber: p.or_number || p.orNumber,
          recorder: p.recorder,
          remarks: p.remarks,
          status: p.status,
          createdAt: p.created_at || p.createdAt || new Date(p.date).toISOString()
        })) as unknown as Payment[],
        remarks: dbRemarks.filter((r: any) => r.loan_id === l.id).map((r: any) => ({ 
          id: r.id, 
          text: r.text, 
          timestamp: r.timestamp, 
          collector: getCollectorDisplayName(r.collector, mappedCollectors),
          ptpDate: r.ptp_date, 
          followUpDate: r.follow_up_date 
        })) as unknown as Remark[],
        history: dbLogs.filter((log: any) => log.loan_id === l.id).map((log: any) => ({ 
          id: log.id, 
          timestamp: log.timestamp, 
          type: log.type, 
          description: log.description, 
          user: log.user_name, 
          role: log.user_role, 
          module: log.module 
        })) as unknown as HistoryRecord[]
      }));

      // Conservative Merge Rule:
      // Don't wipe local loans that haven't synced to server yet
      const serverIDs = new Set(mappedLoans.map(l => l.id));
      const localOnly = this.loans.filter(l => !serverIDs.has(l.id));
      
      this.loans = [...mappedLoans, ...localOnly].filter(isLoanAllowedInActivePortfolio);

      // Auto-sync offline loans to backend
      if (localOnly.length > 0) {
        console.log(`Auto-syncing ${localOnly.length} offline loans to server...`);
        this.api('/loans/bulk', 'POST', localOnly).then(() => {
            console.log('Offline loans synced successfully.');
        }).catch(err => {
            console.error('Failed to auto-sync offline loans:', err);
        });
      }

      // Authoritative sync: Recalculate each loan's finances based on their transaction history
      // Also sync interaction dates (PTP/FollowUp) from remarks → loan fields so
      // checkIsPriority in ClientUpdate sees the correct promiseToPayDate / followUpDate.
      this.loans.forEach(loan => {
        if (this.isPreservedPaidMonitoringLoan(loan)) {
          this.syncPreservedPaidMonitoringLoan(loan);
        } else {
          this.recalculateLoanFinances(loan.id);
        }
        this.syncLoanInteractionDates(loan.id);
      });

      this.users = dbUsers.map((u: any) => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        passwordHash: u.password_hash || u.passwordHash,
        role: u.role,
        status: u.status,
        branch: u.branch,
        statusHistory: parseJson(u.status_history) || [],
        createdAt: u.created_at,
        createdBy: u.created_by
      }));

      this.collectors = mappedCollectors;
      this.demandLetters = dbDLs.map((d: any) => ({
        id: d.id,
        loanId: d.loan_id,
        collectorName: getCollectorDisplayName(d.collector_name, mappedCollectors),
        borrowerName: d.borrower_name,
        type: d.type,
        datePrepared: d.date_prepared,
        dateReceived: d.date_received,
        followUpDate: d.follow_up_date,
        status: d.status,
        remarks: d.remarks,
        branch: d.branch,
        courrier: d.courrier
      })) as unknown as DemandLetter[];

      this.visitLogs = (dbVisitLogs || []).map((v: any) => ({
        id: v.id,
        loanId: v.loan_id,
        visitDate: v.visit_date,
        collectorNotes: v.collector_notes,
        clientComment: v.client_comment || '',
        visitedByCollector: v.visited_by_collector || false,
        action: v.action || VisitLogAction.LOG_ONLY,
        loggedBy: v.logged_by,
        timestamp: v.timestamp
      })) as VisitLog[];

      this.contactLogs = (dbContactLogs || []).map((c: any) => ({
        id: c.id,
        loanId: c.loan_id,
        contactDate: c.contact_date,
        method: c.method || ContactMethod.CALL,
        notes: c.notes,
        clientResponse: c.client_response || '',
        hasResponse: c.has_response || false,
        loggedBy: c.logged_by,
        timestamp: c.timestamp
      })) as ContactLog[];

      this.deletedLoans = (dbDeletedLoans || []).map((d: any) => this.mapDeletedLoan(d));

      this.managementDispositions = (dbDispositions || []).map((d: any) => ({
        id: d.id,
        loanId: d.loan_id,
        type: d.type as DispositionType,
        reason: d.reason,
        evidence: typeof d.evidence === 'string' ? JSON.parse(d.evidence) : d.evidence,
        status: d.status as DispositionStatus,
        decidedBy: d.decided_by,
        decisionDate: d.decision_date
      })) as ManagementDisposition[];

    } catch (err) {
      console.error('DB Sync Error, falling back to LocalStorage:', err);
      if (this.loans.length === 0) {
        this.loadFromLocalStorage();
      }
    }
    this.notify();
  }

  private async api(path: string, method: string = 'GET', body?: any) {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`API Error: ${await res.text()}`);
    return res.json();
  }

  private mapMigrationBatch(row: any): MigrationBatch {
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
    return {
      id: row.id,
      cycleStart: row.cycle_start || row.cycleStart,
      cycleEnd: row.cycle_end || row.cycleEnd,
      status: row.status,
      detectedCount: Number(row.detected_count ?? row.detectedCount ?? 0),
      paymentCount: Number(row.payment_count ?? row.paymentCount ?? 0),
      payload,
      sourcePath: row.source_path || row.sourcePath || payload.sourcePath || '',
      detectedAt: row.detected_at || row.detectedAt,
      migratedAt: row.migrated_at || row.migratedAt || null,
      migratedBy: row.migrated_by || row.migratedBy || null,
      error: row.error || null
    };
  }

  private mapDeletedLoan(row: any): DeletedLoan {
    const rawLoan = typeof row.original_loan_data === 'string'
      ? JSON.parse(row.original_loan_data)
      : (row.original_loan_data || {});
    const fallbackName = `${rawLoan.last_name || rawLoan.lastName || ''}, ${rawLoan.first_name || rawLoan.firstName || ''}`.trim();
    const originalLoanData = {
      ...rawLoan,
      id: rawLoan.id || row.id,
      code: String(rawLoan.code ?? ''),
      firstName: rawLoan.firstName ?? rawLoan.first_name ?? '',
      lastName: rawLoan.lastName ?? rawLoan.last_name ?? '',
      borrowerName: rawLoan.borrowerName ?? rawLoan.borrower_name ?? fallbackName,
      monthReported: rawLoan.monthReported ?? rawLoan.month_reported ?? '',
      dueDate: rawLoan.dueDate ?? rawLoan.due_date ?? '',
      dateRelease: rawLoan.dateRelease ?? rawLoan.date_release ?? null,
      outstandingBalance: Number(rawLoan.outstandingBalance ?? rawLoan.outstanding_balance ?? 0),
      amountCollected: Number(rawLoan.amountCollected ?? rawLoan.amount_collected ?? 0),
      runningBalance: Number(rawLoan.runningBalance ?? rawLoan.running_balance ?? 0),
      totalLoan: rawLoan.totalLoan ?? rawLoan.total_loan ?? null,
      fullAddress: rawLoan.fullAddress ?? rawLoan.full_address ?? '',
      contactNumber: rawLoan.contactNumber ?? rawLoan.contact_number ?? '',
      aiPriority: rawLoan.aiPriority ?? rawLoan.ai_priority ?? PriorityLevel.LOWEST,
      promiseToPayDate: rawLoan.promiseToPayDate ?? rawLoan.promise_to_pay_date ?? null,
      followUpDate: rawLoan.followUpDate ?? rawLoan.follow_up_date ?? null,
      recurringSchedule: rawLoan.recurringSchedule ?? rawLoan.recurring_schedule ?? null,
      actionNote: rawLoan.actionNote ?? rawLoan.action_note ?? null,
      actionStage: rawLoan.actionStage ?? rawLoan.action_stage ?? null,
      payments: rawLoan.payments || [],
      remarks: rawLoan.remarks || [],
      history: rawLoan.history || []
    } as Loan;

    return {
      id: row.id,
      originalLoanData,
      deletedBy: row.deleted_by || row.deletedBy || 'Unknown',
      deletedAt: row.deleted_at || row.deletedAt || new Date().toISOString(),
      reason: row.reason,
      branch: row.branch || originalLoanData.branch || Branch.ALL
    };
  }

  private loadFromLocalStorage() {
    const savedLoans = localStorage.getItem('melann_loans');
    const savedUsers = localStorage.getItem('melann_users');
    const savedCollectors = localStorage.getItem('melann_collectors');
    const savedDemandLetters = localStorage.getItem('melann_demand_letters');
    this.loans = (savedLoans ? JSON.parse(savedLoans).map((l: any) => ({ ...l, history: l.history || [] })) : INITIAL_LOANS.map(l => ({ ...l, history: [] }))).filter(isLoanAllowedInActivePortfolio);
    this.users = savedUsers ? JSON.parse(savedUsers).map((u: any) => ({ ...u, statusHistory: u.statusHistory || [] })) : INITIAL_USERS;
    this.collectors = dedupeCollectors(savedCollectors ? JSON.parse(savedCollectors) : INITIAL_COLLECTORS);
    this.demandLetters = savedDemandLetters ? JSON.parse(savedDemandLetters) : [];
    this.loans = this.loans.map(loan => ({
      ...loan,
      collector: this.getCollectorDisplayName(loan.collector),
      remarks: (loan.remarks || []).map(remark => ({
        ...remark,
        collector: this.getCollectorDisplayName(remark.collector)
      }))
    }));
    this.demandLetters = this.demandLetters.map(dl => ({
      ...dl,
      collectorName: this.getCollectorDisplayName(dl.collectorName)
    }));
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private sortLoans() {
    this.loans.sort((a, b) => {
      const lastCompare = a.lastName.localeCompare(b.lastName);
      if (lastCompare !== 0) return lastCompare;
      return a.firstName.localeCompare(b.firstName);
    });
  }

  private notify() {
    this.sortLoans();
    this.listeners.forEach(l => l());
  }

  private async recordHistory(loanId: string, type: string, description: string, user: string, role: string, module: string) {
    const id = Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();

    // Transactional: Await server confirmation before local memory update
    try {
      await this.api('/activity_logs', 'POST', { id, loan_id: loanId, type, description, user_name: user, user_role: role, module, timestamp: now });
      
      const loanIndex = this.loans.findIndex(l => l.id === loanId);
      if (loanIndex !== -1) {
        if (!this.loans[loanIndex].history) this.loans[loanIndex].history = [];
        this.loans[loanIndex].history.push({ id, timestamp: now, type, description, user, role, module });
      }
    } catch (err) {
      console.error('Failed to log history to DB. Local sync skipped:', err);
      throw err; // Ensure caller knows the log failed
    }
  }

  private save() {
    try {
      localStorage.setItem('melann_loans', JSON.stringify(this.loans));
      localStorage.setItem('melann_users', JSON.stringify(this.users));
      localStorage.setItem('melann_collectors', JSON.stringify(this.collectors));
      localStorage.setItem('melann_demand_letters', JSON.stringify(this.demandLetters));
    } catch (err) {
      console.warn('Failed to save to localStorage (likely quota exceeded). Offline fallback cache will not be updated.', err);
    }
    this.notify();
  }

  // User accounts are permanent system records and must never be deleted.
  // Access control is managed exclusively through the 'status' property.
  getUsers() { return this.users; }

  authenticate(username: string, password?: string): { user: User | null; error?: string } {
    const user = this.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      return { user: null, error: 'Account not registered.' };
    }

    if (user.status === UserStatus.PENDING) {
      return { user: null, error: 'Account is pending approval.' };
    }

    if (user.status === UserStatus.DEACTIVATED) {
      return { user: null, error: 'Account is deactivated. Please contact the administrator.' };
    }

    if (user.passwordHash && this.hashPassword(password || '') !== user.passwordHash) {
      return { user: null, error: 'Invalid password.' };
    }

    return { user };
  }

  async registerUser(userData: Omit<User, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'passwordHash'> & { password?: string }, creatorName?: string) {
    const existingUser = this.users.find(u => u.username.toLowerCase() === userData.username.toLowerCase());
    if (existingUser) {
      throw new Error('Username is already registered.');
    }

    if (!userData.password || userData.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const id = Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();
    const { password, ...safeUserData } = userData;
    const newUser: User = {
      ...safeUserData,
      id,
      passwordHash: this.hashPassword(password),
      status: UserStatus.PENDING,
      createdAt: now,
      createdBy: creatorName,
      statusHistory: [{ status: UserStatus.PENDING, updatedAt: now, updatedBy: creatorName || 'Self-Registration' }]
    };

    try {
      await this.api('/users', 'POST', newUser);
    } catch (err) {
      console.warn('User registration API unavailable. Saving pending account to local fallback.', err);
    }

    this.users.push(newUser);
    this.save();
    return newUser;
  }

  async updateUserStatus(id: string, newStatus: UserStatus, updaterName: string) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      const now = new Date().toISOString();
      const user = this.users[index];
      const newHistory = [
        ...user.statusHistory,
        { status: newStatus, updatedAt: now, updatedBy: updaterName }
      ];

      // Await server confirmation
      await this.api(`/users/${id}/status`, 'PUT', { status: newStatus, statusHistory: newHistory });

      this.users[index] = {
        ...user,
        status: newStatus,
        statusHistory: newHistory
      };
      this.save();
    }
  }

  async updateUserProfile(id: string, updates: Pick<User, 'fullName'>) {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('User account not found.');
    }

    const fullName = updates.fullName.trim();
    if (!fullName) {
      throw new Error('Full name is required.');
    }

    const updatedUser = { ...this.users[index], fullName };

    try {
      await this.api(`/users/${id}/profile`, 'PUT', { fullName });
    } catch (err) {
      console.warn('User profile API unavailable. Saving profile update to local fallback.', err);
    }

    this.users[index] = updatedUser;
    this.save();
    return updatedUser;
  }

  async updateUserPassword(id: string, currentPassword: string, newPassword: string) {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('User account not found.');
    }

    const user = this.users[index];
    if (user.passwordHash && this.hashPassword(currentPassword || '') !== user.passwordHash) {
      throw new Error('Current password is incorrect.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    if (currentPassword && currentPassword === newPassword) {
      throw new Error('New password must be different from the current password.');
    }

    const passwordHash = this.hashPassword(newPassword);
    const updatedUser = { ...user, passwordHash };

    try {
      await this.api(`/users/${id}/password`, 'PUT', { passwordHash });
    } catch (err) {
      console.warn('User password API unavailable. Saving password update to local fallback.', err);
    }

    this.users[index] = updatedUser;
    this.save();
    return updatedUser;
  }

  getCollectors(branch?: Branch) {
    const collectors = dedupeCollectors(this.collectors);
    if (!branch || branch === Branch.ALL) return collectors;
    return collectors.filter(c => c.branch === branch);
  }

  async addCollector(name: string, branch: Branch, address?: string, nickname?: string, photoUrl?: string, assignedSupervisor?: string) {
    if (hasDuplicateCollectorIdentity(this.collectors, { name, nickname })) {
      throw new Error('Collector already exists. Please use the existing collector record.');
    }

    const id = Math.random().toString(36).substring(2, 9);
    const newCollector: Collector = { id, name, nickname, address, assignedSupervisor, photoUrl, branch };

    // Await server confirmation
    await this.api('/collectors', 'POST', newCollector);

    this.collectors = dedupeCollectors([...this.collectors, newCollector]);
    this.save();
    return newCollector;
  }

  async updateCollector(id: string, name: string, branch: Branch, address?: string, nickname?: string, photoUrl?: string, assignedSupervisor?: string) {
    const index = this.collectors.findIndex(c => c.id === id);
    if (index !== -1) {
      if (hasDuplicateCollectorIdentity(this.collectors, { name, nickname }, id)) {
        throw new Error('Collector already exists. Please use the existing collector record.');
      }

      const oldName = this.collectors[index].name;
      const oldNick = this.collectors[index].nickname;
      
      // Await server confirmation
      await this.api(`/collectors/${id}`, 'PUT', { name, nickname, address, assignedSupervisor, photoUrl, branch });

      this.collectors[index] = { ...this.collectors[index], name, address, branch, nickname, photoUrl, assignedSupervisor };
      const activeName = nickname || name;
      const { affectedLoans, affectedRemarks, affectedDemandLetters } = this.normalizeCollectorReferences(
        [oldName, oldNick, name, nickname],
        activeName
      );

      const syncResults = await Promise.allSettled([
        ...affectedLoans.map(loan => this.api(`/loans/${loan.id}`, 'PUT', loan)),
        ...affectedRemarks.map(remark => this.api(`/remarks/${remark.id}`, 'PUT', {
          text: remark.text,
          collector: remark.collector,
          ptpDate: remark.ptpDate,
          followUpDate: remark.followUpDate
        })),
        ...affectedDemandLetters.map(dl => this.api(`/demand_letters/${dl.id}`, 'PUT', dl))
      ]);
      const failedSyncs = syncResults.filter(result => result.status === 'rejected');
      if (failedSyncs.length > 0) {
        console.warn(`Collector nickname updated, but ${failedSyncs.length} historical collector references could not be synced to the backend. UI display will still use the active nickname.`, failedSyncs);
      }
      this.save();
    }
  }

  async deleteCollector(id: string) {
    await this.api(`/collectors/${id}`, 'DELETE');
    this.collectors = this.collectors.filter(c => c.id !== id);
    this.save();
  }

  async bulkAddLoans(loans: Loan[], user: string, role: string, importMode: 'replace' | 'wipe' | 'new-only', targetBranch: Branch) {
    let deletedCount = 0;
    let importedCount = 0;
    let skippedCount = 0;

    if (importMode === 'wipe') {
      // Clear out existing records for this branch (or all branches) first locally
      if (targetBranch === Branch.ALL) {
        deletedCount = this.loans.length;
        this.loans = [];
      } else {
        const initialLength = this.loans.length;
        this.loans = this.loans.filter(l => l.branch !== targetBranch);
        deletedCount = initialLength - this.loans.length;
      }
      
      // Strict Backend Wipe: MUST await successful deletion BEFORE inserting new values
      try {
         const res = await this.api(`/loans/branch/${targetBranch}/wipe`, 'DELETE');
         if (res && res.count !== undefined) {
             deletedCount = res.count; // Prioritize DB's actual row count
         }
      } catch (err) {
         console.error('Backend bulk wipe failed. Halting import process:', err);
         throw new Error('Failed to permanently wipe database previous records. Import aborted for safety.');
      }
    }

    const eligibleLoans = loans.filter(loan => isLoanMaturityInActivePortfolioRange(loan.dueDate));
    skippedCount += loans.length - eligibleLoans.length;
    const newAdditions: Loan[] = [];

    if (importMode === 'replace') {
      // Find matching codes and update existing ones, only push truly new ones
      for (const newLoan of eligibleLoans) {
        const existingIndex = this.loans.findIndex(l => l.code === newLoan.code);
        if (existingIndex !== -1) {
          const existing = this.loans[existingIndex];
          // Preserve system info: ID, remarks, payments, history
          const updatedLoan = {
            ...newLoan,
            id: existing.id,
            payments: existing.payments,
            remarks: existing.remarks,
            history: existing.history,
            aiPriority: existing.aiPriority
          };
          this.loans[existingIndex] = updatedLoan;
          importedCount++;
          
          await this.recordHistory(existing.id, 'Data Import Update', `Account updated via Excel import. Balance sync: ₱${newLoan.outstandingBalance.toLocaleString()}`, user, role, 'Loan Enrolment');
          try {
            await this.api(`/loans/${existing.id}`, 'PUT', updatedLoan);
          } catch(err) {} 
        } else {
          newAdditions.push(newLoan);
        }
      }
    } else if (importMode === 'new-only') {
      for (const newLoan of eligibleLoans) {
         const existing = this.loans.find(l => l.code === newLoan.code);
         if (!existing) {
             newAdditions.push(newLoan);
         } else {
             skippedCount++;
         }
      }
    }

    const finalAdditions = importMode === 'wipe' ? eligibleLoans : newAdditions;

    if (finalAdditions.length > 0) {
      this.loans = [...this.loans, ...finalAdditions];
      importedCount += finalAdditions.length;
      
      // Record history for strictly new accounts
      await Promise.all(finalAdditions.map(loan =>
        this.recordHistory(loan.id, 'Bulk Import', `Account imported via Excel with initial balance of ₱${loan.outstandingBalance.toLocaleString()}`, user, role, 'Loan Enrolment')
      ));

      await this.api('/loans/bulk', 'POST', finalAdditions);
    }
    
    this.save();
    this.notify();

    return {
        deletedCount,
        importedCount,
        skippedCount,
        success: true
    };
  }

  async bulkUpdateAddresses(addresses: { code: string; address: string }[], user: string, role: string, importMode: 'replace' | 'wipe' | 'new-only') {
    let updatedCount = 0;
    const finalUpdates: Loan[] = [];

    if (importMode === 'wipe') {
        // Clear all addresses first
        this.loans.forEach(l => { 
            if (l.fullAddress) l.fullAddress = ''; 
        });
        // (In a real DB, you'd trigger a bulk clear here first)
    }

    for (const item of addresses) {
      if (!item.code || !item.address) continue;
      
      const loanIndex = this.loans.findIndex(l => l.code === item.code);
      if (loanIndex !== -1) {
        const existing = this.loans[loanIndex];
        
        if (importMode === 'new-only' && existing.fullAddress && existing.fullAddress.trim() !== '') {
            continue; // Skip because data already exists
        }

        const updatedLoan = {
          ...existing,
          fullAddress: item.address
        };
        
        this.loans[loanIndex] = updatedLoan;
        finalUpdates.push(updatedLoan);
        
        // Optionally omit history record for simple address updates to save space, but keeping it for audit:
        await this.recordHistory(existing.id, 'Address Impart', `Client address updated via Bulk Address Import.`, user, role, 'Client Profile');
        try {
          await this.api(`/loans/${existing.id}`, 'PUT', updatedLoan);
        } catch(err) {} 
        updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
       this.save();
       this.notify();
    }
    return updatedCount;
  }

  getLoans(branch?: Branch) {
    const activeLoans = this.loans.filter(isLoanAllowedInActivePortfolio);
    const branchLoans = !branch || branch === Branch.ALL
      ? activeLoans
      : activeLoans.filter(l => l.branch === branch);

    return branchLoans.map(loan => ({
      ...loan,
      collector: this.getCollectorDisplayName(loan.collector),
      remarks: (loan.remarks || []).map(remark => ({
        ...remark,
        collector: this.getCollectorDisplayName(remark.collector)
      }))
    }));
  }

  async getMigrationBatches(): Promise<MigrationBatch[]> {
    const rows = await this.api('/migration_batches');
    return rows.map((row: any) => this.mapMigrationBatch(row));
  }

  async scanMigrationBatches(maturityFrom: string, maturityTo: string): Promise<MigrationBatch[]> {
    const result = await this.api('/migration_batches/scan', 'POST', { maturityFrom, maturityTo });
    return (result.batches || []).map((row: any) => this.mapMigrationBatch(row));
  }

  async migrateBatch(batchId: string, user: string, selectedAccountKeys?: string[]) {
    const result = await this.api(`/migration_batches/${batchId}/migrate`, 'POST', { user, selectedAccountKeys });
    await this.refresh();
    return result;
  }

  async updateMigrationBatchAccount(batchId: string, code: string, updatedLoanData: any) {
    const result = await this.api(`/migration_batches/${batchId}/account`, 'PUT', { code, updatedLoanData });
    return result;
  }

  async removeMigrationBatchAccount(batchId: string, code: string, deletedBy?: string) {
    const result = await this.api(`/migration_batches/${batchId}/account/${code}`, 'DELETE', {
      deletedBy: deletedBy || 'System',
      reason: 'Excluded from JCASH Migration'
    });
    // Refresh deleted loans list so recycle bin updates immediately
    try {
      const dbDeletedLoans = await fetch(`${API_URL}/recycle_bin`).then(r => r.json());
      this.deletedLoans = (dbDeletedLoans || []).map((d: any) => this.mapDeletedLoan(d));
      this.notify();
    } catch (e) {}
    return result;
  }

  async addLoan(loanData: Omit<Loan, 'id' | 'payments' | 'remarks' | 'amountCollected' | 'runningBalance' | 'borrowerName' | 'aiPriority' | 'history' | 'promiseToPayDate'>, user: string, role: string) {
    const id = Math.random().toString(36).substring(2, 9);
    const firstName = loanData.firstName.trim();
    const lastName = loanData.lastName.trim();
    const borrowerName = `${lastName}, ${firstName}`;
    const newLoan: Loan = {
      ...loanData,
      firstName,
      lastName,
      id,
      borrowerName,
      amountCollected: 0,
      runningBalance: loanData.outstandingBalance,
      payments: [],
      remarks: [],
      history: [],
      aiPriority: PriorityLevel.LOWEST,
      promiseToPayDate: null
    };
    // Strict Transactional Save: Await server confirmation BEFORE updating local memory
    await this.api('/loans', 'POST', newLoan);
    
    this.loans.push(newLoan);
    await this.recordHistory(id, 'Loan Creation', `Account enrolled with initial balance of ₱${loanData.outstandingBalance.toLocaleString()}`, user, role, 'Loan Enrolment');
    this.save();
    return newLoan;
  }

  async updateLoan(id: string, updates: Partial<Loan>, user: string, role: string) {
    const index = this.loans.findIndex(l => l.id === id);
    if (index === -1) return null;
    const current = this.loans[index];

    // Clean inputs
    if (updates.firstName) updates.firstName = updates.firstName.trim();
    if (updates.lastName) updates.lastName = updates.lastName.trim();

    const updated = { ...current, ...updates };

    if (updates.firstName || updates.lastName) {
      updated.borrowerName = `${updated.lastName}, ${updated.firstName}`;
    }

    const previousLoan = this.loans[index];
    this.loans[index] = updated;
    const fullyUpdated = this.recalculateLoanFinances(id)!;
    if (
      Object.prototype.hasOwnProperty.call(updates, 'recurringSchedule') ||
      Object.prototype.hasOwnProperty.call(updates, 'promiseToPayDate') ||
      Object.prototype.hasOwnProperty.call(updates, 'followUpDate')
    ) {
      this.syncLoanInteractionDates(id);
    }

    // Strict Transactional Save: persist the same recalculated state that the UI will show.
    try {
      await this.api(`/loans/${id}`, 'PUT', fullyUpdated);
    } catch (err) {
      this.loans[index] = previousLoan;
      throw err;
    }

    // Logic for logging history
    if (updates.status && updates.status !== current.status) {
      await this.recordHistory(id, 'Status Change', `Status updated from ${current.status} to ${updates.status}`, user, role, 'Loan Management');
    }
    if (updates.location && updates.location !== current.location) {
      await this.recordHistory(id, 'Location Update', `Location updated from ${current.location} to ${updates.location}`, user, role, 'Loan Management');
    }
    if (updates.collector && updates.collector !== current.collector) {
      await this.recordHistory(id, 'Collector Reassignment', `Collector reassigned from ${current.collector} to ${updates.collector}`, user, role, 'Loan Management');
    }
    if (updates.outstandingBalance !== undefined && updates.outstandingBalance !== current.outstandingBalance) {
      await this.recordHistory(id, 'Balance Adjustment', `Principal balance adjusted from ₱${current.outstandingBalance.toLocaleString()} to ₱${updates.outstandingBalance.toLocaleString()}`, user, role, 'Loan Management');
    }

    this.save();
    return fullyUpdated;
  }

  async addRemark(loanId: string, text: string, collector: string, priority?: PriorityLevel, user?: string, role?: string, ptpDate?: string | null, followUpDate?: string | null) {
    const index = this.loans.findIndex(l => l.id === loanId);
    if (index === -1) return;
    const id = Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();
    const newRemark: Remark = {
      id,
      text,
      timestamp: now,
      collector,
      ptpDate,
      followUpDate
    };
    const actorName = user || collector;
    const actorRole = role || 'System';
    const detail = `New remark: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"${ptpDate ? ` (PTP: ${ptpDate})` : ''}${followUpDate ? ` (Follow-up: ${followUpDate})` : ''}`;

    // Transactional: Await server and history log first
    await this.api(`/remarks`, 'POST', { loanId, ...newRemark });
    await this.recordHistory(loanId, 'Remark Added', detail, actorName, actorRole, 'Field Intelligence');

    // Only update local memory after success
    this.loans[index].remarks.push(newRemark);
    this.syncLoanInteractionDates(loanId);
    if (priority) {
      this.loans[index].aiPriority = priority;
    }
    this.save();
    return newRemark;
  }

  private syncLoanInteractionDates(loanId: string) {
    const loanIndex = this.loans.findIndex(l => l.id === loanId);
    if (loanIndex === -1) return;
    const loan = this.loans[loanIndex];
    const currentDate = new Date();
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${day}`;
    
    // 1. Sync PTP
    const latestPTPRemark = [...loan.remarks].reverse().find(r => r.ptpDate);
    
    // If we have a recurring schedule, it's a primary source of PTP
    if (loan.recurringSchedule?.enabled && loan.recurringSchedule.nextDueDate) {
      // If there's a specific PTP remark that is LATER than the recurring one, use it
      // Otherwise use the recurring schedule's next due date
      if (latestPTPRemark && latestPTPRemark.ptpDate && latestPTPRemark.ptpDate > loan.recurringSchedule.nextDueDate) {
        loan.promiseToPayDate = latestPTPRemark.ptpDate;
      } else {
        loan.promiseToPayDate = loan.recurringSchedule.nextDueDate;
      }
    } else {
      loan.promiseToPayDate = latestPTPRemark?.ptpDate || null;
    }

    // 2. Sync Follow-up
    const latestFURemark = [...loan.remarks].reverse().find(r => r.followUpDate);
    loan.followUpDate = latestFURemark?.followUpDate || null;

    // 3. Update Priority Level
    // Rule: PTP Today (highest) > Missed PTP > Follow-up Today > Missed Follow-up > Future Follow-up
    if (loan.promiseToPayDate) {
      if (loan.promiseToPayDate === today) {
        loan.aiPriority = PriorityLevel.TOP; // Due Today
      } else if (loan.promiseToPayDate < today) {
        loan.aiPriority = PriorityLevel.NEED_ATTENTION; // Missed Promise
      } else {
        loan.aiPriority = PriorityLevel.FOLLOW_UP; // Future Promise
      }
    } else if (loan.followUpDate) {
      if (loan.followUpDate === today) {
        loan.aiPriority = PriorityLevel.TOP; // Follow-up due TODAY → Critical Action
      } else if (loan.followUpDate < today) {
        loan.aiPriority = PriorityLevel.NEED_ATTENTION; // Missed follow-up
      } else {
        loan.aiPriority = PriorityLevel.FOLLOW_UP; // Future follow-up
      }
    }
  }

  async updateRemark(loanId: string, remarkId: string, text: string, priority: PriorityLevel, user: string, role: string, ptpDate?: string | null, followUpDate?: string | null) {
    const loanIndex = this.loans.findIndex(l => l.id === loanId);
    if (loanIndex === -1) return;
    const remarkIndex = this.loans[loanIndex].remarks.findIndex(r => r.id === remarkId);
    if (remarkIndex === -1) return;

    const previousLoan = { ...this.loans[loanIndex], remarks: [...this.loans[loanIndex].remarks] };
    const updatedRemark = {
      ...this.loans[loanIndex].remarks[remarkIndex],
      text,
      ptpDate,
      followUpDate
    };
    this.loans[loanIndex].remarks[remarkIndex] = updatedRemark;
    this.syncLoanInteractionDates(loanId);
    
    // Manual priority override if provided (AI sentiment)
    if (priority) {
      this.loans[loanIndex].aiPriority = priority;
    }

    try {
      await this.api(`/remarks/${remarkId}`, 'PUT', { text, ptpDate, followUpDate });
      await this.api(`/loans/${loanId}`, 'PUT', this.loans[loanIndex]);
      await this.recordHistory(loanId, 'Remark Edited', `Remark edited: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`, user, role, 'Field Intelligence');
    } catch (err) {
      this.loans[loanIndex] = previousLoan;
      throw err;
    }

    this.save();
  }

  async deleteLoan(id: string, deletedBy: string, reason?: string) {
    const loanIndex = this.loans.findIndex(l => l.id === id);
    if (loanIndex === -1) return;
    const loanToArchive = this.loans[loanIndex];

    // Transactional: Await server confirmation before local removal
    await this.api(`/recycle_bin`, 'POST', {
      id: loanToArchive.id,
      originalLoanData: loanToArchive,
      deletedBy,
      reason,
      branch: loanToArchive.branch
    });

    const newDeletedLoan: DeletedLoan = {
      id: loanToArchive.id,
      originalLoanData: loanToArchive,
      deletedBy,
      deletedAt: new Date().toISOString(),
      reason,
      branch: loanToArchive.branch
    };

    this.deletedLoans.unshift(newDeletedLoan);
    this.loans = this.loans.filter(l => l.id !== id);
    this.save();
    this.notify();
  }

  getDeletedLoans(branch?: Branch): DeletedLoan[] {
    if (!branch || branch === Branch.ALL) return this.deletedLoans;
    return this.deletedLoans.filter(l => l.branch === branch);
  }

  async restoreLoan(id: string, user: string, role: string) {
    const res = await this.api(`/recycle_bin/${id}/restore`, 'POST');
    if (res.success && res.loan) {
        this.deletedLoans = this.deletedLoans.filter(d => d.id !== id);

        // Ensure properties are properly re-mapped for frontend consistency if needed
        const restoredLoan = res.loan;
        this.loans = this.loans.filter(l => l.id !== id);
        this.loans.push(restoredLoan);

        // Recalculate to restore status correctly
        this.recalculateLoanFinances(id);
        await this.recordHistory(id, 'Loan Restored', `Account restored from Recycle Bin.`, user, role, 'Administration');

        this.save();
        this.notify();
    }
    return res;
  }

  async permanentlyDeleteLoan(id: string) {
    await this.api(`/recycle_bin/${id}`, 'DELETE');
    this.deletedLoans = this.deletedLoans.filter(d => d.id !== id);
    this.save();
    this.notify();
  }

  getLoanByCode(code: string) {
    return this.loans.find(l => l.code === code);
  }

  private isJcashSourceLoan(loan: Loan) {
    const hasJcashPayments = loan.payments.some(p => p.remarks === 'Migrated from jcashdb.mdb');
    const hasNumericSourceId = /^\d+$/.test(String(loan.id || ''));
    return hasJcashPayments || (hasNumericSourceId && loan.branch === Branch.ORMOC);
  }

  private isPreservedPaidMonitoringLoan(loan: Loan) {
    const hasReversedPayment = loan.payments.some(p => p.status === PaymentStatus.REVERSED);
    return !hasReversedPayment && loan.branch === Branch.ORMOC && loan.history.some(h =>
      h.description === 'Paid/zero-balance monitoring record restored after Ormoc JCASH source reconciliation.'
    );
  }

  private syncPreservedPaidMonitoringLoan(loan: Loan) {
    const activePayments = loan.payments.filter(p => p.status !== PaymentStatus.REVERSED);
    const paymentTotal = activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    loan.amountCollected = Math.max(Number(loan.amountCollected || 0), paymentTotal);
    loan.runningBalance = 0;
    loan.status = MovingStatus.PAID;
  }

  private recalculateLoanFinances(loanId: string) {
    const loanIndex = this.loans.findIndex(l => l.id === loanId);
    if (loanIndex === -1) return null;
    const loan = this.loans[loanIndex];

    // Authoritative source: Sort payments by date ASC, then by creation time ASC
    loan.payments.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const activePayments = loan.payments.filter(p => p.status !== PaymentStatus.REVERSED);
    const allPaymentTotal = loan.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const sourceCollectedAdjustment = this.isJcashSourceLoan(loan)
      ? Math.max(0, Number(loan.amountCollected || 0) - allPaymentTotal)
      : 0;

    let currentBalance = (loan.totalLoan != null ? loan.totalLoan : loan.outstandingBalance) - sourceCollectedAdjustment;
    let totalCollected = sourceCollectedAdjustment;

    // Rebuild the payment stream from the authoritative opening balance. Some
    // imported JCASH rows contain stale balance-after values, so every active
    // row must follow the same rule: previous balance minus payment amount.
    activePayments.forEach(p => {
      totalCollected += Number(p.amount || 0);
      currentBalance -= Number(p.amount || 0);
      p.balanceAfter = currentBalance;
    });

    // Clamp running balance to 0 (no negative balances)
    const finalRunning = Math.max(0, currentBalance);

    // Sync loan status and totals
    loan.runningBalance = finalRunning;
    loan.amountCollected = totalCollected;
    
    // Auto status determination:
    if (finalRunning <= 0) {
      loan.status = MovingStatus.PAID;
    } else if (activePayments.length === 0) {
      loan.status = MovingStatus.NMSR;
    } else {
      const latestPayment = activePayments[activePayments.length - 1]; // activePayments is sorted by date ASC
      const latestDate = new Date(latestPayment.date).getTime();
      const now = new Date().getTime();
      const msIn30Days = 30 * 24 * 60 * 60 * 1000;
      
      if (now - latestDate <= msIn30Days) {
        loan.status = MovingStatus.MOVING;
      } else {
        loan.status = MovingStatus.NM;
      }
    }

    return loan;
  }

  /**
   * Computes the next due date from an array of recurring schedule days.
   * Given days like [15, 30] and a reference date, finds the nearest future occurrence.
   * Handles edge cases like Feb 30 → Feb 28/29.
   */
  private computeNextDueDate(days: number[], afterDate: string): string {
    const sorted = [...days].sort((a, b) => a - b);
    const ref = new Date(afterDate + 'T00:00:00');
    const refDay = ref.getDate();
    let refMonth = ref.getMonth();
    let refYear = ref.getFullYear();

    // Find the first scheduled day that is strictly after the reference day in the current month
    for (const day of sorted) {
      if (day > refDay) {
        // Clamp to last valid day of the month
        const lastDay = new Date(refYear, refMonth + 1, 0).getDate();
        const clampedDay = Math.min(day, lastDay);
        const candidate = new Date(refYear, refMonth, clampedDay);
        const y = candidate.getFullYear();
        const m = String(candidate.getMonth() + 1).padStart(2, '0');
        const d = String(candidate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }

    // No day found in current month — wrap to the first scheduled day of next month
    refMonth += 1;
    if (refMonth > 11) {
      refMonth = 0;
      refYear += 1;
    }
    const lastDay = new Date(refYear, refMonth + 1, 0).getDate();
    const clampedDay = Math.min(sorted[0], lastDay);
    const candidate = new Date(refYear, refMonth, clampedDay);
    const y = candidate.getFullYear();
    const m = String(candidate.getMonth() + 1).padStart(2, '0');
    const d = String(candidate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Computes the next due date from an array of weekly schedule days (0=Sun, 6=Sat).
   */
  private computeNextWeeklyDueDate(weekDays: number[], afterDate: string): string {
    const sorted = [...weekDays].sort((a, b) => a - b);
    const ref = new Date(afterDate + 'T00:00:00');
    const currentDayOfWeek = ref.getDay();
    
    // Find first day in the sorted array strictly strictly after current day of week
    for (const day of sorted) {
      if (day > currentDayOfWeek) {
        ref.setDate(ref.getDate() + (day - currentDayOfWeek));
        const y = ref.getFullYear();
        const m = String(ref.getMonth() + 1).padStart(2, '0');
        const d = String(ref.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    
    // If no day found in current week, wrap to the first available day next week
    ref.setDate(ref.getDate() + (7 - currentDayOfWeek + sorted[0]));
    const y = ref.getFullYear();
    const m = String(ref.getMonth() + 1).padStart(2, '0');
    const d = String(ref.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async recordPayment(loanId: string, amount: number, date: string, remarks: string, recorder: string, role: string, customOr?: string) {
    const index = this.loans.findIndex(l => l.id === loanId);
    if (index === -1) return null;
    const loan = this.loans[index];

    // Auto-generate OR Number: OR-YYYYMMDD-XXXX where XXXX is random chars
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orNumber = customOr || `OR-${dateStr}-${randomChars}`;

    const paymentId = Math.random().toString(36).substring(2, 9);
    const newPayment: Payment = {
      id: paymentId,
      loanId,
      amount,
      orNumber,
      date,
      balanceAfter: 0, // Will be set by recalculate
      recorder,
      remarks,
      status: PaymentStatus.GOOD,
      createdAt: now.toISOString()
    };

    // Auto-Return Rule: If payment is detected for Top Priority or Need Attention, remove format/return to All Client Updates
    if (loan.aiPriority === PriorityLevel.TOP || loan.aiPriority === PriorityLevel.NEED_ATTENTION) {
      loan.aiPriority = PriorityLevel.LOWEST;
    }

    // Auto-Location Rule: If payment is detected for a "Not Located" client, they've clearly been found
    if (loan.location === LocationStatus.NOT_LOCATED) {
      loan.location = LocationStatus.LOCATED;
      // Clear any manual Write-Off override since client is now active
      if (loan.actionStage === 'For Write-Off') {
        loan.actionStage = undefined as any;
        loan.actionNote = undefined as any;
      }
      await this.recordHistory(loanId, 'Auto-Location Update', 'Location automatically changed to "Located" due to payment activity.', recorder, role, 'Payment');
    }

    const existingSameDateIndex = this.loans[index].payments.findIndex(
      p => p.loanId === loanId && p.date === date
    );
    const previousSameDatePayment = existingSameDateIndex !== -1
      ? this.loans[index].payments[existingSameDateIndex]
      : null;
    const previousAmountCollected = loan.amountCollected;
    const previousAllPaymentTotal = loan.payments
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const sourceCollectedAdjustment = this.isJcashSourceLoan(loan)
      ? Math.max(0, Number(loan.amountCollected || 0) - previousAllPaymentTotal)
      : 0;

    // Recalculate before persisting so the stored payment row carries the
    // correct balance_after value, including same-date replacement payments.
    if (existingSameDateIndex !== -1) {
      this.loans[index].payments[existingSameDateIndex] = newPayment;
    } else {
      this.loans[index].payments.push(newPayment);
    }
    const nextActivePaymentTotal = this.loans[index].payments
      .filter(p => p.status !== PaymentStatus.REVERSED)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    this.loans[index].amountCollected = sourceCollectedAdjustment + nextActivePaymentTotal;
    const updatedLoan = this.recalculateLoanFinances(loanId);

    try {
      await this.api('/payments', 'POST', { loanId, ...newPayment });
      await this.api(`/loans/${loanId}`, 'PUT', updatedLoan);
    } catch (apiErr: any) {
      if (apiErr.message && apiErr.message.includes('payments_loan_id_fkey')) {
        console.warn('Foreign key missing. Auto-syncing loan to server first...');
        await this.api('/loans/bulk', 'POST', [loan]);
        await this.api('/payments', 'POST', { loanId, ...newPayment });
        await this.api(`/loans/${loanId}`, 'PUT', updatedLoan);
      } else {
        if (previousSameDatePayment) {
          this.loans[index].payments[existingSameDateIndex] = previousSameDatePayment;
        } else {
          this.loans[index].payments = this.loans[index].payments.filter(p => p.id !== newPayment.id);
        }
        this.loans[index].amountCollected = previousAmountCollected;
        this.recalculateLoanFinances(loanId);
        throw apiErr;
      }
    }

    if (remarks && remarks.trim() !== '') {
      await this.addRemark(loanId, remarks, loan.collector, undefined, recorder, role);
    }

    // Recurring Schedule Auto-Advance: If loan has an active recurring schedule,
    // advance the nextDueDate and sync promiseToPayDate for the Client Update pipeline.
    if (updatedLoan && updatedLoan.recurringSchedule?.enabled) {
      const schedule = updatedLoan.recurringSchedule;
      const isWeekly = schedule.type === 'weekly';
      
      if ((isWeekly && schedule.weekDays && schedule.weekDays.length > 0) || (!isWeekly && schedule.days && schedule.days.length > 0)) {
        schedule.lastPaidDate = date;
        if (isWeekly) {
          schedule.nextDueDate = this.computeNextWeeklyDueDate(schedule.weekDays!, date);
        } else {
          schedule.nextDueDate = this.computeNextDueDate(schedule.days, date);
        }
        updatedLoan.promiseToPayDate = schedule.nextDueDate;
        // Persist the schedule advancement to server
      try {
        await this.api(`/loans/${loanId}`, 'PUT', updatedLoan);
      } catch (err) {
        console.error('Failed to sync recurring schedule advancement:', err);
      }
      }
    }

    await this.recordHistory(
      loanId, 
      'Payment Recorded', 
      `Payment of ₱${amount.toLocaleString()} received via ${orNumber}. New balance: ₱${updatedLoan!.runningBalance.toLocaleString()}`, 
      recorder, 
      role, 
      'Financial Collection'
    );

    this.save();
    return newPayment;
  }

  async reversePayment(orNumber: string, reason: string, recorder: string, role: string) {
    // Find the loan that contains this payment
    const loanIndex = this.loans.findIndex(l => l.payments.some(p => p.orNumber === orNumber));
    if (loanIndex === -1) return { success: false, message: 'OR Number not found.' };

    const loan = this.loans[loanIndex];
    const paymentIndex = loan.payments.findIndex(p => p.orNumber === orNumber);
    const payment = loan.payments[paymentIndex];

    if (payment.status === PaymentStatus.REVERSED) {
      return { success: false, message: 'This payment is already reversed.' };
    }

    const previousLoan = {
      ...loan,
      payments: loan.payments.map(p => ({ ...p })),
      history: [...loan.history]
    };

    // Mark as reversed
    loan.payments[paymentIndex].status = PaymentStatus.REVERSED;
    loan.payments[paymentIndex].remarks = reason ? `${payment.remarks || ''} (REVERSED: ${reason})` : `${payment.remarks || ''} (REVERSED)`;

    // Authoritative Recalculation
    const updatedLoan = this.recalculateLoanFinances(loan.id)!;

    try {
      await this.api(`/payments/${orNumber}`, 'PUT', { status: PaymentStatus.REVERSED, remarks: loan.payments[paymentIndex].remarks });
      await this.api(`/loans/${loan.id}`, 'PUT', updatedLoan);
    await this.recordHistory(loan.id, 'Payment Reversed', `Payment OR: ${orNumber} (₱${payment.amount.toLocaleString()}) reversed. Reason: ${reason || 'Not specified'}. New balance: ₱${updatedLoan.runningBalance.toLocaleString()}`, recorder, role, 'Payment Stream');
    } catch (err) {
      this.loans[loanIndex] = previousLoan;
      throw err;
    }

    this.loans[loanIndex] = updatedLoan;
    this.save();

    return { success: true, message: 'Payment successfully reversed.', loan: updatedLoan };
  }

  getPaymentByOR(orNumber: string) {
    for (const loan of this.loans) {
      const payment = loan.payments.find(p => p.orNumber === orNumber);
      if (payment) {
        return { loan, payment };
      }
    }
    return null;
  }

  getRecentPayments(branch?: Branch, limit: number = 5) {
    const allPayments: (Payment & { borrowerName: string })[] = [];
    const filteredLoans = this.getLoans(branch);
    filteredLoans.forEach(loan => {
      loan.payments
        .filter(p => p.status === PaymentStatus.GOOD)
        .forEach(payment => {
          allPayments.push({ ...payment, borrowerName: loan.borrowerName });
        });
    });
    return allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);
  }

  getDailyCollections(fromDate: string, toDate: string, branch?: Branch) {
    const filteredLoans = this.getLoans(branch);
    const transactions: {
      loanId: string;
      borrowerName: string;
      collector: string;
      area: string;
      city: string;
      amount: number;
      orNumber: string;
      date: string;
    }[] = [];

    filteredLoans.forEach(loan => {
      if (this.isExcludedFromCollectionReports(loan)) return;

      loan.payments
        .filter(p => {
          if (!isReportableCollectionPayment(p)) return false;
          if (fromDate && p.date < fromDate) return false;
          if (toDate && p.date > toDate) return false;
          return true;
        })
        .forEach(p => {
          transactions.push({
            loanId: loan.id,
            borrowerName: loan.borrowerName,
            collector: this.getCollectorDisplayName(loan.collector),
            area: loan.area || loan.city || 'N/A',
            city: loan.city,
            amount: p.amount,
            orNumber: p.orNumber,
            date: p.date,
          });
        });
    });

    // Group by collector
    const collectorMap: Record<string, { collector: string; totalAccounts: number; totalAmount: number }> = {};
    transactions.forEach(t => {
      const collectorKey = normalizeCollectorKey(t.collector);
      if (!collectorMap[collectorKey]) {
        collectorMap[collectorKey] = { collector: collectorKey, totalAccounts: 0, totalAmount: 0 };
      }
      collectorMap[collectorKey].totalAccounts++;
      collectorMap[collectorKey].totalAmount += t.amount;
    });

    const collectorSummary = Object.values(collectorMap).sort((a, b) => b.totalAmount - a.totalAmount);
    const grandTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
    const grandTotalAccounts = transactions.length;

    return { transactions, collectorSummary, grandTotal, grandTotalAccounts };
  }


  /**
   * Checks if a loan is a "Dead" write-off: fully paid only because the borrower
   * died, meaning no actual money was collected. These should be excluded from
   * collection performance metrics.
   */
  isDeadWriteOff(loan: Loan): boolean {
    const hasDeadIntel = loan.remarks.some(r => {
      const text = r.text.toLowerCase().trim();
      return /\b(dead|deceased)\b/.test(text);
    });

    const hasDeadPayment = loan.payments.some(p => {
      if (!p.remarks) return false;
      const text = p.remarks.toLowerCase().trim();
      return /\b(dead|deceased)\b/.test(text);
    });

    return hasDeadIntel || hasDeadPayment;
  }

  isOfficialWriteOff(loanId: string): boolean {
    return this.managementDispositions.some(d =>
      d.loanId === loanId &&
      (d.type === DispositionType.PROSPECT_WRITE_OFF || d.type === DispositionType.DEAD_ACCOUNT) &&
      (d.status === DispositionStatus.APPROVED || d.status === DispositionStatus.EXECUTED)
    );
  }

  isExcludedFromCollectionReports(loan: Loan): boolean {
    return this.isDeadWriteOff(loan) || this.isOfficialWriteOff(loan.id);
  }

  getStats(branch?: Branch) {
    const filteredLoans = this.getLoans(branch);
    // Exclude only non-cash outcomes from performance stats. Fully paid accounts
    // remain included because they represent actual collected money.
    const performanceLoans = filteredLoans.filter(l => !this.isExcludedFromCollectionReports(l));
    const deadWriteOffs = filteredLoans.filter(l => this.isDeadWriteOff(l));
    const totalAccounts = performanceLoans.length;
    const totalCollected = performanceLoans.reduce((sum, l) =>
      sum + (l.payments || []).filter(isReportableCollectionPayment).reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0),
      0
    );
    const totalOutstanding = performanceLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);
    const totalRunning = performanceLoans.reduce((sum, l) => sum + l.runningBalance, 0);
    const statusData = {
      [MovingStatus.PAID]: { count: 0, amount: 0 },
      [MovingStatus.MOVING]: { count: 0, amount: 0 },
      [MovingStatus.NM]: { count: 0, amount: 0 },
      [MovingStatus.NMSR]: { count: 0, amount: 0 }
    };
    performanceLoans.forEach(l => {
      const s = l.status;
      if (statusData[s]) {
        const reportableCollected = (l.payments || [])
          .filter(isReportableCollectionPayment)
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        statusData[s].count++;
        statusData[s].amount += (s === MovingStatus.PAID ? reportableCollected : Math.max(0, l.outstandingBalance - reportableCollected));
      }
    });
    return {
      totalAccounts, totalCollected, totalOutstanding, totalRunning,
      counts: {
        Paid: statusData[MovingStatus.PAID].count,
        Moving: statusData[MovingStatus.MOVING].count,
        NM: statusData[MovingStatus.NM].count,
        NMSR: statusData[MovingStatus.NMSR].count
      },
      statusData: {
        Paid: statusData[MovingStatus.PAID],
        Moving: statusData[MovingStatus.MOVING],
        NM: statusData[MovingStatus.NM],
        NMSR: statusData[MovingStatus.NMSR]
      },
      deadWriteOff: {
        count: deadWriteOffs.length,
        amount: deadWriteOffs.reduce((sum, l) => sum + l.outstandingBalance, 0)
      }
    };
  }

  getCollectorPerformance(branch?: Branch) {
    const collectors: Record<string, CollectorPerformance> = {};
    const filteredLoans = this.getLoans(branch);
    filteredLoans.forEach(loan => {
      // Exclude Dead write-off loans from collection performance
      if (this.isExcludedFromCollectionReports(loan)) return;

      const coll = this.getCollectorDisplayName(loan.collector);
      if (!coll || coll === 'N/A' || coll === 'UNDEFINED' || coll === 'UNASSIGNED') return;

      if (!collectors[coll]) {
        collectors[coll] = { collector: coll, totalAccounts: 0, reportedAmount: 0, collectedAmount: 0, runningBalance: 0, collectionRate: 0, paidCount: 0 };
      }
      const p = collectors[coll];
      p.totalAccounts++;
      p.reportedAmount += loan.outstandingBalance;

      // Only count payments made on or after the month the loan was reported
      const reportedStart = loan.monthReported ? new Date(loan.monthReported + '-01').getTime() : 0;
      const activePayments = (loan.payments || []).filter(isReportableCollectionPayment);
      const collectedSinceReported = activePayments
        .filter(pay => new Date(pay.date).getTime() >= reportedStart)
        .reduce((sum, pay) => sum + Number(pay.amount || 0), 0);

      p.collectedAmount += collectedSinceReported;
      // Balance = Target - Collected (so Target = Collected + Balance always)
      p.runningBalance += Math.max(0, loan.outstandingBalance - collectedSinceReported);
      if (loan.status === MovingStatus.PAID) p.paidCount++;
    });
    return Object.values(collectors).map(p => ({ ...p, collectionRate: p.reportedAmount > 0 ? (p.collectedAmount / p.reportedAmount) * 100 : 0 }));
  }

  /**
   * Returns all loans that are Dead write-offs (fully paid due to death, not actual collection).
   * Used for the Dead Write-Off report section.
   */
  getDeadWriteOffs(branch?: Branch): Loan[] {
    const filteredLoans = this.getLoans(branch);
    return filteredLoans.filter(l => this.isDeadWriteOff(l));
  }

  getDemandLetters(branch?: Branch) {
    const demandLetters = !branch || branch === Branch.ALL
      ? this.demandLetters
      : this.demandLetters.filter(dl => dl.branch === branch);

    return demandLetters
      .filter(dl => {
        const loan = this.loans.find(l => l.id === dl.loanId);
        return !loan || hasActiveClientBalance(loan);
      })
      .map(dl => ({
        ...dl,
        collectorName: this.getCollectorDisplayName(dl.collectorName)
      }));
  }

  // Visit Log Methods (Close Monitoring)
  getVisitLogs(loanId: string): VisitLog[] {
    return this.visitLogs.filter(v => v.loanId === loanId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async addVisitLog(loanId: string, visitDate: string, collectorNotes: string, clientComment: string, visitedByCollector: boolean, action: VisitLogAction, loggedBy: string, role: string, personnelAssigned: string = ''): Promise<VisitLog> {
    const id = Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();
    const newLog: VisitLog = {
      id,
      loanId,
      visitDate,
      collectorNotes,
      clientComment,
      visitedByCollector,
      action,
      personnelAssigned,
      loggedBy,
      timestamp: now
    };

    // Persist to DB first
    await this.api('/visit_logs', 'POST', newLog);
    this.visitLogs.push(newLog);

    // Record audit trail
    const actionDesc = action === VisitLogAction.RETURN_TO_UPDATE
      ? 'Visit logged → Returned to All Client Updates (new promise/follow-up needed)'
      : action === VisitLogAction.MARK_SETTLED
        ? 'Visit logged → Account marked as SETTLED'
        : `Visit logged: ${collectorNotes.substring(0, 50)}`;
    await this.recordHistory(loanId, 'Visit Log', actionDesc, loggedBy, role, 'Close Monitoring');

    // Handle resolution actions
    const loanIndex = this.loans.findIndex(l => l.id === loanId);
    if (loanIndex !== -1) {
      if (action === VisitLogAction.RETURN_TO_UPDATE) {
        // Reset PTP/FollowUp dates so it goes back to the main update log
        this.loans[loanIndex].promiseToPayDate = null;
        this.loans[loanIndex].followUpDate = null;
        this.loans[loanIndex].aiPriority = PriorityLevel.NEED_ATTENTION;
        await this.api(`/loans/${loanId}`, 'PUT', this.loans[loanIndex]);
      } else if (action === VisitLogAction.MARK_SETTLED) {
        // Mark the account as Paid/Settled so it won't appear in any update queue
        this.loans[loanIndex].status = MovingStatus.PAID;
        this.loans[loanIndex].promiseToPayDate = null;
        this.loans[loanIndex].followUpDate = null;
        this.loans[loanIndex].aiPriority = PriorityLevel.LOWEST;
        await this.api(`/loans/${loanId}`, 'PUT', this.loans[loanIndex]);
      }
    }

    this.save();
    return newLog;
  }

  // Contact Log Methods (Action Tracker)
  getContactLogs(loanId: string): ContactLog[] {
    return this.contactLogs.filter(c => c.loanId === loanId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async addContactLog(loanId: string, contactDate: string, method: ContactMethod, notes: string, clientResponse: string, hasResponse: boolean, loggedBy: string, role: string, personnelAssigned: string = ''): Promise<ContactLog> {
    const id = Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();
    const newLog: ContactLog = {
      id,
      loanId,
      contactDate,
      method,
      notes,
      clientResponse,
      hasResponse,
      personnelAssigned,
      loggedBy,
      timestamp: now
    };

    // Persist to DB first
    await this.api('/contact_logs', 'POST', newLog);
    this.contactLogs.push(newLog);

    // Record audit trail
    const responseStatus = hasResponse ? 'with response' : 'no response';
    const actionDesc = `Contact via ${method} (${responseStatus}): ${notes.substring(0, 50)}${notes.length > 50 ? '...' : ''}`;
    await this.recordHistory(loanId, 'Contact Log', actionDesc, loggedBy, role, 'Action Tracker');

    this.save();
    return newLog;
  }

  getCollectorDistribution(branch?: Branch) {
    const distribution: Record<string, number> = {};
    const filteredLoans = this.getLoans(branch);

    filteredLoans.forEach(loan => {
      const coll = this.getCollectorDisplayName(loan.collector);
      if (!coll || coll === 'N/A' || coll === 'undefined' || coll === 'UNASSIGNED') return;
      distribution[coll] = (distribution[coll] || 0) + 1;
    });

    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  async addDemandLetter(dlData: Omit<DemandLetter, 'id' | 'followUpDate'>, user: string, role: string) {
    const id = Math.random().toString(36).substring(2, 9);
    const followUpDate = this.calculateFollowUpDate(dlData.type, dlData.dateReceived);
    const newDL: DemandLetter = { ...dlData, id, followUpDate };

    // Transactional: Await DB and history log first
    await this.api('/demand_letters', 'POST', newDL);
    await this.recordHistory(dlData.loanId, 'Demand Letter Issued', `Issued: ${dlData.type}`, user, role, 'Legal Process');

    // Only update memory after success
    this.demandLetters.push(newDL);
    if (dlData.remarks) {
      let remarkContent = dlData.remarks;
      if (dlData.type === DemandLetterType.SECOND && !remarkContent.includes('2nd Demand Letter Update:')) {
         remarkContent = `2nd Demand Letter Update: ${remarkContent}`;
      } else if (dlData.type === DemandLetterType.THIRD && !remarkContent.includes('3rd Demand Letter Update:')) {
         remarkContent = `3rd Demand Letter Update: ${remarkContent}`;
      } else if (dlData.type === DemandLetterType.FIRST && !remarkContent.includes('1st Demand Letter Update:')) {
         remarkContent = `1st Demand Letter Update: ${remarkContent}`;
      }
      const remarkText = remarkContent.includes('[DL_MARKER]') ? remarkContent : `${remarkContent} [DL_MARKER]`;
      await this.addRemark(dlData.loanId, remarkText, dlData.collectorName, this.getPriorityFromStatus(newDL), user, role);
    }
    this.save();
    return newDL;
  }

  async updateDemandLetter(id: string, updates: Partial<DemandLetter>, user: string, role: string) {
    const index = this.demandLetters.findIndex(dl => dl.id === id);
    if (index === -1) return null;
    const current = this.demandLetters[index];
    const updated = { ...current, ...updates };

    if (updates.type || updates.dateReceived) {
      updated.followUpDate = this.calculateFollowUpDate(updated.type, updated.dateReceived);
    }

    // Await server confirmation
    await this.api(`/demand_letters/${id}`, 'PUT', updated);

    // Update memory
    this.demandLetters[index] = updated;
    if (updates.status && updates.status !== current.status) {
      await this.recordHistory(updated.loanId, 'Legal Status Update', `Demand letter status changed to ${updates.status}`, user, role, 'Legal Process');
    }
    if (updates.remarks && updates.remarks !== current.remarks) {
      let remarkContent = updates.remarks;
      if (updated.type === DemandLetterType.SECOND && !remarkContent.includes('2nd Demand Letter Update:')) {
         remarkContent = `2nd Demand Letter Update: ${remarkContent}`;
      } else if (updated.type === DemandLetterType.THIRD && !remarkContent.includes('3rd Demand Letter Update:')) {
         remarkContent = `3rd Demand Letter Update: ${remarkContent}`;
      } else if (updated.type === DemandLetterType.FIRST && !remarkContent.includes('1st Demand Letter Update:')) {
         remarkContent = `1st Demand Letter Update: ${remarkContent}`;
      }
      const remarkText = remarkContent.includes('[DL_MARKER]') ? remarkContent : `${remarkContent} [DL_MARKER]`;
      await this.addRemark(updated.loanId, remarkText, updated.collectorName, this.getPriorityFromStatus(updated), user, role);
    } else if (updates.status || updates.followUpDate) {
      const loanIndex = this.loans.findIndex(l => l.id === updated.loanId);
      if (loanIndex !== -1) {
        this.loans[loanIndex].aiPriority = this.getPriorityFromStatus(updated);
        await this.api(`/loans/${updated.loanId}`, 'PUT', this.loans[loanIndex]);
      }
    }
    this.save();
    return updated;
  }

  private calculateFollowUpDate(type: DemandLetterType, dateReceived?: string): string | undefined {
    if (!dateReceived) return undefined;
    const received = new Date(dateReceived + 'T00:00:00');
    if (type === DemandLetterType.FIRST || type === DemandLetterType.SECOND) {
      received.setDate(received.getDate() + 10);
    } else if (type === DemandLetterType.THIRD) {
      received.setDate(received.getDate() + 5);
    }
    const y = received.getFullYear();
    const m = String(received.getMonth() + 1).padStart(2, '0');
    const day = String(received.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private getPriorityFromStatus(dl: DemandLetter): PriorityLevel {
    if (dl.status === DemandLetterStatus.SETTLED) return PriorityLevel.LOWEST;
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (dl.followUpDate && dl.followUpDate <= today) return PriorityLevel.TOP;
    if (dl.status === DemandLetterStatus.FOLLOW_UP) return PriorityLevel.FOLLOW_UP;
    if (dl.type === DemandLetterType.THIRD) return PriorityLevel.TOP;
    return PriorityLevel.MONITOR;
  }

  exportData(user: User, branch: Branch): string {
    const isAdmin = isAllBranchRole(user.role);
    
    const exportLoans = isAdmin ? this.loans : this.loans.filter(l => l.branch === branch);
    const exportCollectors = isAdmin ? this.collectors : this.collectors.filter(c => c.branch === branch);
    const exportDemandLetters = isAdmin ? this.demandLetters : this.demandLetters.filter(d => d.branch === branch);
    const exportUsers = isAdmin ? this.users : this.users;

    const metadata = {
        branchId: isAdmin ? Branch.ALL : branch,
        exportedBy: user.username,
        exportedRole: user.role
    };

    const data = { 
        loans: exportLoans, 
        users: exportUsers, 
        collectors: exportCollectors, 
        demandLetters: exportDemandLetters, 
        version: '1.1', 
        metadata,
        timestamp: new Date().toISOString() 
    };
    return JSON.stringify(data, null, 2);
  }

  importData(jsonData: string, user: User, currentBranch: Branch): { success: boolean, message?: string } {
    try {
      const data = JSON.parse(jsonData);
      const isAdmin = isAllBranchRole(user.role);
      
      const fileBranch = data.metadata?.branchId;

      if (!isAdmin && fileBranch !== currentBranch) {
          return { success: false, message: 'Invalid backup file: Branch mismatch detected.' };
      }

      const targetBranch = fileBranch || Branch.ALL;

      if (targetBranch === Branch.ALL) {
          if (data.loans && Array.isArray(data.loans)) this.loans = data.loans.map((l: any) => ({ ...l, history: l.history || [] }));
          if (data.users && Array.isArray(data.users)) this.users = data.users;
          if (data.collectors && Array.isArray(data.collectors)) this.collectors = dedupeCollectors(data.collectors);
          if (data.demandLetters && Array.isArray(data.demandLetters)) this.demandLetters = data.demandLetters;
      } else {
          if (data.loans && Array.isArray(data.loans)) {
              this.loans = this.loans.filter(l => l.branch !== targetBranch);
              const importedLoans = data.loans.map((l: any) => ({ ...l, history: l.history || [] }));
              this.loans = [...this.loans, ...importedLoans];
          }
          if (data.users && Array.isArray(data.users) && isAdmin) {
              this.users = data.users;
          }
          if (data.collectors && Array.isArray(data.collectors)) {
              this.collectors = this.collectors.filter(c => c.branch !== targetBranch);
              this.collectors = dedupeCollectors([...this.collectors, ...data.collectors]);
          }
          if (data.demandLetters && Array.isArray(data.demandLetters)) {
              this.demandLetters = this.demandLetters.filter(d => d.branch !== targetBranch);
              this.demandLetters = [...this.demandLetters, ...data.demandLetters];
          }
      }

      this.save();
      return { success: true };
    } catch (error) {
      console.error('Failed to import data:', error);
      return { success: false, message: 'Critical Error: Invalid backup file format.' };
    }
  }

  getDispositions(loanId: string): ManagementDisposition[] {
    return this.managementDispositions.filter(d => d.loanId === loanId).sort((a, b) => new Date(b.decisionDate).getTime() - new Date(a.decisionDate).getTime());
  }

  getAllDispositions(): ManagementDisposition[] {
    return [...this.managementDispositions].sort((a, b) => new Date(b.decisionDate).getTime() - new Date(a.decisionDate).getTime());
  }

  async addDisposition(loanId: string, type: DispositionType, reason: string, evidence: string[], decidedBy: string, role: string): Promise<ManagementDisposition> {
    const loan = this.loans.find(l => l.id === loanId);
    if (!loan) throw new Error('Loan not found');

    const newDisposition: ManagementDisposition = {
      id: crypto.randomUUID(),
      loanId,
      type,
      reason,
      evidence,
      status: DispositionStatus.PENDING_REVIEW,
      decidedBy,
      decisionDate: new Date().toISOString()
    };

    try {
      const res = await fetch(`${API_URL}/management_dispositions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDisposition)
      });
      
      if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server error: ${res.status}`);
      }

      this.managementDispositions.push(newDisposition);

      await this.recordHistory(loanId, 'Management Disposition', `Decided: ${type} - ${reason}. Status: Pending Review`, decidedBy, role, 'Management Disposition');
      this.notify();
      return newDisposition;
    } catch (e) {
      console.error('Failed to save disposition to API', e);
      throw e;
    }
  }

  async updateDispositionStatus(id: string, newStatus: DispositionStatus, updatedBy: string, role: string): Promise<void> {
    const disp = this.managementDispositions.find(d => d.id === id);
    if (!disp) throw new Error('Disposition not found');
    if (newStatus === DispositionStatus.APPROVED && !canApproveWriteOff(role)) {
      throw new Error('Sorry! Only the Executive Vice President can Approve Clients');
    }

    try {
      await fetch(`${API_URL}/management_dispositions/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, updatedBy, role })
      });
      
      const oldStatus = disp.status;
      disp.status = newStatus;
      
      await this.recordHistory(disp.loanId, 'Management Disposition Update', `Status changed from ${oldStatus} to ${newStatus} by ${updatedBy}`, updatedBy, role, 'Management Disposition');
      this.notify();
    } catch (e) {
      console.error('Failed to update disposition status', e);
      alert('Failed to update status. Are you offline?');
      throw e;
    }
  }
}

export const store = new DataStore();

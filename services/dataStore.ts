import { Loan, MovingStatus, LocationStatus, Payment, PaymentStatus, User, UserRole, UserStatus, CollectorPerformance, Remark, PriorityLevel, Collector, DemandLetter, DemandLetterType, DemandLetterStatus, Branch, HistoryRecord, RecurringSchedule } from '../types';
const API_URL = 'http://localhost:5000/api';

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
  { id: 'c2', name: 'Jane Smith', nickname: 'JANE', address: '456 Agent Ave, Palompon', branch: Branch.ORMOC },
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
  },
  {
    id: 'l2',
    collector: 'Jane Smith',
    code: '1002',
    firstName: 'Ricardo',
    lastName: 'Dalisay',
    borrowerName: 'Dalisay, Ricardo',
    monthReported: '2023-09',
    dueDate: '2023-10-10',
    outstandingBalance: 25000,
    amountCollected: 25000,
    runningBalance: 0,
    status: MovingStatus.PAID,
    location: LocationStatus.LOCATED,
    area: 'Area 2',
    city: 'Manila',
    barangay: 'Binondo',
    fullAddress: '456 Binondo Square, Manila',
    payments: [],
    remarks: [],
    history: [],
    aiPriority: PriorityLevel.LOWEST,
    promiseToPayDate: null,
    branch: Branch.ORMOC
  }
];

class DataStore {
  private loans: Loan[] = [];
  private users: User[] = [];
  private collectors: Collector[] = [];
  private demandLetters: DemandLetter[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadFromLocalStorage();
    this.refresh();
  }

  async refresh() {
    try {
      console.log('Syncing with Local PostgreSQL via Bridge...');
      const [dbLoans, dbUsers, dbCollectors, dbDLs, dbPayments, dbRemarks, dbLogs] = await Promise.all([
        fetch(`${API_URL}/loans`).then(r => r.json()),
        fetch(`${API_URL}/users`).then(r => r.json()),
        fetch(`${API_URL}/collectors`).then(r => r.json()),
        fetch(`${API_URL}/demand_letters`).then(r => r.json()),
        fetch(`${API_URL}/payments`).then(r => r.json()),
        fetch(`${API_URL}/remarks`).then(r => r.json()),
        fetch(`${API_URL}/activity_logs`).then(r => r.json())
      ]);

      // Mapping logic...
      const parseJson = (val: any) => {
        if (typeof val === 'string') {
          try { return JSON.parse(val); } catch (e) { return val; }
        }
        return val;
      };

      const mappedLoans = dbLoans.map((l: any) => ({
        ...l,
        collector: l.collector || 'UNASSIGNED',
        code: l.code || 'N/A',
        firstName: l.first_name || '',
        lastName: l.last_name || '',
        outstandingBalance: Number(l.outstanding_balance || 0),
        amountCollected: Number(l.amount_collected || 0),
        runningBalance: Number(l.running_balance || 0),
        borrowerName: l.borrower_name || 'Unnamed Client',
        monthReported: l.month_reported || '',
        dueDate: l.due_date || '',
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
        branch: l.branch || Branch.ALL,
        payments: dbPayments.filter((p: any) => p.loan_id === l.id).map((p: any) => ({ 
          ...p, 
          loanId: p.loan_id, 
          amount: Number(p.amount), 
          balanceAfter: Number(p.balance_after), 
          orNumber: p.or_number || p.orNumber,
          createdAt: p.created_at || p.createdAt || new Date(p.date).toISOString()
        })) as unknown as Payment[],
        remarks: dbRemarks.filter((r: any) => r.loan_id === l.id).map((r: any) => ({ ...r, ptpDate: r.ptp_date, followUpDate: r.follow_up_date })) as unknown as Remark[],
        history: dbLogs.filter((log: any) => log.loan_id === l.id).map((log: any) => ({ ...log, user: log.user_name, role: log.user_role })) as unknown as HistoryRecord[]
      }));

      // Conservative Merge Rule:
      // Don't wipe local loans that haven't synced to server yet
      const serverIDs = new Set(mappedLoans.map(l => l.id));
      const localOnly = this.loans.filter(l => !serverIDs.has(l.id));
      
      this.loans = [...mappedLoans, ...localOnly];

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
        this.recalculateLoanFinances(loan.id);
        this.syncLoanInteractionDates(loan.id);
      });

      this.users = dbUsers.map((u: any) => ({
        ...u,
        fullName: u.full_name,
        statusHistory: parseJson(u.status_history) || [],
        createdAt: u.created_at
      }));

      this.collectors = dbCollectors as unknown as Collector[];
      this.demandLetters = dbDLs.map((d: any) => ({
        ...d,
        loanId: d.loan_id,
        collectorName: d.collector_name,
        borrowerName: d.borrower_name,
        datePrepared: d.date_prepared,
        dateReceived: d.date_received,
        followUpDate: d.follow_up_date
      })) as unknown as DemandLetter[];

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

  private loadFromLocalStorage() {
    const savedLoans = localStorage.getItem('melann_loans');
    const savedUsers = localStorage.getItem('melann_users');
    const savedCollectors = localStorage.getItem('melann_collectors');
    const savedDemandLetters = localStorage.getItem('melann_demand_letters');
    this.loans = savedLoans ? JSON.parse(savedLoans).map((l: any) => ({ ...l, history: l.history || [] })) : INITIAL_LOANS.map(l => ({ ...l, history: [] }));
    this.users = savedUsers ? JSON.parse(savedUsers).map((u: any) => ({ ...u, statusHistory: u.statusHistory || [] })) : INITIAL_USERS;
    this.collectors = savedCollectors ? JSON.parse(savedCollectors) : INITIAL_COLLECTORS;
    this.demandLetters = savedDemandLetters ? JSON.parse(savedDemandLetters) : [];
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
    localStorage.setItem('melann_loans', JSON.stringify(this.loans));
    localStorage.setItem('melann_users', JSON.stringify(this.users));
    localStorage.setItem('melann_collectors', JSON.stringify(this.collectors));
    localStorage.setItem('melann_demand_letters', JSON.stringify(this.demandLetters));
    this.notify();
  }

  // User accounts are permanent system records and must never be deleted.
  // Access control is managed exclusively through the 'status' property.
  getUsers() { return this.users; }

  authenticate(username: string): { user: User | null; error?: string } {
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

    return { user };
  }

  async registerUser(userData: Omit<User, 'id' | 'status' | 'createdAt' | 'statusHistory'>, creatorName?: string) {
    const id = Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();
    const newUser: User = {
      ...userData,
      id,
      status: UserStatus.PENDING,
      createdAt: now,
      createdBy: creatorName,
      statusHistory: [{ status: UserStatus.PENDING, updatedAt: now, updatedBy: creatorName || 'Self-Registration' }]
    };

    // Await server confirmation
    await this.api('/users', 'POST', newUser);
    
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

  getCollectors(branch?: Branch) {
    if (!branch || branch === Branch.ALL) return this.collectors;
    return this.collectors.filter(c => c.branch === branch);
  }

  async addCollector(name: string, branch: Branch, address?: string, nickname?: string) {
    const id = Math.random().toString(36).substring(2, 9);
    const newCollector: Collector = { id, name, nickname, address, branch };
    
    // Await server confirmation
    await this.api('/collectors', 'POST', newCollector);

    this.collectors.push(newCollector);
    this.save();
    return newCollector;
  }

  async updateCollector(id: string, name: string, branch: Branch, address?: string, nickname?: string) {
    const index = this.collectors.findIndex(c => c.id === id);
    if (index !== -1) {
      const oldName = this.collectors[index].name;
      const oldNick = this.collectors[index].nickname;
      
      // Await server confirmation
      await this.api(`/collectors/${id}`, 'PUT', { name, nickname, address, branch });

      this.collectors[index] = { ...this.collectors[index], name, address, branch, nickname };
      this.loans.forEach(l => {
        if (l.collector === oldName || (oldNick && l.collector === oldNick)) {
          l.collector = nickname || name;
        }
      });
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

    const newAdditions: Loan[] = [];

    if (importMode === 'replace') {
      // Find matching codes and update existing ones, only push truly new ones
      for (const newLoan of loans) {
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
      for (const newLoan of loans) {
         const existing = this.loans.find(l => l.code === newLoan.code);
         if (!existing) {
             newAdditions.push(newLoan);
         } else {
             skippedCount++;
         }
      }
    }

    const finalAdditions = importMode === 'wipe' ? loans : newAdditions;

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
    if (!branch || branch === Branch.ALL) return this.loans;
    return this.loans.filter(l => l.branch === branch);
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

    // Strict Transactional Save: Await server confirmation BEFORE updating local memory
    await this.api(`/loans/${id}`, 'PUT', updated);

    // Apply updates and Recalculate using authoritative logic ONLY after API success
    this.loans[index] = updated;
    const fullyUpdated = this.recalculateLoanFinances(id)!;

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
    const today = new Date().toISOString().split('T')[0];
    
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
    } else if (latestPTPRemark && latestPTPRemark.ptpDate) {
      loan.promiseToPayDate = latestPTPRemark.ptpDate;
    }

    // 2. Sync Follow-up
    const latestFURemark = [...loan.remarks].reverse().find(r => r.followUpDate);
    if (latestFURemark && latestFURemark.followUpDate) {
      loan.followUpDate = latestFURemark.followUpDate;
    }

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

    this.loans[loanIndex].remarks[remarkIndex].text = text;
    this.loans[loanIndex].remarks[remarkIndex].ptpDate = ptpDate;
    this.loans[loanIndex].remarks[remarkIndex].followUpDate = followUpDate;
    
    this.syncLoanInteractionDates(loanId);
    
    // Manual priority override if provided (AI sentiment)
    if (priority) {
      this.loans[loanIndex].aiPriority = priority;
    }

    await this.recordHistory(loanId, 'Remark Edited', `Remark edited: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`, user, role, 'Field Intelligence');

    this.save();

    await this.api(`/remarks/${remarkId}`, 'PUT', { text, ptpDate, followUpDate });
    await this.api(`/loans/${loanId}`, 'PUT', this.loans[loanIndex]);
  }

  async deleteLoan(id: string) {
    // Transactional: Await server confirmation before local removal
    await this.api(`/loans/${id}`, 'DELETE');
    this.loans = this.loans.filter(l => l.id !== id);
    this.save();
    this.notify();
  }

  getLoanByCode(code: string) {
    return this.loans.find(l => l.code === code);
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

    let currentBalance = loan.outstandingBalance;
    let totalCollected = 0;

    // Sequential calculation of running balance
    activePayments.forEach(p => {
      currentBalance -= p.amount;
      totalCollected += p.amount;
      p.balanceAfter = currentBalance;
    });

    // Clamp running balance to 0 (no negative balances)
    const finalRunning = Math.max(0, currentBalance);

    // Sync loan status and totals
    loan.runningBalance = finalRunning;
    loan.amountCollected = totalCollected;
    loan.status = finalRunning <= 0 ? MovingStatus.PAID : (loan.status === MovingStatus.PAID ? MovingStatus.MOVING : loan.status);

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
        return candidate.toISOString().split('T')[0];
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
    return candidate.toISOString().split('T')[0];
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
        return ref.toISOString().split('T')[0];
      }
    }
    
    // If no day found in current week, wrap to the first available day next week
    ref.setDate(ref.getDate() + (7 - currentDayOfWeek + sorted[0]));
    return ref.toISOString().split('T')[0];
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

    // Transactional: Await server confirmation before local update
    try {
      await this.api('/payments', 'POST', { loanId, ...newPayment });
    } catch (apiErr: any) {
      if (apiErr.message && apiErr.message.includes('payments_loan_id_fkey')) {
        console.warn('Foreign key missing. Auto-syncing loan to server first...');
        await this.api('/loans/bulk', 'POST', [loan]);
        await this.api('/payments', 'POST', { loanId, ...newPayment });
      } else {
        throw apiErr;
      }
    }

    // Only update local memory after server success
    this.loans[index].payments.push(newPayment);
    const updatedLoan = this.recalculateLoanFinances(loanId);

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

    // Mark as reversed
    loan.payments[paymentIndex].status = PaymentStatus.REVERSED;
    loan.payments[paymentIndex].remarks = reason ? `${payment.remarks || ''} (REVERSED: ${reason})` : `${payment.remarks || ''} (REVERSED)`;

    // Authoritative Recalculation
    const updatedLoan = this.recalculateLoanFinances(loan.id)!;

    this.loans[loanIndex] = updatedLoan;
    await this.recordHistory(loan.id, 'Payment Reversed', `Payment OR: ${orNumber} (₱${payment.amount.toLocaleString()}) reversed. Reason: ${reason || 'Not specified'}. New balance: ₱${updatedLoan.runningBalance.toLocaleString()}`, recorder, role, 'Payment Stream');
    this.save();

    await this.api(`/payments/${orNumber}`, 'PUT', { status: PaymentStatus.REVERSED, remarks: loan.payments[paymentIndex].remarks });
    await this.api(`/loans/${loan.id}`, 'PUT', updatedLoan);

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

  getDailyCollections(date: string, branch?: Branch) {
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
      loan.payments
        .filter(p => p.date === date && p.status === PaymentStatus.GOOD)
        .forEach(p => {
          transactions.push({
            loanId: loan.id,
            borrowerName: loan.borrowerName,
            collector: loan.collector,
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
      if (!collectorMap[t.collector]) {
        collectorMap[t.collector] = { collector: t.collector, totalAccounts: 0, totalAmount: 0 };
      }
      collectorMap[t.collector].totalAccounts++;
      collectorMap[t.collector].totalAmount += t.amount;
    });

    const collectorSummary = Object.values(collectorMap).sort((a, b) => b.totalAmount - a.totalAmount);
    const grandTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
    const grandTotalAccounts = transactions.length;

    return { transactions, collectorSummary, grandTotal, grandTotalAccounts };
  }


  getStats(branch?: Branch) {
    const filteredLoans = this.getLoans(branch);
    const totalAccounts = filteredLoans.length;
    const totalCollected = filteredLoans.reduce((sum, l) => sum + l.amountCollected, 0);
    const totalOutstanding = filteredLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);
    const totalRunning = filteredLoans.reduce((sum, l) => sum + l.runningBalance, 0);
    const statusData = {
      [MovingStatus.PAID]: { count: 0, amount: 0 },
      [MovingStatus.MOVING]: { count: 0, amount: 0 },
      [MovingStatus.NM]: { count: 0, amount: 0 },
      [MovingStatus.NMSR]: { count: 0, amount: 0 }
    };
    filteredLoans.forEach(l => {
      const s = l.status;
      if (statusData[s]) {
        statusData[s].count++;
        statusData[s].amount += (s === MovingStatus.PAID ? l.amountCollected : l.runningBalance);
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
      }
    };
  }

  getCollectorPerformance(branch?: Branch) {
    const collectors: Record<string, CollectorPerformance> = {};
    const filteredLoans = this.getLoans(branch);
    filteredLoans.forEach(loan => {
      const coll = loan.collector?.trim();
      if (!coll || coll === 'N/A' || coll === 'undefined' || coll === 'UNASSIGNED') return;

      if (!collectors[coll]) {
        collectors[coll] = { collector: coll, totalAccounts: 0, reportedAmount: 0, collectedAmount: 0, runningBalance: 0, collectionRate: 0, paidCount: 0 };
      }
      const p = collectors[coll];
      p.totalAccounts++;
      p.reportedAmount += loan.outstandingBalance;
      p.collectedAmount += loan.amountCollected;
      p.runningBalance += loan.runningBalance;
      if (loan.status === MovingStatus.PAID) p.paidCount++;
    });
    return Object.values(collectors).map(p => ({ ...p, collectionRate: p.reportedAmount > 0 ? (p.collectedAmount / p.reportedAmount) * 100 : 0 }));
  }

  getDemandLetters(branch?: Branch) {
    if (!branch || branch === Branch.ALL) return this.demandLetters;
    return this.demandLetters.filter(dl => dl.branch === branch);
  }

  getCollectorDistribution(branch?: Branch) {
    const distribution: Record<string, number> = {};
    const filteredLoans = this.getLoans(branch);

    filteredLoans.forEach(loan => {
      const coll = loan.collector?.trim();
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
    const received = new Date(dateReceived);
    if (type === DemandLetterType.FIRST || type === DemandLetterType.SECOND) {
      received.setDate(received.getDate() + 10);
      return received.toISOString().split('T')[0];
    } else if (type === DemandLetterType.THIRD) {
      received.setDate(received.getDate() + 5);
      return received.toISOString().split('T')[0];
    }
    return undefined;
  }

  private getPriorityFromStatus(dl: DemandLetter): PriorityLevel {
    if (dl.status === DemandLetterStatus.SETTLED) return PriorityLevel.LOWEST;
    const today = new Date().toISOString().split('T')[0];
    if (dl.followUpDate && dl.followUpDate <= today) return PriorityLevel.TOP;
    if (dl.status === DemandLetterStatus.FOLLOW_UP) return PriorityLevel.FOLLOW_UP;
    if (dl.type === DemandLetterType.THIRD) return PriorityLevel.TOP;
    return PriorityLevel.MONITOR;
  }

  exportData(user: User, branch: Branch): string {
    const isAdmin = user.role === UserRole.SUPER_ADMIN;
    
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
      const isAdmin = user.role === UserRole.SUPER_ADMIN;
      
      const fileBranch = data.metadata?.branchId;

      if (!isAdmin && fileBranch !== currentBranch) {
          return { success: false, message: 'Invalid backup file: Branch mismatch detected.' };
      }

      const targetBranch = fileBranch || Branch.ALL;

      if (targetBranch === Branch.ALL) {
          if (data.loans && Array.isArray(data.loans)) this.loans = data.loans.map((l: any) => ({ ...l, history: l.history || [] }));
          if (data.users && Array.isArray(data.users)) this.users = data.users;
          if (data.collectors && Array.isArray(data.collectors)) this.collectors = data.collectors;
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
              this.collectors = [...this.collectors, ...data.collectors];
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
}

export const store = new DataStore();


export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COLLECTOR = 'COLLECTOR',
  CASHIER = 'CASHIER',
  SUPERVISOR = 'SUPERVISOR',
  IT_ACCOUNTING_CLERK = 'IT_ACCOUNTING_CLERK',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  OPERATIONS_MANAGER = 'OPERATIONS_MANAGER',
  EXECUTIVE_VICE_PRESIDENT = 'EXECUTIVE_VICE_PRESIDENT',
  PRESIDENT = 'PRESIDENT',
  NAVAL_USER = 'NAVAL_USER',
  ORMOC_USER = 'ORMOC_USER'
}

export const ACCOUNT_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: UserRole.COLLECTOR, label: 'Collector' },
  { value: UserRole.CASHIER, label: 'Cashier' },
  { value: UserRole.SUPERVISOR, label: 'Supervisor' },
  { value: UserRole.IT_ACCOUNTING_CLERK, label: 'IT/Accounting Clerk' },
  { value: UserRole.BRANCH_MANAGER, label: 'Branch Manager' },
  { value: UserRole.OPERATIONS_MANAGER, label: 'Operations Manager' },
  { value: UserRole.EXECUTIVE_VICE_PRESIDENT, label: 'Executive Vice President' },
  { value: UserRole.PRESIDENT, label: 'President' },
  { value: UserRole.SUPER_ADMIN, label: 'Super Admin' },
];

export const ACCOUNT_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.COLLECTOR]: 'Can view only assigned clients and field modules. Cannot add, edit, or delete client records.',
  [UserRole.CASHIER]: 'Can view all records. Can edit remarks and action tracker follow-ups when collection support is needed.',
  [UserRole.SUPERVISOR]: 'Can view records for assigned collectors only, with read-only access to client update and field modules.',
  [UserRole.IT_ACCOUNTING_CLERK]: 'Can access most modules with add, edit, and delete rights, except write-off approval and user management.',
  [UserRole.BRANCH_MANAGER]: 'Can manage branch operations and client records, with access aligned to management-level branch oversight.',
  [UserRole.OPERATIONS_MANAGER]: 'Can access most modules with add, edit, and delete rights, except write-off approval and user management.',
  [UserRole.EXECUTIVE_VICE_PRESIDENT]: 'Can access operational modules and is the only role authorized to approve for-write-off clients, except user management.',
  [UserRole.PRESIDENT]: 'Can access operational modules and view write-off records, except user management and write-off approval.',
  [UserRole.SUPER_ADMIN]: 'Full system access, including all modules, all branches, and user management. Write-off approval remains Executive Vice President only.',
  [UserRole.NAVAL_USER]: 'Legacy Naval branch user role, scoped to Naval Branch records.',
  [UserRole.ORMOC_USER]: 'Legacy Ormoc branch user role, scoped to Ormoc Branch records.',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.COLLECTOR]: 'Collector',
  [UserRole.CASHIER]: 'Cashier',
  [UserRole.SUPERVISOR]: 'Supervisor',
  [UserRole.IT_ACCOUNTING_CLERK]: 'IT/Accounting Clerk',
  [UserRole.BRANCH_MANAGER]: 'Branch Manager',
  [UserRole.OPERATIONS_MANAGER]: 'Operations Manager',
  [UserRole.EXECUTIVE_VICE_PRESIDENT]: 'Executive Vice President',
  [UserRole.PRESIDENT]: 'President',
  [UserRole.NAVAL_USER]: 'Naval Branch User',
  [UserRole.ORMOC_USER]: 'Ormoc Branch User',
};

export const getUserRoleLabel = (role: UserRole) => USER_ROLE_LABELS[role] || String(role).replace(/_/g, ' ');

export const canManageUsers = (role: UserRole) => role === UserRole.SUPER_ADMIN;

export const canAccessPayments = (role: UserRole | string) =>
  role === UserRole.SUPER_ADMIN ||
  role === UserRole.IT_ACCOUNTING_CLERK ||
  role === UserRole.BRANCH_MANAGER;

export const canApproveWriteOff = (role: UserRole | string) => role === UserRole.EXECUTIVE_VICE_PRESIDENT;

export const isAllBranchRole = (role: UserRole) => role === UserRole.SUPER_ADMIN;

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED'
}

export enum Branch {
  NAVAL = 'Naval Branch',
  ORMOC = 'Ormoc Branch',
  ALL = 'All Branches'
}

export interface StatusUpdate {
  status: UserStatus;
  updatedAt: string;
  updatedBy: string;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  passwordHash?: string;
  role: UserRole;
  status: UserStatus;
  branch: Branch;
  createdAt: string;
  createdBy?: string;
  statusHistory: StatusUpdate[];
}

export enum MovingStatus {
  PAID = 'Paid',
  MOVING = 'M',
  NM = 'NM',
  NMSR = 'NMSR'
}

export enum LocationStatus {
  LOCATED = 'L',
  NOT_LOCATED = 'NL'
}


export enum PriorityLevel {
  TOP = 'Top Priority',
  NEED_ATTENTION = 'Need Attention / Full Commitment',
  FOLLOW_UP = 'Follow-up',
  MONITOR = 'Monitor Closely',
  LOWEST = 'Lowest Priority'
}

export interface Remark {
  id: string;
  text: string;
  timestamp: string;
  collector: string;
  ptpDate?: string | null;
  followUpDate?: string | null;
}

export enum PaymentStatus {
  GOOD = 'GOOD',
  REVERSED = 'REVERSED'
}

export interface Payment {
  id: string;
  loanId: string;
  date: string;
  orNumber: string;
  amount: number;
  balanceAfter: number;
  recorder: string;
  remarks?: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface Collector {
  id: string;
  name: string;
  nickname?: string;
  address?: string;
  assignedSupervisor?: string;
  photoUrl?: string;
  branch: Branch;
}

export interface HistoryRecord {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  user: string;
  role: string;
  module: string;
}

export interface RecurringSchedule {
  enabled: boolean;
  type?: 'monthly' | 'weekly'; // Optional for backwards compatibility
  days: number[];          // e.g. [15, 30]
  weekDays?: number[];     // e.g. [0, 6] (0 = Sunday, 6 = Saturday)
  nextDueDate: string;     // ISO date string, auto-calculated
  startDate?: string;      // ISO date when this recurring schedule started being tracked
  lastPaidDate?: string;   // ISO date of last satisfying payment
}

export interface Loan {
  id: string;
  collector: string;
  code: string;
  borrowerName: string;
  firstName: string;
  lastName: string;
  monthReported: string; // YYYY-MM
  dueDate: string;
  dateRelease?: string | null;
  principal?: number | null;
  totalLoan?: number | null;
  outstandingBalance: number;
  amountCollected: number;
  runningBalance: number;
  status: MovingStatus;
  location: LocationStatus;
  area: string;
  city: string;
  barangay: string;
  fullAddress: string;
  payments: Payment[];
  remarks: Remark[];
  history: HistoryRecord[];
  aiPriority?: PriorityLevel;
  contactNumber?: string;
  promiseToPayDate?: string | null;
  followUpDate?: string | null;
  recurringSchedule?: RecurringSchedule | null;
  branch: Branch;
  actionNote?: string | null;
  actionStage?: string | null;
}

export interface CollectorPerformance {
  collector: string;
  totalAccounts: number;
  reportedAmount: number;
  collectedAmount: number;
  runningBalance: number;
  collectionRate: number;
  paidCount: number;
}

export enum DemandLetterType {
  FIRST = '1st Demand Letter',
  SECOND = '2nd Demand Letter',
  THIRD = '3rd Demand Letter'
}

export enum DemandLetterStatus {
  PENDING = 'Pending',
  FOLLOW_UP = 'For Follow-Up',
  SETTLED = 'Settled'
}

export interface DemandLetter {
  id: string;
  collectorName: string;
  loanId: string;
  borrowerName: string;
  type: DemandLetterType;
  datePrepared: string;
  dateReceived?: string;
  followUpDate?: string;
  status: DemandLetterStatus;
  remarks: string;
  branch: Branch;
  courrier?: 'Mailed' | 'Personal Service';
}

export enum VisitLogAction {
  LOG_ONLY = 'Log Only',
  RETURN_TO_UPDATE = 'Returned to Client Update',
  MARK_SETTLED = 'Marked as Settled'
}

export interface VisitLog {
  id: string;
  loanId: string;
  visitDate: string;
  collectorNotes: string;
  clientComment: string;
  visitedByCollector: boolean;
  action: VisitLogAction;
  personnelAssigned: string;
  loggedBy: string;
  timestamp: string;
}

export enum ContactMethod {
  CALL = 'Call',
  TEXT_SMS = 'Text/SMS',
  SOCIAL_MEDIA = 'Social Media',
  CHAT_MESSENGER = 'Chat/Messenger',
  EMAIL = 'Email',
  OTHER = 'Other'
}

export interface ContactLog {
  id: string;
  loanId: string;
  contactDate: string;
  method: ContactMethod;
  notes: string;
  clientResponse: string;
  hasResponse: boolean;
  personnelAssigned: string;
  loggedBy: string;
  timestamp: string;
}

export interface DeletedLoan {
  id: string;
  originalLoanData: Loan;
  deletedBy: string;
  deletedAt: string;
  reason?: string;
  branch: Branch;
}

export interface MigrationAccount {
  sourceLoanId: string;
  sourceCode: string;
  loan: Loan;
  payments: Payment[];
  isEdited?: boolean;
}

export interface MigrationBatch {
  id: string;
  cycleStart: string;
  cycleEnd: string;
  status: 'PENDING' | 'MIGRATED' | 'EMPTY' | 'ERROR';
  detectedCount: number;
  paymentCount: number;
  payload: {
    sourcePath: string;
    cycleStart: string;
    cycleEnd: string;
    accounts: MigrationAccount[];
  };
  sourcePath: string;
  detectedAt: string;
  migratedAt?: string | null;
  migratedBy?: string | null;
    error?: string | null;
}

export enum DispositionType {
  PROSPECT_WRITE_OFF = 'Prospect for Write-Off',
  RECOMMEND_LEGAL = 'Recommend for Legal',
  FOR_RESTRUCTURING = 'For Restructuring',
  SETTLEMENT_NEGOTIATION = 'For Settlement Negotiation',
  RETAIN_COLLECTION = 'Retain in Collection',
  DEAD_ACCOUNT = 'For Dead Account Filing'
}

export enum DispositionStatus {
  PENDING_REVIEW = 'Pending Review',
  APPROVED = 'Approved',
  EXECUTED = 'Executed',
  REJECTED = 'Rejected'
}

export interface ManagementDisposition {
  id: string;
  loanId: string;
  type: DispositionType;
  reason: string;
  evidence: string[];
  status: DispositionStatus;
  decidedBy: string;
  decisionDate: string;
}

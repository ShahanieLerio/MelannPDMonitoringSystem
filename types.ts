
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  NAVAL_USER = 'NAVAL_USER',
  ORMOC_USER = 'ORMOC_USER'
}

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
}

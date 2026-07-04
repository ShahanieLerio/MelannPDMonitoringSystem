import { Branch, Loan, MovingStatus, Payment, PaymentStatus } from '../types';

export const ACTIVE_PORTFOLIO_MATURITY_START = '2016-01-01';
export const ACTIVE_PORTFOLIO_MATURITY_END = '2026-03-31';
export const JCASH_MIGRATION_PAYMENT_REMARK = 'Migrated from jcashdb.mdb';

export function normalizeDateOnly(value?: string | null): string {
  if (!value) return '';
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

export function isLoanMaturityInActivePortfolioRange(dueDate?: string | null): boolean {
  const normalized = normalizeDateOnly(dueDate);
  return normalized >= ACTIVE_PORTFOLIO_MATURITY_START && normalized <= ACTIVE_PORTFOLIO_MATURITY_END;
}

type PortfolioLoanShape = {
  id?: Loan['id'];
  branch?: Loan['branch'];
  dueDate?: Loan['dueDate'];
  payments?: Loan['payments'];
  status?: Loan['status'];
  amountCollected?: Loan['amountCollected'];
};

export function isJcashMigratedLoan(loan: PortfolioLoanShape): boolean {
  return (loan.payments || []).some(payment => payment.remarks === JCASH_MIGRATION_PAYMENT_REMARK);
}

export function isZeroPaymentJcashSourceLoan(
  loan: PortfolioLoanShape
): boolean {
  return loan.branch === Branch.ORMOC &&
    /^\d+$/.test(String(loan.id || '')) &&
    (loan.status === MovingStatus.NMSR || Number(loan.amountCollected || 0) === 0);
}

export function isLoanAllowedInActivePortfolio(loan: PortfolioLoanShape): boolean {
  return isLoanMaturityInActivePortfolioRange(loan.dueDate) ||
    isJcashMigratedLoan(loan) ||
    isZeroPaymentJcashSourceLoan(loan);
}

export function isReconstructedPaymentRemark(remarks?: string | null): boolean {
  if (!remarks) return false;
  return /\b(recon|reconstruct|reconstructed|reconstruction)\b/i.test(remarks);
}

export function isNonReportableCollectionRemark(remarks?: string | null): boolean {
  if (!remarks) return false;
  return /\b(recon|reconstruct|reconstructed|reconstruction|deceased|dead|write[-\s]?off)\b/i.test(remarks);
}

export function isReportableCollectionPayment(payment: Pick<Payment, 'status' | 'remarks'>): boolean {
  return payment.status !== PaymentStatus.REVERSED && !isNonReportableCollectionRemark(payment.remarks);
}

export function hasActiveClientBalance(loan: Pick<Loan, 'runningBalance' | 'status'>): boolean {
  return Number(loan.runningBalance || 0) > 0 && loan.status !== MovingStatus.PAID;
}

/**
 * Checks if a loan is a "Dead" write-off: fully paid only because the borrower
 * died, meaning no actual money was collected. These should be excluded from
 * collection performance metrics.
 *
 * A loan qualifies as a Dead write-off when:
 * Any of its remarks contain the word "Dead" or "Deceased" (case-insensitive).
 * We do not require the calculated status to be PAID because the mathematical
 * balance might not be 0, but the business considers them written off.
 */
export function isDeadWriteOffLoan(loan: Loan): boolean {
  const hasDeadIntelRemark = loan.remarks.some(r => {
    const text = r.text.toLowerCase().trim();
    return /\b(dead|deceased)\b/.test(text);
  });

  const hasDeadPaymentRemark = loan.payments.some(p => {
    if (!p.remarks) return false;
    const text = p.remarks.toLowerCase().trim();
    return /\b(dead|deceased)\b/.test(text);
  });

  return hasDeadIntelRemark || hasDeadPaymentRemark;
}

import { Loan, PaymentStatus, Remark } from '../types';

export type EscalationMissType = 'PTP' | 'Follow-up' | 'Recurring Schedule';

export interface EscalationMiss {
  id: string;
  type: EscalationMissType;
  dueDate: string;
  remark?: Remark;
  context: string;
}

export interface PTPEscalationCase extends Loan {
  missedCommitments: EscalationMiss[];
  missedCount: number;
  latestMissedDate: string;
  latestMissedContext: string;
}

const getLocalISODate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeDate = (value?: string | null) => value ? value.slice(0, 10) : null;

const hasGoodPaymentInWindow = (loan: Loan, dueDate: string, nextDueDate?: string) => {
  return (loan.payments || []).some(payment => {
    if (payment.status !== PaymentStatus.GOOD) return false;
    const paymentDate = normalizeDate(payment.date);
    if (!paymentDate) return false;
    return paymentDate >= dueDate && (!nextDueDate || paymentDate < nextDueDate);
  });
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const isEverydayCollectionDate = (date: Date) => date.getDay() !== 0;

const getNextEverydayCollectionDate = (date: Date) => {
  let next = addDays(date, 1);
  while (!isEverydayCollectionDate(next)) {
    next = addDays(next, 1);
  }
  return next;
};

const getRecurringMissedDates = (loan: Loan, todayStr: string) => {
  const schedule = loan.recurringSchedule;
  if (!schedule?.enabled) return [];

  const missedDates: string[] = [];
  const startBase = normalizeDate(schedule.startDate) || todayStr;
  if (!startBase) return missedDates;

  const start = new Date(`${startBase}T00:00:00`);
  const today = new Date(`${todayStr}T00:00:00`);
  let cursor = start;

  while (cursor < today && missedDates.length < 12) {
    const candidate = getLocalISODate(cursor);
    const isScheduled =
      schedule.type === 'everyday'
        ? isEverydayCollectionDate(cursor)
        : schedule.type === 'weekly'
        ? Boolean(schedule.weekDays?.includes(cursor.getDay()))
        : Boolean(schedule.days?.includes(cursor.getDate()));

    if (isScheduled && candidate < todayStr) {
      missedDates.push(candidate);
    }

    cursor = addDays(cursor, 1);
  }

  return missedDates;
};

const getLatestEverydayMissedStreak = (missedCommitments: EscalationMiss[]) => {
  const recurringMisses = missedCommitments
    .filter(miss => miss.type === 'Recurring Schedule')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  let currentStreak: EscalationMiss[] = [];
  let latestStreak: EscalationMiss[] = [];

  recurringMisses.forEach(miss => {
    const previous = currentStreak[currentStreak.length - 1];
    if (!previous) {
      currentStreak = [miss];
    } else {
      const expectedNext = getLocalISODate(getNextEverydayCollectionDate(new Date(`${previous.dueDate}T00:00:00`)));
      currentStreak = miss.dueDate === expectedNext ? [...currentStreak, miss] : [miss];
    }

    if (currentStreak.length >= latestStreak.length) {
      latestStreak = currentStreak;
    }
  });

  return latestStreak;
};

export const getPTPEscalationCases = (loans: Loan[], todayStr = getLocalISODate(new Date())): PTPEscalationCase[] => {
  return loans
    .map(loan => {
      if (loan.status === 'Paid' || loan.runningBalance <= 0) return null;

      const commitmentCandidates = (loan.remarks || [])
        .flatMap(remark => {
          const items: EscalationMiss[] = [];
          const ptpDate = normalizeDate(remark.ptpDate);
          const followUpDate = normalizeDate(remark.followUpDate);

          if (ptpDate && ptpDate < todayStr) {
            items.push({
              id: `${remark.id}-ptp`,
              type: 'PTP',
              dueDate: ptpDate,
              remark,
              context: remark.text || 'Promise to pay schedule'
            });
          }

          if (followUpDate && followUpDate < todayStr) {
            items.push({
              id: `${remark.id}-follow-up`,
              type: 'Follow-up',
              dueDate: followUpDate,
              remark,
              context: remark.text || 'Follow-up commitment'
            });
          }

          return items;
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      const recurringCandidates = getRecurringMissedDates(loan, todayStr).map((dueDate, index) => ({
        id: `${loan.id}-recurring-${dueDate}-${index}`,
        type: 'Recurring Schedule' as const,
        dueDate,
        context: 'Scheduled payment was not satisfied.'
      }));

      const allCandidates = [...commitmentCandidates, ...recurringCandidates]
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      const missedCommitments = allCandidates.filter((candidate, index) => {
        const nextDueDate = allCandidates[index + 1]?.dueDate;
        return !hasGoodPaymentInWindow(loan, candidate.dueDate, nextDueDate);
      });

      if (loan.recurringSchedule?.enabled && loan.recurringSchedule.type === 'everyday') {
        const everydayMissedStreak = getLatestEverydayMissedStreak(missedCommitments);
        if (everydayMissedStreak.length < 3) return null;

        const latestMissed = everydayMissedStreak[everydayMissedStreak.length - 1];
        return {
          ...loan,
          missedCommitments: everydayMissedStreak,
          missedCount: everydayMissedStreak.length,
          latestMissedDate: latestMissed.dueDate,
          latestMissedContext: latestMissed.context
        };
      }

      if (missedCommitments.length < 3) return null;

      const latestMissed = missedCommitments[missedCommitments.length - 1];
      return {
        ...loan,
        missedCommitments,
        missedCount: missedCommitments.length,
        latestMissedDate: latestMissed.dueDate,
        latestMissedContext: latestMissed.context
      };
    })
    .filter((item): item is PTPEscalationCase => Boolean(item))
    .sort((a, b) => b.missedCount - a.missedCount || b.latestMissedDate.localeCompare(a.latestMissedDate));
};

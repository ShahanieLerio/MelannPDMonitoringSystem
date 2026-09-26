import { useState, useEffect, useMemo } from 'react';
import { store } from '../services/dataStore';
import { Branch, PriorityLevel, Loan, Remark } from '../types';
import { hasActiveClientBalance } from '../services/loanUtils';

export interface ReminderItem {
  loan: Loan;
  date: string; // ISO date or "Tomorrow"
  type: 'Payment' | 'Visit' | 'Callback' | 'Follow-up';
  context: string;
}

const normalizeRemarkDate = (value?: string | null) => value?.slice(0, 10) || '';

export const isRecurringDueOnDate = (loan: Loan, dateStr: string) => {
  const schedule = loan.recurringSchedule;
  if (!schedule?.enabled) return false;

  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  if (Number.isNaN(targetDate.getTime())) return false;

  if (schedule.type === 'everyday') return targetDate.getDay() !== 0;
  if (schedule.type === 'weekly') return !!schedule.weekDays?.includes(targetDate.getDay());
  return !!schedule.days?.includes(targetDate.getDate());
};

export const getScheduledRemarkForDate = (loan: Loan, dateStr: string): Remark | null => {
  const matches = (loan.remarks || []).filter(remark =>
    normalizeRemarkDate(remark.followUpDate) === dateStr ||
    normalizeRemarkDate(remark.ptpDate) === dateStr
  );

  return matches.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] || null;
};

const getRecurringScheduleRemark = (loan: Loan): Remark | null => {
  const schedule = loan.recurringSchedule;
  if (!schedule?.enabled) return null;

  if (schedule.note?.trim()) {
    return {
      id: `recurring-${loan.id}`,
      text: schedule.note.trim(),
      timestamp: schedule.startDate ? `${schedule.startDate}T00:00:00` : new Date(0).toISOString(),
      collector: loan.collector
    };
  }

  const scheduleStartDate = normalizeRemarkDate(schedule.startDate);
  const undatedRemarks = (loan.remarks || [])
    .filter(remark => !remark.ptpDate && !remark.followUpDate)
    .filter(remark => !scheduleStartDate || normalizeRemarkDate(remark.timestamp) <= scheduleStartDate)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return undatedRemarks[0] || null;
};

export const getActionRemarkForDate = (loan: Loan, dateStr: string): Remark | null => {
  const scheduledRemark = getScheduledRemarkForDate(loan, dateStr);
  if (scheduledRemark) return scheduledRemark;

  if (isRecurringDueOnDate(loan, dateStr)) {
    const recurringRemark = getRecurringScheduleRemark(loan);
    if (recurringRemark) return recurringRemark;
  }

  return loan.remarks?.[loan.remarks.length - 1] || null;
};

export const useClientUpdates = (selectedBranch: Branch) => {
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    // Initial fetch
    setLoans(store.getLoans(selectedBranch));
    
    // Subscribe to updates
    const unsubscribe = store.subscribe(() => {
      setLoans(store.getLoans(selectedBranch));
    });

    return () => unsubscribe();
  }, [selectedBranch]);

  const updateList = useMemo(() => {
    return loans
      .filter(l => hasActiveClientBalance(l) && l.remarks && l.remarks.length > 0)
      .map(l => {
        const latestRemark = [...l.remarks]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        return { ...l, latestRemark };
      })
      .sort((a, b) => new Date(b.latestRemark.timestamp).getTime() - new Date(a.latestRemark.timestamp).getTime());
  }, [loans]);

  const getLocalISODate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = useMemo(() => getLocalISODate(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalISODate(d);
  }, []);
  
  const checkIsPriority = (l: any) => {
    const hasGoodPaymentToday = (l.payments || []).some((p: any) => p.status === 'GOOD' && p.date.startsWith(todayStr));
    if (hasGoodPaymentToday) return false;

    const isTopAi = l.aiPriority === PriorityLevel.TOP;
    const isUnpaid = l.runningBalance > 0 && l.status !== 'Paid';
    const isDueToday = !!l.promiseToPayDate && l.promiseToPayDate === todayStr && isUnpaid;
    const isFollowUpToday = !!l.followUpDate && l.followUpDate === todayStr && isUnpaid;
    const scheduledRemarkToday = getScheduledRemarkForDate(l, todayStr);
    const remarkScheduledToday = !!scheduledRemarkToday && isUnpaid;

    // Recurring Schedule: Check if TODAY is a scheduled due day
    // This prevents loans from falling into Close Monitoring on their actual due day
    const isRecurringDueToday = isUnpaid && isRecurringDueOnDate(l, todayStr);

    return isTopAi || isDueToday || isFollowUpToday || remarkScheduledToday || isRecurringDueToday;
  };

  const topPriorityList = useMemo(() => {
    return updateList
      .filter(l => checkIsPriority(l))
      .map(l => ({
        ...l,
        latestRemark: getActionRemarkForDate(l, todayStr) || l.latestRemark
      }));
  }, [updateList, todayStr]);

  const reminderList = useMemo(() => {
    const reminders: ReminderItem[] = [];

    updateList.forEach(l => {
      if (l.status === 'Paid') return;
      if (checkIsPriority(l)) return;

      const scheduledRemark = getScheduledRemarkForDate(l, tomorrowStr);
      const isTomorrowPTP = (!!l.promiseToPayDate && l.promiseToPayDate === tomorrowStr) || normalizeRemarkDate(scheduledRemark?.ptpDate) === tomorrowStr;
      const isTomorrowFU = (!!l.followUpDate && l.followUpDate === tomorrowStr) || normalizeRemarkDate(scheduledRemark?.followUpDate) === tomorrowStr;

      if (isTomorrowPTP || isTomorrowFU) {
        const type = isTomorrowPTP ? 'Payment' : 'Follow-up';
        const dateStr = isTomorrowPTP ? l.promiseToPayDate : l.followUpDate;
        
        reminders.push({
          loan: l as unknown as Loan,
          date: new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' }),
          type: type as any,
          context: (scheduledRemark || getActionRemarkForDate(l, tomorrowStr) || l.latestRemark).text
        });
      }
    });

    return reminders;
  }, [updateList, todayStr, tomorrowStr]);

  const closeMonitoringList = useMemo(() => {
    return updateList.map(l => {
      if (l.status === 'Paid') return null;
      if (checkIsPriority(l)) return null;
      if (l.recurringSchedule?.enabled && l.recurringSchedule.type === 'everyday') return null;

      const hasPassedPTP = !!l.promiseToPayDate && l.promiseToPayDate < todayStr;
      const hasPassedFollowUp = !!l.followUpDate && l.followUpDate < todayStr;
      
      const hasActivePTP = !!l.promiseToPayDate && l.promiseToPayDate >= todayStr;
      const hasActiveFollowUp = !!l.followUpDate && l.followUpDate >= todayStr;
      if (hasActivePTP || hasActiveFollowUp) return null;

      if (!hasPassedPTP && !hasPassedFollowUp) return null;

      const passedDates = [];
      if (hasPassedPTP) passedDates.push(l.promiseToPayDate);
      if (hasPassedFollowUp) passedDates.push(l.followUpDate);
      passedDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const mostRecentPassedDate = passedDates[0];

      const hasSatisfyingPayment = (l.payments || []).some((p: any) => p.status === 'GOOD' && p.date >= mostRecentPassedDate);
      if (hasSatisfyingPayment) return null;

      const goodPayments = (l.payments || []).filter((p: any) => p.status === 'GOOD');
      let lastPaymentDateStr = null;
      let daysWithoutPayment = 'N/A';

      if (goodPayments.length > 0) {
        const sortedPayments = goodPayments.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        lastPaymentDateStr = sortedPayments[0].date;
        const diffMs = new Date().getTime() - new Date(lastPaymentDateStr).getTime();
        daysWithoutPayment = Math.max(0, Math.floor(diffMs / (1000 * 3600 * 24))).toString();
      }

      return {
        ...l,
        lastPaymentDateStr,
        daysWithoutPayment: daysWithoutPayment !== 'N/A' ? parseInt(daysWithoutPayment) : -1
      };
    }).filter(Boolean);
  }, [updateList, todayStr]);

  const filteredMainList = useMemo(() => {
    const reminderIds = new Set(reminderList.map(r => r.loan.id));
    const monitoringIds = new Set(closeMonitoringList.map((m: any) => m.id));

    return updateList.filter(u =>
      !checkIsPriority(u) &&
      !reminderIds.has(u.id) &&
      !monitoringIds.has(u.id)
    );
  }, [updateList, reminderList, closeMonitoringList, todayStr]);

  return {
    loans,
    updateList,
    topPriorityList,
    reminderList,
    closeMonitoringList,
    filteredMainList,
    checkIsPriority
  };
};

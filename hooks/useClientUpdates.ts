import { useState, useEffect, useMemo } from 'react';
import { store } from '../services/dataStore';
import { Branch, PriorityLevel, Loan } from '../types';
import { hasActiveClientBalance } from '../services/loanUtils';

export interface ReminderItem {
  loan: Loan;
  date: string; // ISO date or "Tomorrow"
  type: 'Payment' | 'Visit' | 'Callback' | 'Follow-up';
  context: string;
}

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
      .map(l => ({
        ...l,
        latestRemark: l.remarks[l.remarks.length - 1]
      }))
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
    const latestRemark = l.remarks?.length > 0 ? l.remarks[l.remarks.length - 1] : null;
    const remarkPtpToday = !!latestRemark?.ptpDate && latestRemark.ptpDate === todayStr && isUnpaid;
    const remarkFuToday = !!latestRemark?.followUpDate && latestRemark.followUpDate === todayStr && isUnpaid;

    // Recurring Schedule: Check if TODAY is a scheduled due day
    // This prevents loans from falling into Close Monitoring on their actual due day
    let isRecurringDueToday = false;
    if (l.recurringSchedule?.enabled && isUnpaid) {
      const today = new Date();
      if (l.recurringSchedule.type === 'everyday') {
        isRecurringDueToday = today.getDay() !== 0;
      } else if (l.recurringSchedule.type === 'weekly' && l.recurringSchedule.weekDays?.length > 0) {
        isRecurringDueToday = l.recurringSchedule.weekDays.includes(today.getDay());
      } else if (l.recurringSchedule.type === 'monthly' && l.recurringSchedule.days?.length > 0) {
        isRecurringDueToday = l.recurringSchedule.days.includes(today.getDate());
      }
    }

    return isTopAi || isDueToday || isFollowUpToday || remarkPtpToday || remarkFuToday || isRecurringDueToday;
  };

  const topPriorityList = useMemo(() => {
    return updateList.filter(l => checkIsPriority(l));
  }, [updateList, todayStr]);

  const reminderList = useMemo(() => {
    const reminders: ReminderItem[] = [];

    updateList.forEach(l => {
      if (l.status === 'Paid') return;
      if (checkIsPriority(l)) return;

      const isTomorrowPTP = !!l.promiseToPayDate && l.promiseToPayDate === tomorrowStr;
      const isTomorrowFU = !!l.followUpDate && l.followUpDate === tomorrowStr;

      if (isTomorrowPTP || isTomorrowFU) {
        const type = isTomorrowPTP ? 'Payment' : 'Follow-up';
        const dateStr = isTomorrowPTP ? l.promiseToPayDate : l.followUpDate;
        
        reminders.push({
          loan: l as unknown as Loan,
          date: new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' }),
          type: type as any,
          context: l.latestRemark.text
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

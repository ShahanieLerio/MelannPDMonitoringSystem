export interface PenaltyPeriodInput {
  label: string;
  paymentMade: number;
  numberOfMonths: number;
}

export interface PenaltyScheduleRow {
  period: string;
  beginningOverdueBalance: number;
  paymentsMade: number;
  balanceUsedForPenaltyBase: number;
  numberOfMonths: number;
  monthlyPenalty: number;
  penaltySubtotal: number;
}

export interface PenaltySchedule {
  rows: PenaltyScheduleRow[];
  totalPayments: number;
  remainingOverdueBalance: number;
  totalPenaltyAccumulated: number;
  correctUpdatedAmountDue: number;
}

export const PENALTY_RATE = 0.05;

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const computePenaltySchedule = (
  startingOverdueBalance: number,
  periods: PenaltyPeriodInput[],
  penaltyRate = PENALTY_RATE
): PenaltySchedule => {
  let beginningBalance = money(startingOverdueBalance);
  let totalPayments = 0;
  let totalPenalty = 0;
  const rows: PenaltyScheduleRow[] = [];

  for (const period of periods) {
    const payment = money(Math.max(0, period.paymentMade));
    const months = Math.max(0, period.numberOfMonths);
    const balanceUsedForPenaltyBase = money(Math.max(0, beginningBalance - payment));
    const monthlyPenalty = money(balanceUsedForPenaltyBase * penaltyRate);
    const penaltySubtotal = money(monthlyPenalty * months);

    totalPayments = money(totalPayments + payment);
    totalPenalty = money(totalPenalty + penaltySubtotal);

    rows.push({
      period: period.label,
      beginningOverdueBalance: beginningBalance,
      paymentsMade: payment,
      balanceUsedForPenaltyBase,
      numberOfMonths: months,
      monthlyPenalty,
      penaltySubtotal,
    });

    beginningBalance = balanceUsedForPenaltyBase;
  }

  const remainingOverdueBalance = money(beginningBalance);
  const totalPenaltyAccumulated = money(totalPenalty);

  return {
    rows,
    totalPayments,
    remainingOverdueBalance,
    totalPenaltyAccumulated,
    correctUpdatedAmountDue: money(remainingOverdueBalance + totalPenaltyAccumulated),
  };
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const monthKey = (date: Date) => date.getFullYear() * 12 + date.getMonth();

const monthStartFromKey = (key: number) => new Date(Math.floor(key / 12), key % 12, 1);

const formatPeriodLabel = (startKey: number, endKey: number) => {
  const start = monthStartFromKey(startKey);
  const end = monthStartFromKey(endKey);

  if (startKey === endKey) {
    return `${longMonthNames[start.getMonth()]} ${start.getFullYear()}`;
  }

  return `${monthNames[start.getMonth()]} ${start.getFullYear()} - ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
};

const monthAliases = new Map<string, number>([
  ['jan', 0], ['january', 0],
  ['feb', 1], ['february', 1],
  ['mar', 2], ['march', 2],
  ['apr', 3], ['april', 3],
  ['may', 4],
  ['jun', 5], ['june', 5],
  ['jul', 6], ['july', 6],
  ['aug', 7], ['august', 7],
  ['sep', 8], ['sept', 8], ['september', 8],
  ['oct', 9], ['october', 9],
  ['nov', 10], ['november', 10],
  ['dec', 11], ['december', 11],
]);

const parseMonthYear = (value: string) => {
  const match = value.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;

  const month = monthAliases.get(match[1].toLowerCase());
  const year = Number(match[2]);

  if (month === undefined || !Number.isInteger(year)) return null;
  return year * 12 + month;
};

export const countMonthsFromPeriodLabel = (label: string): number | null => {
  const normalized = label
    .replace(/[–—]/g, '-')
    .replace(/\s+to\s+/gi, ' - ')
    .trim();

  const parts = normalized.split(/\s*-\s*/).filter(Boolean);

  if (parts.length === 1) {
    return parseMonthYear(parts[0]) ? 1 : null;
  }

  if (parts.length !== 2) return null;

  const startKey = parseMonthYear(parts[0]);
  let endKey = parseMonthYear(parts[1]);

  if (startKey === null) return null;

  if (endKey === null) {
    const startYear = Math.floor(startKey / 12);
    endKey = parseMonthYear(`${parts[1]} ${startYear}`);
  }

  if (endKey === null || endKey < startKey) return null;
  return endKey - startKey + 1;
};

export interface PaymentLike {
  amount: number;
  date: string;
  status?: string;
}

export const buildPenaltyPeriodsFromPayments = (
  dueDateValue: string,
  datePreparedValue: string,
  payments: PaymentLike[]
): PenaltyPeriodInput[] => {
  const dueDate = new Date(dueDateValue);
  const datePrepared = new Date(`${datePreparedValue}T00:00:00`);

  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(datePrepared.getTime()) || datePrepared < dueDate) {
    return [];
  }

  const dueMonthKey = monthKey(dueDate);
  const preparedMonthKey = monthKey(datePrepared);
  const paymentsByMonth = new Map<number, number>();

  for (const payment of payments) {
    if (payment.status && payment.status !== 'GOOD') continue;

    const paymentDate = new Date(payment.date);
    if (Number.isNaN(paymentDate.getTime()) || paymentDate <= dueDate || paymentDate > datePrepared) continue;

    const key = monthKey(paymentDate);
    paymentsByMonth.set(key, money((paymentsByMonth.get(key) || 0) + payment.amount));
  }

  const paymentMonths = Array.from(paymentsByMonth.keys())
    .filter(key => key >= dueMonthKey && key <= preparedMonthKey)
    .sort((a, b) => a - b);

  const periods: PenaltyPeriodInput[] = [];

  if (paymentMonths[0] !== dueMonthKey) {
    const firstPeriodEnd = paymentMonths.length > 0 ? paymentMonths[0] - 1 : preparedMonthKey;
    periods.push({
      label: formatPeriodLabel(dueMonthKey, firstPeriodEnd),
      paymentMade: paymentsByMonth.get(dueMonthKey) || 0,
      numberOfMonths: firstPeriodEnd - dueMonthKey + 1,
    });
  }

  for (let i = 0; i < paymentMonths.length; i += 1) {
    const startKey = paymentMonths[i];
    const endKey = i + 1 < paymentMonths.length ? paymentMonths[i + 1] - 1 : preparedMonthKey;

    periods.push({
      label: formatPeriodLabel(startKey, endKey),
      paymentMade: paymentsByMonth.get(startKey) || 0,
      numberOfMonths: endKey - startKey + 1,
    });
  }

  return periods.filter(period => period.numberOfMonths > 0);
};

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import Reports from './Reports';
import { store } from '../services/dataStore';
import { Branch } from '../types';

vi.mock('../services/dataStore', () => ({
  store: {
    getCollectorPerformance: vi.fn(),
    getCollectorPerformanceDetails: vi.fn(),
    subscribe: vi.fn()
  }
}));

vi.mock('recharts', () => {
  const Shell = ({ children }: { children?: ReactNode }) => <div data-testid="chart">{children}</div>;
  const Part = () => null;
  return {
    ResponsiveContainer: Shell,
    BarChart: Shell,
    Bar: Shell,
    XAxis: Part,
    YAxis: Part,
    CartesianGrid: Part,
    Tooltip: Part,
    Cell: Part
  };
});

vi.mock('./MonthlyPerformance.tsx', () => ({ default: () => <div data-testid="monthly-performance">Monthly Performance</div> }));
vi.mock('./AgingReport.tsx', () => ({ default: () => <div data-testid="aging-report">Aging Report</div> }));
vi.mock('./DeadWriteOffReport.tsx', () => ({ default: () => <div data-testid="dead-write-off-report">Dead Write-Off Report</div> }));
vi.mock('./ReconstructedReport.tsx', () => ({ default: () => <div data-testid="reconstructed-report">Reconstructed Report</div> }));

describe('Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (store.subscribe as any).mockReturnValue(() => {});
    (store.getCollectorPerformanceDetails as any).mockReturnValue([]);
  });

  it('sorts collector performance by efficiency, collected amount, then name', () => {
    (store.getCollectorPerformance as any).mockReturnValue([
      { collector: 'ZARA', totalAccounts: 3, reportedAmount: 10000, collectedAmount: 5000, runningBalance: 5000, collectionRate: 50, paidCount: 1 },
      { collector: 'ALDIE', totalAccounts: 4, reportedAmount: 20000, collectedAmount: 15000, runningBalance: 5000, collectionRate: 75, paidCount: 2 },
      { collector: 'BETA', totalAccounts: 4, reportedAmount: 20000, collectedAmount: 12000, runningBalance: 8000, collectionRate: 75, paidCount: 2 }
    ]);

    render(<Reports selectedBranch={Branch.NAVAL} />);

    const names = screen.getAllByText(/ALDIE|BETA|ZARA/).map(node => node.textContent);
    expect(names.slice(0, 3)).toEqual(['ALDIE', 'BETA', 'ZARA']);
    expect(screen.getAllByText('75.0%')).toHaveLength(2);
    expect(screen.getByText(/Naval Branch/i)).toBeInTheDocument();
  });

  it('shows the empty performance state when no collector data exists', () => {
    (store.getCollectorPerformance as any).mockReturnValue([]);

    render(<Reports selectedBranch={Branch.ORMOC} />);

    expect(screen.getByText(/no collection data available/i)).toBeInTheDocument();
    expect(screen.getByText(/no field data available/i)).toBeInTheDocument();
  });

  it('uses explicit active account counts in the collector matrix', () => {
    (store.getCollectorPerformance as any).mockReturnValue([
      { collector: 'OFFICE', totalAccounts: 5, activeAccountCount: 1, reportedAmount: 10000, collectedAmount: 6000, runningBalance: 4000, collectionRate: 60, paidCount: 2 }
    ]);

    render(<Reports selectedBranch={Branch.ORMOC} />);

    const officeRow = screen.getByText('OFFICE').closest('tr');
    expect(officeRow).not.toBeNull();
    expect(within(officeRow as HTMLTableRowElement).getByText('5')).toBeInTheDocument();
    expect(within(officeRow as HTMLTableRowElement).getByText('1')).toBeInTheDocument();
    expect(within(officeRow as HTMLTableRowElement).getByText('Active')).toBeInTheDocument();
  });

  it('shows yearly collector efficiency periods using reported-year ranges', () => {
    (store.getCollectorPerformance as any).mockImplementation((_branch: Branch, range?: { from: number; to: number }) => {
      if (!range) return [];
      if (range.from === 2016 && range.to === 2024) {
        return [{ collector: 'HISTORICAL', totalAccounts: 2, activeAccountCount: 2, reportedAmount: 1000, collectedAmount: 500, runningBalance: 500, collectionRate: 50, paidCount: 0 }];
      }
      if (range.from === 2025 && range.to === 2025) {
        return [{ collector: 'YEAR2025', totalAccounts: 1, activeAccountCount: 1, reportedAmount: 2000, collectedAmount: 1500, runningBalance: 500, collectionRate: 75, paidCount: 0 }];
      }
      return [{ collector: 'YEAR2026', totalAccounts: 1, activeAccountCount: 1, reportedAmount: 3000, collectedAmount: 900, runningBalance: 2100, collectionRate: 30, paidCount: 0 }];
    });
    (store.getCollectorPerformanceDetails as any).mockReturnValue([
      { loanId: 'loan-1', code: 'C-001', borrowerName: 'CLIENT, ONE', monthReported: '2024-01', status: 'Moving', reportedAmount: 1000, collectedAmount: 500, runningBalance: 500 }
    ]);

    render(<Reports selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getByRole('button', { name: /yearly report/i }));
    expect(screen.getByText('Yearly Collector Efficiency Matrix')).toBeInTheDocument();
    expect(screen.getByText('HISTORICAL')).toBeInTheDocument();
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.NAVAL, { from: 2016, to: 2024 });

    fireEvent.click(screen.getByText('HISTORICAL'));
    expect(screen.getByText('CLIENT, ONE')).toBeInTheDocument();
    expect(screen.getByText('Code: C-001')).toBeInTheDocument();
    expect(store.getCollectorPerformanceDetails).toHaveBeenCalledWith(Branch.NAVAL, 'HISTORICAL', { from: 2016, to: 2024 });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    fireEvent.click(screen.getByRole('button', { name: '2025' }));
    expect(screen.getByText('YEAR2025')).toBeInTheDocument();
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.NAVAL, { from: 2025, to: 2025 });

    fireEvent.click(screen.getByRole('button', { name: '2026' }));
    expect(screen.getByText('YEAR2026')).toBeInTheDocument();
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.NAVAL, { from: 2026, to: 2026 });
  });

  it('routes report subviews to the correct report modules', () => {
    (store.getCollectorPerformance as any).mockReturnValue([]);

    const { rerender } = render(<Reports selectedBranch={Branch.NAVAL} activeView="monthly-performance" />);
    expect(screen.getByTestId('monthly-performance')).toBeInTheDocument();

    rerender(<Reports selectedBranch={Branch.NAVAL} activeView="aging" />);
    expect(screen.getByTestId('aging-report')).toBeInTheDocument();

    rerender(<Reports selectedBranch={Branch.NAVAL} activeView="dead-write-off" />);
    expect(screen.getByTestId('dead-write-off-report')).toBeInTheDocument();

    rerender(<Reports selectedBranch={Branch.NAVAL} activeView="reconstructed" />);
    expect(screen.getByTestId('reconstructed-report')).toBeInTheDocument();
  });
});

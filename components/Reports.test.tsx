import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import Reports from './Reports';
import { store } from '../services/dataStore';
import { Branch } from '../types';

vi.mock('../services/dataStore', () => ({
  store: {
    getCollectorPerformance: vi.fn(),
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

describe('Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (store.subscribe as any).mockReturnValue(() => {});
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

  it('routes report subviews to the correct report modules', () => {
    (store.getCollectorPerformance as any).mockReturnValue([]);

    const { rerender } = render(<Reports selectedBranch={Branch.NAVAL} activeView="monthly-performance" />);
    expect(screen.getByTestId('monthly-performance')).toBeInTheDocument();

    rerender(<Reports selectedBranch={Branch.NAVAL} activeView="aging" />);
    expect(screen.getByTestId('aging-report')).toBeInTheDocument();

    rerender(<Reports selectedBranch={Branch.NAVAL} activeView="dead-write-off" />);
    expect(screen.getByTestId('dead-write-off-report')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import Reports from './Reports';
import { store } from '../services/dataStore';
import { Branch, DispositionStatus, DispositionType } from '../types';

vi.mock('../services/dataStore', () => ({
  store: {
    getCollectorPerformance: vi.fn(),
    getCollectorPerformanceDetails: vi.fn(),
    getLoans: vi.fn(() => []),
    getAllDispositions: vi.fn(() => []),
    getDeadWriteOffs: vi.fn(() => []),
    isDeadWriteOff: vi.fn(() => false),
    getCollectorDisplayName: vi.fn((c: string) => c),
    subscribe: vi.fn()
  }
}));

vi.mock('./MonthlyPerformance.tsx', () => ({ default: () => <div data-testid="monthly-performance">Monthly Performance</div> }));
vi.mock('./AgingReport.tsx', () => ({ default: () => <div data-testid="aging-report">Aging Report</div> }));
vi.mock('./DeadWriteOffReport.tsx', () => ({ default: () => <div data-testid="dead-write-off-report">Dead Write-Off Report</div> }));
vi.mock('./ReconstructedReport.tsx', () => ({ default: () => <div data-testid="reconstructed-report">Reconstructed Report</div> }));

describe('Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (store.subscribe as any).mockReturnValue(() => {});
    (store.getCollectorPerformanceDetails as any).mockReturnValue([]);
    (store.getLoans as any).mockReturnValue([]);
    (store.getAllDispositions as any).mockReturnValue([]);
    (store.getDeadWriteOffs as any).mockReturnValue([]);
    (store.isDeadWriteOff as any).mockReturnValue(false);
    (store.getCollectorDisplayName as any).mockImplementation((c: string) => c);
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
    // Headers for collection & write-off modules
    expect(screen.getByText('📈 Collection Performance')).toBeInTheDocument();
    expect(screen.getByText('📋 Write-Off Module Reports')).toBeInTheDocument();
  });

  it('shows the empty performance state when no collector data exists', () => {
    (store.getCollectorPerformance as any).mockReturnValue([]);

    render(<Reports selectedBranch={Branch.ORMOC} />);

    expect(screen.getByText(/no field data available/i)).toBeInTheDocument();
  });

  it('shows actual, excess, write-off, balance, and total collections in order', () => {
    (store.getCollectorPerformance as any).mockReturnValue([
      { collector: 'OFFICE', totalAccounts: 2, activeAccountCount: 1,
        reportedAmount: 2000, collectedAmount: 1800, actualCollectedAmount: 1300,
        runningBalance: 700, excessCollection: 200, writeOffValidCollections: 300,
        collectionRate: 65, paidCount: 1 }
    ]);

    render(<Reports selectedBranch={Branch.ORMOC} />);

    const headers = screen.getAllByRole('columnheader').map(header => header.textContent?.trim());
    expect(headers.slice(headers.indexOf('Accounts'), headers.indexOf('Efficiency Rate') + 1))
      .toEqual(['Accounts', 'Target', 'Actual Collection', 'Excess Collection',
        'Write-off Valid Collections', 'Balance', 'Total Collected', 'Efficiency Rate']);
    const officeRow = screen.getByText('OFFICE').closest('tr') as HTMLTableRowElement;
    expect(within(officeRow).getByText('₱1,300')).toBeInTheDocument();
    expect(within(officeRow).getByText('₱200')).toBeInTheDocument();
    expect(within(officeRow).getByText('₱300')).toBeInTheDocument();
    expect(within(officeRow).getByText('₱700')).toBeInTheDocument();
    expect(within(officeRow).getByText('₱1,800')).toBeInTheDocument();
    expect(within(officeRow).getByText('65.0%')).toBeInTheDocument();
    const totalRow = screen.getByText('Grand Total').closest('tr') as HTMLTableRowElement;
    expect(within(totalRow).getByText('₱1,300')).toBeInTheDocument();
    expect(within(totalRow).getByText('₱200')).toBeInTheDocument();
    expect(within(totalRow).getByText('₱300')).toBeInTheDocument();
    expect(within(totalRow).getByText('₱1,800')).toBeInTheDocument();
    expect(within(totalRow).getByText('65.0%')).toBeInTheDocument();
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

  it('applies an as-of date to overall and yearly collection views and can return to live data', () => {
    (store.getCollectorPerformance as any).mockImplementation((_branch: Branch, _range?: { from: number; to: number }, asOf?: string) => [
      { collector: 'OFFICE', totalAccounts: 1, activeAccountCount: 1, reportedAmount: 1000,
        collectedAmount: asOf ? 300 : 700, runningBalance: asOf ? 700 : 300,
        collectionRate: asOf ? 30 : 70, paidCount: 0 }
    ]);
    render(<Reports selectedBranch={Branch.ORMOC} />);

    fireEvent.change(screen.getByLabelText('Collection performance as of date'), { target: { value: '2026-09-30' } });
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.ORMOC, undefined, '2026-09-30');
    expect(screen.getAllByText('₱300').length).toBeGreaterThan(0);
    expect(screen.getByText(/Collection columns include reported accounts and payments through 2026-09-30/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '2016-2024' }));
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.ORMOC, { from: 2016, to: 2024 }, '2026-09-30');
    fireEvent.click(screen.getByRole('button', { name: /live view/i }));
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.ORMOC);
    expect(screen.getAllByText('₱700').length).toBeGreaterThan(0);
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

    fireEvent.click(screen.getByRole('tab', { name: '2016-2024' }));
    expect(screen.getByText('Monthly Reported Collector Efficiency Matrix')).toBeInTheDocument();
    expect(screen.getByText(/Date basis: Monthly Reported. Includes accounts reported in 2016-2024/)).toBeInTheDocument();
    expect(screen.getByText('HISTORICAL')).toBeInTheDocument();
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.NAVAL, { from: 2016, to: 2024 });

    fireEvent.click(screen.getByText('HISTORICAL'));
    expect(screen.getByText('CLIENT, ONE')).toBeInTheDocument();
    expect(screen.getByText('Code: C-001')).toBeInTheDocument();
    expect(store.getCollectorPerformanceDetails).toHaveBeenCalledWith(Branch.NAVAL, 'HISTORICAL', { from: 2016, to: 2024 });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    fireEvent.click(screen.getByRole('tab', { name: '2025' }));
    expect(screen.getByText('YEAR2025')).toBeInTheDocument();
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.NAVAL, { from: 2025, to: 2025 });

    fireEvent.click(screen.getByRole('tab', { name: '2026' }));
    expect(screen.getByText('YEAR2026')).toBeInTheDocument();
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.NAVAL, { from: 2026, to: 2026 });
    fireEvent.click(screen.getByRole('tab', { name: 'Maturity Date' }));
    expect(screen.getByRole('tab', { name: 'Overall Report' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Monthly Reported' }));
    expect(screen.getByRole('tab', { name: '2026' })).toHaveAttribute('aria-selected', 'true');
  });

  it('filters the efficiency matrix and collector details by maturity date', () => {
    (store.getLoans as any).mockReturnValue([
      { id: 'recon-in-range', collector: 'OFFICE', dueDate: '2024-12-15', monthReported: '2025-02',
        payments: [{ amount: 100, remarks: 'Reconstructed payment', status: 'GOOD' }], remarks: [] },
      { id: 'recon-out-of-range', collector: 'OFFICE', dueDate: '2025-01-15', monthReported: '2025-02',
        payments: [{ amount: 300, remarks: 'Reconstructed payment', status: 'GOOD' }], remarks: [] }
    ]);
    (store.getCollectorPerformance as any).mockImplementation((_branch: Branch, _yearRange?: unknown, _asOf?: string, maturityRange?: { from?: string; to?: string }) =>
      maturityRange?.from === '2016-01-01' && maturityRange?.to === '2024-12-31'
        ? [{ collector: 'OFFICE', totalAccounts: 1, activeAccountCount: 1, reportedAmount: 2000,
          actualCollectedAmount: 500, collectedAmount: 500, excessCollection: 0,
          writeOffValidCollections: 0, runningBalance: 1500, collectionRate: 25, paidCount: 0 }]
        : []
    );
    (store.getCollectorPerformanceDetails as any).mockReturnValue([
      { loanId: 'loan-2025-report', code: 'C-2024', borrowerName: 'MATURITY, CLIENT',
        monthReported: '2025-02', dueDate: '2024-12-15', status: 'M',
        reportedAmount: 2000, collectedAmount: 500, runningBalance: 1500 }
    ]);

    render(<Reports selectedBranch={Branch.ORMOC} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Maturity Date' }));
    expect(screen.getByText(/Date basis: Maturity Date. Includes all maturity dates/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '2016-2024' }));
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.ORMOC, undefined, undefined,
      { from: '2016-01-01', to: '2024-12-31' });
    expect(screen.getByText(/Includes loans maturing in 2016-2024, regardless of month reported/)).toBeInTheDocument();
    expect(screen.getByText('Maturity Date Collector Efficiency Matrix')).toBeInTheDocument();
    const officeRow = screen.getByText('OFFICE').closest('tr') as HTMLTableRowElement;
    expect(within(officeRow).getByText('₱1,500')).toBeInTheDocument();
    expect(within(officeRow).getByText('₱100')).toBeInTheDocument();
    expect(within(officeRow).queryByText('₱300')).not.toBeInTheDocument();
    fireEvent.click(officeRow);
    expect(screen.getByText('MATURITY, CLIENT')).toBeInTheDocument();
    expect(screen.getByText('2024-12-15')).toBeInTheDocument();
    expect(store.getCollectorPerformanceDetails).toHaveBeenCalledWith(Branch.ORMOC, 'OFFICE', undefined, undefined,
      { from: '2016-01-01', to: '2024-12-31' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('tab', { name: '2025' }));
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.ORMOC, undefined, undefined,
      { from: '2025-01-01', to: '2025-12-31' });
    fireEvent.click(screen.getByRole('tab', { name: '2026' }));
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.ORMOC, undefined, undefined,
      { from: '2026-01-01', to: '2026-12-31' });
    fireEvent.click(screen.getByRole('tab', { name: 'Overall Report' }));
    expect(store.getCollectorPerformance).toHaveBeenCalledWith(Branch.ORMOC, undefined, undefined, undefined);
    fireEvent.click(screen.getByRole('tab', { name: 'Monthly Reported' }));
    expect(screen.getByRole('tab', { name: 'Overall Report' })).toHaveAttribute('aria-selected', 'true');
  });

  it('integrates Write-Off module reports into the Collector Efficiency Matrix table', () => {
    (store.getCollectorPerformance as any).mockReturnValue([
      { collector: 'OFFICE', totalAccounts: 10, activeAccountCount: 8, reportedAmount: 50000, collectedAmount: 20000, runningBalance: 30000, collectionRate: 40, paidCount: 2 }
    ]);
    (store.getLoans as any).mockReturnValue([
      {
        id: 'wo-loan-1',
        collector: 'OFFICE',
        borrowerName: 'Juan Dela Cruz',
        principal: 10000,
        totalLoan: 12000,
        amountCollected: 2000,
        runningBalance: 10000,
        monthReported: '2026-01',
        payments: [
          { id: 'p-rec-1', amount: 3500, remarks: 'Reconstructed term agreement', date: '2026-01-15' }
        ]
      }
    ]);
    (store.getAllDispositions as any).mockReturnValue([
      {
        id: 'disp-wo-1',
        loanId: 'wo-loan-1',
        type: DispositionType.PROSPECT_WRITE_OFF,
        writeOffClassification: 'Located',
        reason: 'Relocated within area'
      }
    ]);

    render(<Reports selectedBranch={Branch.ORMOC} />);

    expect(screen.getByText('OFFICE')).toBeInTheDocument();
    expect(screen.getByText('🔄 Reconstructed')).toBeInTheDocument();
    expect(screen.getByText('📍 Located')).toBeInTheDocument();
    expect(screen.getByText('🔍 Unlocated')).toBeInTheDocument();
    expect(screen.getByText('🕊️ Deceased')).toBeInTheDocument();
    expect(screen.getByText('📊 Total Write-Off')).toBeInTheDocument();
    expect(screen.getAllByText('₱12,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('₱3,500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/1p \(₱12,000\)/i).length).toBeGreaterThanOrEqual(1);
  });

  it('returns a restored client to collection totals without counting its rejected write-off', () => {
    (store.getCollectorPerformance as any).mockReturnValue([
      { collector: 'PD BAYBAY', totalAccounts: 1, activeAccountCount: 1, reportedAmount: 1755, collectedAmount: 0, runningBalance: 1755, collectionRate: 0, paidCount: 0 }
    ]);
    (store.getLoans as any).mockReturnValue([{
      id: '41062', collector: 'PD BAYBAY', borrowerName: 'ADARO, SHIELA',
      totalLoan: 1955, outstandingBalance: 1755, amountCollected: 200,
      runningBalance: 1755, monthReported: '2025-05', payments: [], remarks: [],
      actionStage: 'Active / Cooperative', actionNote: 'Restored to Collection: Client Reachable'
    }]);
    (store.getAllDispositions as any).mockReturnValue([{
      id: 'adaro-writeoff', loanId: '41062', type: DispositionType.PROSPECT_WRITE_OFF,
      status: DispositionStatus.REJECTED, writeOffClassification: 'Located'
    }]);

    render(<Reports selectedBranch={Branch.ORMOC} />);

    const collectorRow = screen.getByText('PD BAYBAY').closest('tr') as HTMLTableRowElement;
    expect(within(collectorRow).getAllByText('₱1,755')).toHaveLength(2);
    expect(within(collectorRow).queryByText(/1 total/i)).not.toBeInTheDocument();
    expect(screen.getByText('Grand Total').closest('tr')).toHaveTextContent('0 total');
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

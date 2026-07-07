import React, { useMemo, useState } from 'react';
import { Branch, UserRole, getUserRoleLabel } from '../types.ts';

interface DocumentationProps {
  selectedBranch: Branch;
  role: UserRole;
}

type DocSection = {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  items: string[];
};

const docSections: DocSection[] = [
  {
    id: 'overview',
    title: 'System Overview',
    eyebrow: 'Purpose',
    summary: 'Melann Lending Past Due and Report Monitoring is the operating workspace for branch collection teams, managers, and administrators.',
    items: [
      'Tracks past-due client accounts, balances, collectors, payment activity, demand letters, and follow-up work.',
      'Supports branch-scoped work for Naval Branch and Ormoc Branch, with an all-branch view for super administrators.',
      'Keeps loan updates, payment records, visit logs, and demand-letter changes visible through account history.',
      'Combines local browser state with the PostgreSQL-backed bridge API so users can continue seeing cached data when sync is interrupted.'
    ]
  },
  {
    id: 'roles',
    title: 'Roles and Access',
    eyebrow: 'Security',
    summary: 'Access is controlled by user role, account status, and assigned branch.',
    items: [
      'Account registration includes Collector, Cashier, Supervisor, IT/Accounting Clerk, Branch Manager, Operations Manager, Executive Vice President, President, and Super Admin roles.',
      'Collector and Supervisor accounts are intended for assigned collector/client scopes; Cashier can view all data with selected edit access.',
      'IT/Accounting Clerk, Operations Manager, Executive Vice President, President, and Super Admin can work across all branches; only Super Admin manages user registrations.',
      'PENDING and DEACTIVATED users cannot log in; ACTIVE users can access the app.',
      'User records are permanent. Administrators change status instead of deleting accounts.'
    ]
  },
  {
    id: 'loans',
    title: 'Loan Grid and Client Records',
    eyebrow: 'Client Management',
    summary: 'Loan Grid is the main workspace for account enrollment, client lookup, imports, and account maintenance.',
    items: [
      'Use Add Client for manual encoding of borrower, loan, collector, branch, address, and status information.',
      'Use Import Client for spreadsheet-based loading of accounts or address updates.',
      'Replace imports update matching client codes while preserving payments, remarks, history, and existing priority data.',
      'New-only imports skip records with existing client codes.',
      'Wipe imports remove records from the selected branch before inserting the incoming file and should be used only after confirming the source file.'
    ]
  },
  {
    id: 'client-update',
    title: 'Client Update Queues',
    eyebrow: 'Follow-Up',
    summary: 'Client Update organizes accounts into queues based on remarks, commitments, priorities, and missed follow-up dates.',
    items: [
      'Updates Log shows accounts with remarks, ordered by newest update.',
      'Advance Reminders shows promise-to-pay or follow-up work due tomorrow.',
      'Critical Action shows top-priority accounts, accounts due today, and recurring schedules due today.',
      'Close Monitoring shows missed commitments with no satisfying payment after the missed date.',
      'No Activity shows accounts that have not received any remarks.',
      'Recording a good payment today removes an account from critical action for that day.'
    ]
  },
  {
    id: 'payments',
    title: 'Payments and Reversals',
    eyebrow: 'Collections',
    summary: 'Payment posting updates the payment stream, recalculates balances, and writes an activity log.',
    items: [
      'Search the account by client code before posting a payment.',
      'Good payments reduce running balance and increase amount collected.',
      'A same-loan same-date payment replaces the existing payment row for that date.',
      'Reverse Payment searches by OR number, marks the payment as REVERSED, appends the reason, and recalculates the loan.',
      'Reversed payments remain visible for audit but are excluded from financial totals.'
    ]
  },
  {
    id: 'reports',
    title: 'Reports',
    eyebrow: 'Management',
    summary: 'Reports convert branch loan and payment data into operational summaries for managers and collectors.',
    items: [
      'Dashboard shows totals, balances, status distribution, collector distribution, recent payments, and optional AI insights.',
      'Daily Collection Report summarizes good payments by date range and collector.',
      'Collection Sheet provides field collection lists for collectors.',
      'Collector Performance ranks collectors by accounts, reported amount, collected amount, running balance, and efficiency.',
      'Monthly Performance and Aging of Receivables support period review and receivables aging.'
    ]
  },
  {
    id: 'demand-letters',
    title: 'Demand Letters and Visits',
    eyebrow: 'Legal Follow-Up',
    summary: 'Demand Letters tracks preparation, receipt, follow-up, field visits, and settlement status.',
    items: [
      'Supported stages are 1st Demand Letter, 2nd Demand Letter, and 3rd Demand Letter.',
      '1st and 2nd demand letters compute follow-up 10 days after date received.',
      '3rd demand letters compute follow-up 5 days after date received.',
      'Demand-letter remarks are mirrored into client remarks with a demand-letter marker.',
      'Visit logs can return an account to Client Update or mark an account as settled.'
    ]
  },
  {
    id: 'collectors',
    title: 'Collectors',
    eyebrow: 'Directory',
    summary: 'The collector directory normalizes collector identity and keeps assignment data consistent across branches.',
    items: [
      'Collector records include name, nickname, address, branch, and optional photo.',
      'Name and nickname are normalized before duplicate checks.',
      'Photos are stored under public uploads by the backend when submitted as image data.',
      'When a collector name or nickname changes, related loan display names are updated locally.'
    ]
  },
  {
    id: 'backup',
    title: 'Backup, Restore, and Operations',
    eyebrow: 'Maintenance',
    summary: 'The database module exports and imports JSON backups, while local setup uses a Vite frontend and Express API bridge.',
    items: [
      'Backup exports loans, users, collectors, demand letters, metadata, and timestamp.',
      'Branch users can only restore backups for their assigned branch.',
      'Super administrators can export and restore all-branch data.',
      'Run the backend with npm.cmd run server and the frontend with npm.cmd run dev.',
      'Run npm.cmd run build before release; use npm.cmd on Windows to avoid PowerShell script-policy issues.'
    ]
  }
];

const quickFacts = [
  { label: 'Frontend', value: 'React 19 + Vite' },
  { label: 'Backend', value: 'Express bridge API' },
  { label: 'Database', value: 'PostgreSQL' },
  { label: 'API Base', value: 'http://<your-ip>:5000/api (dynamic)' },
  { label: 'App Port', value: 'http://localhost:3000' },
  { label: 'Default User', value: 'admin' }
];

const workflowCards = [
  {
    title: 'Daily Collection Flow',
    steps: ['Open Dashboard', 'Review critical alerts', 'Work Client Update queues', 'Post payments', 'Check DCR totals']
  },
  {
    title: 'New Client Flow',
    steps: ['Open Loan Grid', 'Add or import client', 'Assign collector and branch', 'Review account profile', 'Track remarks']
  },
  {
    title: 'Missed Commitment Flow',
    steps: ['Open Close Monitoring', 'Review last commitment', 'Log visit or outcome', 'Return to update queue or settle', 'Record history']
  },
  {
    title: 'Legal Follow-Up Flow',
    steps: ['Create demand letter', 'Record received date', 'Track follow-up date', 'Log field visit', 'Update legal status']
  }
];

const Documentation: React.FC<DocumentationProps> = ({ selectedBranch, role }) => {
  const [activeSection, setActiveSection] = useState(docSections[0].id);
  const activeDoc = useMemo(
    () => docSections.find(section => section.id === activeSection) || docSections[0],
    [activeSection]
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm overflow-hidden transition-colors duration-300">
        <div className="p-8 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-400 mb-3">
                App Documentation
              </p>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Melann Lending Operating Manual
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 font-medium">
                A built-in reference for daily users, branch managers, and administrators. Current context: {selectedBranch} / {getUserRoleLabel(role)}.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:w-[480px]">
              {quickFacts.map(fact => (
                <div key={fact.label} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{fact.label}</p>
                  <p className="mt-1 text-xs font-black text-slate-800 dark:text-slate-100 truncate">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr]">
          <aside className="border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-colors duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
              {docSections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`text-left rounded-2xl px-4 py-3 transition-all duration-200 border ${
                    activeSection === section.id
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 shadow-sm'
                      : 'bg-slate-50/60 dark:bg-slate-900/30 border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-70">{section.eyebrow}</p>
                  <p className="mt-1 text-sm font-black">{section.title}</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="p-6 lg:p-8">
            <div className="max-w-5xl">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-400">
                {activeDoc.eyebrow}
              </p>
              <h3 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {activeDoc.title}
              </h3>
              <p className="mt-3 text-sm leading-7 font-medium text-slate-600 dark:text-slate-300">
                {activeDoc.summary}
              </p>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {activeDoc.items.map((item, index) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-4">
                    <div className="h-7 w-7 shrink-0 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 font-semibold text-slate-700 dark:text-slate-200">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm p-6 transition-colors duration-300">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Workflow Reference</p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Common Operating Paths</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflowCards.map(card => (
              <div key={card.title} className="rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 p-5">
                <h4 className="font-black text-slate-800 dark:text-white">{card.title}</h4>
                <ol className="mt-4 space-y-2">
                  {card.steps.map((step, index) => (
                    <li key={step} className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      <span className="h-6 w-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm p-6 transition-colors duration-300">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Developer and Support Notes</p>
          <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">Technical Reference</h3>
          <div className="mt-5 space-y-3">
            {[
              ['Start backend', 'npm.cmd run server'],
              ['Start frontend', 'npm.cmd run dev'],
              ['Build check', 'npm.cmd run build'],
              ['Run tests', 'npm.cmd test'],
              ['Schema file', 'schema.sql'],
              ['Data store', 'services/dataStore.ts'],
              ['API server', 'server.cjs'],
              ['Static docs', 'README.md and docs/']
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 px-4 py-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
                <code className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                  {value}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;

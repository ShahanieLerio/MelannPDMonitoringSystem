# Developer Guide

## Tech Stack

- React 19
- TypeScript
- Vite 6
- Tailwind CSS via CDN in `index.html`
- Express 5
- PostgreSQL through `pg`
- Optional Neon setup helper through `@neondatabase/serverless`
- Vitest, Testing Library, jsdom, and V8 coverage
- Recharts for charts
- xlsx for spreadsheet import/export workflows
- Google Generative AI SDK for optional dashboard and priority insights

## Project Layout

```text
.
|-- App.tsx
|-- index.tsx
|-- index.html
|-- types.ts
|-- constants.tsx
|-- server.cjs
|-- schema.sql
|-- components/
|-- hooks/
|-- services/
|-- scripts/
|-- assets/
|-- public/
|-- docs/
|-- *.test.ts / *.test.tsx
```

Important directories:

- `components/`: UI screens, modals, reports, and controls.
- `hooks/`: shared React hooks such as `useClientUpdates`.
- `services/`: singleton store, collector utilities, and Gemini integration.
- `scripts/`: database setup and maintenance scripts.
- `public/uploads/collectors`: persisted collector photo uploads.
- `assets/`: app logos and desktop icon assets.

## Local Setup

Install dependencies:

```powershell
npm install
```

Create `.env.local`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
VITE_GEMINI_API_KEY=optional_gemini_key
PORT=5000
```

Initialize database schema:

```powershell
node scripts/setup_db.js
```

Start backend:

```powershell
npm.cmd run server
```

Start frontend:

```powershell
npm.cmd run dev
```

Build frontend:

```powershell
npm.cmd run build
```

Run tests:

```powershell
npm.cmd test
```

PowerShell may block `npm run ...` because of script policy. Use `npm.cmd` on Windows.

## NPM Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `vite` | Start frontend dev server on port 3000. |
| `server` | `node server.cjs` | Start Express API bridge on port 5000 by default. |
| `build` | `vite build` | Production frontend build into `dist/`. |
| `preview` | `vite preview` | Serve built frontend locally. |
| `test` | `vitest` | Run unit/component tests. |

## Coding Patterns

### Store Subscription

Components read initial data from `store`, then subscribe for updates:

```tsx
const [loans, setLoans] = useState(store.getLoans(selectedBranch));

useEffect(() => {
  const unsubscribe = store.subscribe(() => {
    setLoans(store.getLoans(selectedBranch));
  });

  return () => unsubscribe();
}, [selectedBranch]);
```

Use this pattern for UI that should reflect backend refreshes or local mutations.

### Branch Filtering

Most data access should pass `selectedBranch`:

```ts
store.getLoans(selectedBranch)
store.getCollectors(selectedBranch)
store.getDemandLetters(selectedBranch)
store.getCollectorPerformance(selectedBranch)
```

Use `Branch.ALL` for super-admin global views or when duplicate checks need all records.

### Backend Writes

The store generally waits for backend writes before mutating local memory. Keep this pattern for new critical writes:

1. Validate input in the component or store.
2. Call `this.api(...)`.
3. Update in-memory arrays.
4. Call `this.save()` to localStorage and notify subscribers.

### History Logging

Use `recordHistory` inside the store for loan-affecting operations. History entries should include:

- Loan ID.
- Event type.
- Human-readable description.
- Username.
- Role.
- Module name.

### Collector Identity

Use helpers from `services/collectorUtils.ts` for collector name handling:

- `normalizeCollectorKey`
- `getCollectorIdentity`
- `getCollectorIdentityCandidates`
- `getCollectorDisplayName`
- `dedupeCollectors`
- `hasDuplicateCollectorIdentity`

Do not compare raw collector names when identity consistency matters.

### Client Update Queues

Use `useClientUpdates(selectedBranch)` when a component needs the same queue definitions as Client Update or Sidebar badges.

Returned values:

- `loans`
- `updateList`
- `topPriorityList`
- `reminderList`
- `closeMonitoringList`
- `filteredMainList`
- `checkIsPriority`

## Component Map

| File | Responsibility |
| --- | --- |
| `App.tsx` | App shell, login state, branch selection, tab routing, notifications. |
| `components/Sidebar.tsx` | Navigation, role filtering, Client Update badge counts. |
| `components/LoginPage.tsx` | Login and self-registration. |
| `components/Dashboard.tsx` | KPI dashboard, charts, recent payments, AI insights. |
| `components/LoanGrid.tsx` | Loan table, filters, client add/import entry points. |
| `components/BulkImportModal.tsx` | Spreadsheet import and address import workflows. |
| `components/ClientFormModal.tsx` | Add/edit client form. |
| `components/ClientModal.tsx` | Client profile/details. |
| `components/ClientUpdate.tsx` | Update log, priority queues, commitment outcomes. |
| `components/VisitLogModal.tsx` | Close-monitoring visit logs. |
| `components/PaymentForm.tsx` | Payment posting and reversal. |
| `components/CollectionSheet.tsx` | Collector collection worksheet. |
| `components/DailyCollectionReport.tsx` | Date-range collection report. |
| `components/Reports.tsx` | Report container for performance/monthly/aging views. |
| `components/MonthlyPerformance.tsx` | Monthly performance report. |
| `components/AgingReport.tsx` | Aging report. |
| `components/DemandLetter.tsx` | Demand letter workflow and related modals. |
| `components/ClientActionTracker.tsx` | Lifecycle/action tracking. |
| `components/Collectors.tsx` | Collector directory management. |
| `components/UserManagement.tsx` | User account status management. |
| `components/BackupRestore.tsx` | JSON backup and restore. |
| `components/ErrorBoundary.tsx` | Runtime UI error containment. |
| `components/ThemeContext.tsx` / `ThemeToggle.tsx` | Light/dark theme support. |

## Testing

Vitest is configured in `vite.config.ts` with:

- `globals: true`
- `environment: 'jsdom'`
- `setupFiles: './setupTests.ts'`
- V8 coverage provider
- 90 percent coverage thresholds

Run all tests:

```powershell
npm.cmd test
```

Run one file:

```powershell
npm.cmd test -- types.test.ts
```

Run coverage:

```powershell
npm.cmd test -- --coverage
```

The current testing docs say core model/service tests exist, while multiple component integration tests may need mock fixes. Treat `TESTING.md` as the current status note before relying on the whole suite as a release gate.

## Adding a New Screen

1. Add the component in `components/`.
2. Add an entry in `Sidebar.tsx` with allowed roles.
3. Map the new `activeTab` ID in `App.tsx`.
4. Read branch-scoped data through `store` getters.
5. Subscribe to store updates if the view should update live.
6. Add or update tests where practical.
7. Run `npm.cmd run build`.

## Adding a New Backend Resource

1. Add a table or columns in `schema.sql`.
2. Add backend routes in `server.cjs`.
3. Add TypeScript types in `types.ts`.
4. Add mapping logic in `store.refresh()`.
5. Add store getters/mutations.
6. Wire components to store methods.
7. Add tests for mapping and business rules.

## Environment Variables

Backend:

- `DATABASE_URL`: PostgreSQL connection string.
- `PORT`: optional API server port; defaults to `5000`.

Frontend:

- `VITE_GEMINI_API_KEY`: optional key used by `services/geminiService.ts`.

`vite.config.ts` also defines `process.env.GEMINI_API_KEY` and `process.env.DATABASE_URL`, but the Gemini service currently reads `import.meta.env.VITE_GEMINI_API_KEY`.


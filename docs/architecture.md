# Architecture

## High-Level Shape

The application has three main layers:

- React/Vite frontend in `App.tsx`, `components/`, `hooks/`, `services/`, and `types.ts`.
- Local Express bridge server in `server.cjs`.
- PostgreSQL database described by `schema.sql`.

Runtime flow:

```text
Browser React app
  -> services/dataStore.ts
  -> http://localhost:5000/api
  -> server.cjs
  -> PostgreSQL
```

The frontend also keeps a localStorage fallback cache for loans, users, collectors, and demand letters. This allows the app to initialize with local data if the backend cannot be reached.

## Frontend Entry Points

- `index.html` loads Tailwind via CDN, defines global styling, and mounts the app.
- `index.tsx` renders React.
- `App.tsx` owns current user, active tab, sidebar state, selected branch, loading state, notifications, and route-like component switching.
- `types.ts` defines the domain model used across the frontend.
- `constants.tsx` contains shared UI constants, formatting helpers, and visual mappings.

## App Shell

`App.tsx` performs initial bootstrapping:

1. Reads `melann_user` from localStorage.
2. Restores branch selection for super admins from `melann_selected_branch`.
3. Subscribes to the store.
4. Calls `store.refresh()` to fetch backend data.
5. Shows the loading screen until store data arrives.
6. Renders `LoginPage` when no user is authenticated.
7. Renders the sidebar/header/app content when a user is logged in.

The active screen is controlled by `activeTab`. There is no React Router; `Sidebar` changes tab IDs, and `App.tsx` maps those IDs to components.

## Navigation Map

Main app routes are tab IDs:

| Tab ID | Component | Purpose |
| --- | --- | --- |
| `dashboard` | `Dashboard` | KPI dashboard and management insight. |
| `loans` | `LoanGrid` | Main account list. |
| `loans-import` | `LoanGrid` + import action | Opens import workflow. |
| `loans-add` | `LoanGrid` + add action | Opens add-client workflow. |
| `client-update` | `ClientUpdate` | Main update log. |
| `client-update-advance` | `ClientUpdate` | Advance reminders. |
| `client-update-critical` | `ClientUpdate` | Critical action queue. |
| `client-update-monitoring` | `ClientUpdate` | Close monitoring queue. |
| `client-update-no-activity` | `ClientUpdate` | No-activity accounts. |
| `receive-payment` | `PaymentForm` | Post payments. |
| `receive-payment-reverse` | `PaymentForm` | Reverse payments. |
| `collection-sheet` | `CollectionSheet` | Collector collection sheet. |
| `dcr` | `DailyCollectionReport` | Daily collection report. |
| `reports` | `Reports` | Collector performance report. |
| `reports-monthly` | `Reports` | Monthly performance report. |
| `reports-aging` | `Reports` | Aging of receivables. |
| `demand-letters` | `DemandLetter` | Demand letter tracking. |
| `action-tracker` | `ClientActionTracker` | Account lifecycle/action tracking. |
| `collectors` | `Collectors` | Collector directory. |
| `users` | `UserManagement` | User account approval/status. |
| `database` | `BackupRestore` | JSON backup and restore. |

## State Management

The app uses a singleton `DataStore` exported as `store` from `services/dataStore.ts`.

The store owns:

- `loans`
- `users`
- `collectors`
- `demandLetters`
- `visitLogs`
- `listeners`

Components read from store getters and subscribe with `store.subscribe(listener)`. Mutations generally:

1. Call the backend API.
2. Update in-memory state after success.
3. Write supported data to localStorage.
4. Notify subscribers.

Some read-heavy reports derive their values directly from current store data.

## Store Refresh

`store.refresh()` fetches these backend resources in parallel:

- `/api/loans`
- `/api/users`
- `/api/collectors`
- `/api/demand_letters`
- `/api/payments`
- `/api/remarks`
- `/api/activity_logs`
- `/api/visit_logs`

The refresh step maps database column names to TypeScript field names, attaches payments/remarks/history to loans, deduplicates collectors, recalculates loan finances, syncs loan interaction dates from remarks, and notifies subscribers.

If backend sync fails and the store has no loans, it falls back to localStorage or built-in seed records.

## Backend Bridge

`server.cjs` is an Express server. It:

- Loads `.env.local`.
- Connects to PostgreSQL using `pg.Pool`.
- Enables CORS.
- Accepts JSON and URL-encoded payloads up to 50 MB.
- Serves uploaded files from `/uploads`.
- Ensures `public/uploads/collectors` exists.
- Ensures `collectors.photo_url` exists at startup.
- Seeds the default `admin` user when the users table is empty.

The server exposes REST endpoints under `/api`.

## Database

`schema.sql` defines the schema:

- `users`
- `collectors`
- `loans`
- `payments`
- `remarks`
- `demand_letters`
- `activity_logs`
- `visit_logs`

Foreign keys cascade deletes from loans to related payments, remarks, demand letters, activity logs, and visit logs.

Important indexes/constraints:

- `users.username` is unique.
- `payments.or_number` is unique.
- `payments (loan_id, date)` is unique for same-loan same-date upsert behavior.
- Collector name and nickname have normalized unique indexes.

## Branch Scoping

Branch scoping is represented by the `Branch` enum:

- `Naval Branch`
- `Ormoc Branch`
- `All Branches`

Most store getters accept an optional branch. If branch is missing or `All Branches`, the full collection is returned. Otherwise, records are filtered by exact branch string.

Super admins can select all branches. Branch users are locked to their own branch when they log in.

## Audit History

Loan activity history is stored in `activity_logs`.

The store records history for events such as:

- Bulk import.
- Loan updates.
- Remarks.
- Payment recorded.
- Payment reversed.
- Demand letter issued.
- Legal status update.
- Visit log.

History is attached back to each loan during `refresh()`.

## Financial Recalculation

Loan balances are recalculated from payment history. Good payments reduce running balance; reversed payments are ignored.

The recalculation updates:

- `amountCollected`
- `runningBalance`
- `status`

When running balance reaches zero, the loan becomes paid. Otherwise it remains or returns to an active movement status.

## Client Update Derivations

`hooks/useClientUpdates.ts` centralizes queue derivation:

- `updateList`: accounts with remarks, sorted by newest remark.
- `topPriorityList`: urgent accounts due today or marked top priority.
- `reminderList`: accounts with commitment dates tomorrow.
- `closeMonitoringList`: accounts with missed commitments and no satisfying payment after the missed date.
- `filteredMainList`: remaining update-log accounts not in the specialized queues.

`Sidebar` uses the same hook to compute new-item badges for Client Update submenus.

## AI Integration

`services/geminiService.ts` uses `@google/generative-ai` when `import.meta.env.VITE_GEMINI_API_KEY` is present.

AI features:

- `getLoanInsights(loans)` summarizes high-risk loan data for the dashboard.
- `analyzeRemarkPriority(remarkText)` classifies remarks into priority levels.

Fallback behavior:

- Missing/placeholder key returns `null` model.
- Dashboard insight generation falls back to deterministic mock text.
- Remark priority falls back to `Lowest Priority`.

## Error Boundaries

`components/ErrorBoundary.tsx` wraps the main content area. A rendering failure inside the active tab is contained so the whole app shell does not disappear.


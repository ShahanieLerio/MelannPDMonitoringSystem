# Melann Lending Past Due and Report Monitoring

Melann Lending Past Due and Report Monitoring is a branch-aware collection operations app for tracking past-due loan accounts, borrower follow-ups, collector activity, payments, daily collections, demand letters, and management reports.

The app is built with React 19, Vite, TypeScript, Tailwind CDN classes in `index.html`, an Express bridge server, and PostgreSQL. The frontend talks to the local API at `http://localhost:5000/api`, while the Vite app runs on port `3000`.

## Documentation

- [User guide](docs/user-guide.md) - how each app area is used by branch users and administrators.
- [Architecture](docs/architecture.md) - frontend/backend structure, state flow, and important design decisions.
- [Data model and API](docs/data-model-api.md) - tables, TypeScript entities, and REST endpoints.
- [Developer guide](docs/developer-guide.md) - local setup, scripts, code layout, and testing workflow.
- [Operations guide](docs/operations.md) - database setup, imports, backups, troubleshooting, and maintenance scripts.

## Main Capabilities

- Role-based access for `SUPER_ADMIN`, `NAVAL_USER`, and `ORMOC_USER`.
- Branch scoping for Naval Branch, Ormoc Branch, or All Branches.
- Client and loan grid with manual add/edit, Excel import, address import, filtering, and client profile views.
- Client update queues for critical action, advance reminders, close monitoring, and no-activity accounts.
- Payment posting and payment reversal with audit history and balance recalculation.
- Daily collection report, collection sheet, monthly performance, aging report, and collector performance views.
- Demand letter tracking from preparation through receipt, follow-up, visit logging, and settlement.
- Collector directory with nickname normalization, duplicate protection, branch assignment, address, and photo upload.
- Backup and restore by role/branch.
- Optional Gemini-powered management insights with deterministic fallback text when the key is unavailable.

## Quick Start

Prerequisites:

- Node.js
- PostgreSQL-compatible database connection string in `.env.local`

Install dependencies:

```powershell
npm install
```

Create or update `.env.local`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
VITE_GEMINI_API_KEY=optional_gemini_key
PORT=5000
```

Initialize the database schema:

```powershell
node scripts/setup_db.js
```

Start the backend bridge:

```powershell
npm.cmd run server
```

Start the frontend in a second terminal:

```powershell
npm.cmd run dev
```

Open the app at:

```text
http://localhost:3000
```

Default seeded login:

```text
admin
```

The login screen authenticates by username only. User accounts are permanent records; access is controlled through account status.

## Verification

Build the frontend:

```powershell
npm.cmd run build
```

Run tests:

```powershell
npm.cmd test
```

The existing testing documentation notes that several component integration tests may fail until their mocks and expectations are updated. See [TESTING.md](TESTING.md), [TEST_COVERAGE_SUMMARY.md](TEST_COVERAGE_SUMMARY.md), and [UNIT_TEST_IMPLEMENTATION.md](UNIT_TEST_IMPLEMENTATION.md).


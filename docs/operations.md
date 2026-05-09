# Operations Guide

## Starting the App

Use two terminals.

Terminal 1, backend:

```powershell
npm.cmd run server
```

Expected output includes:

```text
Successfully connected to Local PostgreSQL
Bridge Server running on http://localhost:5000
```

Terminal 2, frontend:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## Database Initialization

The schema lives in `schema.sql`.

Run:

```powershell
node scripts/setup_db.js
```

This script loads `.env.local`, reads `DATABASE_URL`, and applies the schema.

The backend also performs limited startup maintenance:

- Creates `public/uploads/collectors` if missing.
- Adds `collectors.photo_url` if missing.
- Seeds the default `admin` user if `users` is empty.

## Backup and Restore

Use the in-app Backup & Restore page for JSON backups.

Operational notes:

- Super-admin exports can include all branches.
- Branch-user exports are branch scoped.
- Branch users cannot import backups for another branch.
- Restore updates the browser store/localStorage representation; confirm backend expectations before treating JSON restore as a full database disaster recovery path.

For database-level backups, use your PostgreSQL provider tooling.

## Imports

Loan import modes:

- Replace: update matching client codes and add new clients.
- Wipe: delete target branch records, then insert the new import.
- New-only: add only records with client codes that do not already exist.

Address import modes follow the same general replace/wipe/new-only concept for addresses.

Safety note:

- Wipe mode calls `DELETE /api/loans/branch/:branch/wipe`. This is destructive for the target branch.
- Use a database backup before major imports.

## Payments

Payment posting is designed to be auditable:

- Backend payment write happens first.
- Loan finances are recalculated.
- Activity history is recorded.
- Store subscribers are notified.

Payment reversal:

- Marks the payment as `REVERSED`.
- Keeps the payment record.
- Recalculates balances without the reversed payment.
- Records reversal history.

## Collector Photos

Collector photos are accepted by the API as either:

- Existing URL/path.
- Base64 `data:image/...` URL.

Base64 uploads are written to:

```text
public/uploads/collectors
```

The API returns a path like:

```text
/uploads/collectors/<collector-id>-<timestamp>.png
```

The Express server serves files under:

```text
http://localhost:5000/uploads
```

## Useful Scripts

Database and migration scripts in the repo include:

- `scripts/setup_db.js`: apply schema using the configured database URL.
- `scripts/init_db.cjs`: local database initialization helper.
- `scripts/normalize_collector_names.cjs`: collector-name cleanup helper.
- `migrate.cjs`: migration helper.
- `migrate_specific_payments.cjs`: payment migration helper.
- `cleanup_and_fix_payments.cjs`: payment cleanup/repair helper.
- `cleanup_duplicate_payments.cjs`: duplicate payment cleanup.
- `cleanup_duplicates.cjs`: duplicate cleanup.
- `fix_all_mismatches.cjs`: mismatch repair.
- `verify_db.cjs`: database verification helper.
- `verify_good_status.cjs`: status verification helper.

Many root-level `.cjs` scripts are one-off diagnostics or repair utilities. Read a script before running it, especially scripts with names beginning with `fix_`, `cleanup_`, `delete_`, or `update_`.

## Troubleshooting

### Frontend Loads but Data Is Missing

Check that the backend is running:

```text
http://localhost:5000/api/loans
```

Then check:

- `.env.local` contains `DATABASE_URL`.
- PostgreSQL is reachable.
- `schema.sql` has been applied.
- Browser console does not show CORS or fetch errors.

If the backend is unavailable, the store may fall back to localStorage seed/cache data.

### Login Fails

Possible causes:

- Username does not exist.
- Account is `PENDING`.
- Account is `DEACTIVATED`.
- Users table did not seed because the backend could not connect.

If the database is empty and backend startup succeeds, `admin` should be seeded automatically.

### Build Command Fails in PowerShell

Use:

```powershell
npm.cmd run build
```

instead of:

```powershell
npm run build
```

### Port Conflicts

Defaults:

- Frontend Vite server: `3000`.
- Backend Express bridge: `5000`.

Set `PORT` in `.env.local` to change the backend port. If you change the backend port, also update `API_URL` in `services/dataStore.ts`.

### Gemini Insights Do Not Work

The Gemini integration reads:

```env
VITE_GEMINI_API_KEY=...
```

If the key is missing or invalid:

- Dashboard insights fall back to mock operational text.
- Remark priority analysis returns `Lowest Priority`.

### Duplicate Collector Errors

Collector identities are compared after normalization:

- Hidden zero-width characters removed.
- Leading/trailing whitespace trimmed.
- Multiple spaces collapsed.
- Uppercased.

Both name and nickname can collide. Update the existing collector record instead of creating another identity.

### Duplicate Same-Day Payments

The backend has a unique index on `(loan_id, date)` and the payment insert uses upsert behavior. A same-loan same-date payment replaces the previous row for that date.

If duplicates exist from older data, inspect and repair before relying on daily reports.

## Release Checklist

Before sharing a build:

1. Confirm `.env.local` has the intended database URL.
2. Run `node scripts/setup_db.js` against the target database if schema changes were made.
3. Start `npm.cmd run server`.
4. Start or build the frontend.
5. Run `npm.cmd run build`.
6. Smoke test login, dashboard, loan grid, payment posting, reports, and backup export.
7. Confirm no unexpected console errors.


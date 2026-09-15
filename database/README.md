# Database deployment files

## Existing company database (preserve all records)

Use `company_upgrade_no_data_loss.sql` against the company's existing PostgreSQL database.

- Back up the database first as a normal deployment precaution.
- The script changes schema only. It contains no record inserts, updates, deletes, truncation, table drops, or cascades.
- It is idempotent and can be run again safely.
- The final `SELECT` only reports row counts for verification.

## Brand-new blank database

Use the project-root `schema.sql` on an empty PostgreSQL database. It creates all current tables and indexes but inserts no records.

Example using the project setup command after setting `DATABASE_URL` in `.env.local`:

```powershell
node scripts/init_db.cjs
```

The bridge server creates the default administrator only when the `users` table is empty. It never replaces or deletes company users.

## Recommended deployment order

1. Record row counts and take a database backup.
2. Apply `company_upgrade_no_data_loss.sql` to the existing company database.
3. Deploy the updated application files.
4. Start the bridge server and confirm that its database initialization succeeds.
5. Smoke-test login, Supervisor management, Action Tracker personnel, demand letters, activity history, and payment posting.

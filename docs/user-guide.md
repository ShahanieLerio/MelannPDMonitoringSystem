# User Guide

This guide explains the visible workflows in the Melann Lending Past Due and Report Monitoring app.

## Roles and Branches

The app recognizes three roles:

- `SUPER_ADMIN` can view All Branches, Naval Branch, and Ormoc Branch. Super admins can also manage user accounts.
- `NAVAL_USER` is scoped to Naval Branch.
- `ORMOC_USER` is scoped to Ormoc Branch.

Branch users see only their branch data. A super admin can switch branch context from the header. The selected branch affects dashboard totals, loan lists, reports, collectors, demand letters, payments, and backup exports.

## Login

The login page authenticates by username through `store.authenticate`.

Account states:

- `PENDING` users cannot log in.
- `ACTIVE` users can log in.
- `DEACTIVATED` users cannot log in and must contact an administrator.

New self-registered accounts are created as `PENDING`. A super admin activates, deactivates, or reactivates them in Manage Users.

## Dashboard

The Dashboard summarizes branch performance and account risk. It uses live store data and updates when the store publishes changes.

Typical dashboard information includes:

- Total accounts.
- Total reported/outstanding amount.
- Total collected amount.
- Running balance.
- Account counts by movement status.
- Collector distribution and performance signals.
- Recent payments.
- Optional AI insights from Gemini.

If `VITE_GEMINI_API_KEY` is missing or invalid, the app falls back to deterministic mock insights so the dashboard remains usable.

## Loan Grid

Loan Grid is the main client account workspace.

Common actions:

- View branch-scoped loan accounts.
- Search and filter client records.
- Add a new client.
- Edit client details.
- Import clients from spreadsheet data.
- Import or update addresses.
- View client profile and history.
- Delete a client when needed.

Important behavior:

- Client codes are treated as unique account identifiers.
- `borrowerName` is derived from first name and last name for display.
- Existing payment, remark, and history data are preserved during replace-style imports.
- Wipe imports first clear the target branch in the backend, then insert the incoming records.
- New-only imports skip existing client codes.

## Client Update

Client Update organizes follow-up work into operational queues.

Views:

- Updates Log: accounts with remarks, sorted by newest remark.
- Advance Reminders: accounts with promise-to-pay or follow-up due tomorrow.
- Critical Action: accounts marked Top Priority or due today.
- Close Monitoring: accounts with missed promise/follow-up dates and no satisfying payment after the missed date.
- No Activity: accounts with no remarks.

Priority behavior:

- A good payment posted today removes the account from critical priority for the day.
- Promise-to-pay and follow-up dates can come from loan fields or the latest remark.
- Recurring schedules can make an account due today based on configured monthly days or weekly days.
- Close Monitoring excludes paid accounts, currently due accounts, and accounts with a good payment after the missed commitment date.

Client Update supports adding remarks, updating priority, recording commitment outcomes, viewing details, editing accounts, and logging visits for close-monitoring accounts.

## Payment Posting and Reversal

The Payments area has two modes:

- Post Payment
- Reverse Payment

Posting a payment:

- Finds the loan by client code.
- Creates a payment record with OR number, date, amount, recorder, remarks, and status.
- Recalculates `amountCollected`, `runningBalance`, and movement status.
- Adds an activity history record.
- Advances recurring schedules when the posted payment satisfies an active schedule.

Payment rules:

- Good payments count toward collection totals.
- Reversed payments are ignored by financial recalculation.
- The backend upserts payments by `loan_id` and `date`, so a loan can only have one payment row per collection date.

Reversing a payment:

- Searches by OR number.
- Marks the payment as `REVERSED`.
- Appends the reversal reason to payment remarks.
- Recalculates the loan balance.
- Records a payment reversal activity log.

## Collection Sheet

The Collection Sheet provides collector-oriented account lists and balances for a selected branch. It is designed for field collection planning and branch operations review.

It reads loan and collector data from the store and refreshes when the store changes.

## Daily Collection Report

The Daily Collection Report summarizes good payments for a selected date range.

It includes:

- Transaction rows by loan/client.
- Collector summaries.
- Grand total collected.
- Grand total accounts collected.

Only `GOOD` payments inside the selected date range are counted.

## Reports

Reports has multiple views:

- Collector performance.
- Monthly performance.
- Aging of receivables.

Collector performance is computed from branch-scoped loans:

- Total accounts.
- Reported amount.
- Collected amount.
- Running balance.
- Collection rate.
- Paid account count.

The Aging report groups receivables into age buckets from due dates and supports date filters.

## Demand Letters

Demand Letters tracks legal follow-up stages for delinquent accounts.

Supported types:

- 1st Demand Letter.
- 2nd Demand Letter.
- 3rd Demand Letter.

Statuses:

- Pending.
- For Follow-Up.
- Settled.

Follow-up date rules:

- 1st and 2nd demand letters: 10 days after date received.
- 3rd demand letter: 5 days after date received.

Important behavior:

- Creating a demand letter records an activity history entry.
- Demand letter remarks are mirrored into account remarks with a demand-letter marker.
- Updating status can adjust account priority.
- Third demand letters and overdue follow-up dates can surface as top-priority notifications.
- Field visit workflows can add visit notes and update demand letter/account status.

## Action Tracker

Action Tracker is a lifecycle view for monitoring account action stages and overdue operational commitments. It helps managers see which accounts need escalation, follow-up, or stage updates.

The component reads loans and demand letters from the store, then computes tracking views from current account data.

## Collectors

Collectors manages the collector directory.

Collector records include:

- Name.
- Nickname.
- Address.
- Branch.
- Optional photo.

Collector identity is normalized by trimming, removing hidden zero-width characters, collapsing whitespace, and uppercasing. The app prevents duplicate collector identities by comparing both name and nickname.

Collector photos posted as base64 data URLs are persisted by the backend under `public/uploads/collectors`, then served from `/uploads/collectors/...`.

## Manage Users

Manage Users is visible only to `SUPER_ADMIN`.

Admins can:

- Review pending users.
- Activate users.
- Deactivate users.
- Reactivate users.

Users are not deleted. The permanent user record and status history are retained for auditability.

## Backup and Restore

Backup and Restore exports JSON from the local store.

Export scope:

- Super admin can export all branches.
- Branch users export only their branch data.

Backup content:

- Loans.
- Users.
- Collectors.
- Demand letters.
- Metadata with branch and exporter information.
- Export timestamp.

Restore rules:

- Branch users cannot restore a backup for another branch.
- All-branch backups replace all supported data groups.
- Branch backups replace only that branch's loans, collectors, and demand letters.
- User replacement during branch restore is limited to super admins.

## Notifications

The header notification menu shows up to five current alerts.

Alerts include:

- Top-priority loans.
- Follow-ups due today.
- Payments due today.
- Demand letter follow-ups due today or earlier.
- Third demand letters requiring constant follow-up.


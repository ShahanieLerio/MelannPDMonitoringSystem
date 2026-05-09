# Data Model and API Reference

This reference maps the frontend TypeScript model to the backend API and PostgreSQL schema.

## TypeScript Domain Model

All shared frontend domain types live in `types.ts`.

### User

Fields:

- `id`
- `username`
- `fullName`
- `role`
- `status`
- `branch`
- `createdAt`
- `createdBy`
- `statusHistory`

Roles:

- `SUPER_ADMIN`
- `NAVAL_USER`
- `ORMOC_USER`

Statuses:

- `PENDING`
- `ACTIVE`
- `DEACTIVATED`

### Branch

Values:

- `Naval Branch`
- `Ormoc Branch`
- `All Branches`

### Loan

Core fields:

- `id`
- `collector`
- `code`
- `borrowerName`
- `firstName`
- `lastName`
- `monthReported`
- `dueDate`
- `dateRelease`
- `principal`
- `totalLoan`
- `outstandingBalance`
- `amountCollected`
- `runningBalance`
- `status`
- `location`
- `area`
- `city`
- `barangay`
- `fullAddress`
- `contactNumber`
- `promiseToPayDate`
- `followUpDate`
- `recurringSchedule`
- `branch`
- `actionNote`
- `actionStage`
- `payments`
- `remarks`
- `history`
- `aiPriority`

Movement statuses:

- `Paid`
- `M`
- `NM`
- `NMSR`

Location statuses:

- `L`
- `NL`

Priority levels:

- `Top Priority`
- `Need Attention / Full Commitment`
- `Follow-up`
- `Monitor Closely`
- `Lowest Priority`

### Payment

Fields:

- `id`
- `loanId`
- `date`
- `orNumber`
- `amount`
- `balanceAfter`
- `recorder`
- `remarks`
- `status`
- `createdAt`

Statuses:

- `GOOD`
- `REVERSED`

### Remark

Fields:

- `id`
- `text`
- `timestamp`
- `collector`
- `ptpDate`
- `followUpDate`

Remarks can drive Client Update queues through promise-to-pay and follow-up dates.

### Collector

Fields:

- `id`
- `name`
- `nickname`
- `address`
- `photoUrl`
- `branch`

Collector names and nicknames are normalized for duplicate detection and display.

### DemandLetter

Fields:

- `id`
- `collectorName`
- `loanId`
- `borrowerName`
- `type`
- `datePrepared`
- `dateReceived`
- `followUpDate`
- `status`
- `remarks`
- `branch`

Types:

- `1st Demand Letter`
- `2nd Demand Letter`
- `3rd Demand Letter`

Statuses:

- `Pending`
- `For Follow-Up`
- `Settled`

### VisitLog

Fields:

- `id`
- `loanId`
- `visitDate`
- `collectorNotes`
- `clientComment`
- `visitedByCollector`
- `action`
- `loggedBy`
- `timestamp`

Actions:

- `Log Only`
- `Returned to Client Update`
- `Marked as Settled`

## Database Tables

### `users`

Purpose: permanent user records and status history.

Columns:

- `id` primary key
- `username` unique
- `full_name`
- `role`
- `status`
- `branch`
- `created_at`
- `created_by`
- `status_history` JSONB

### `collectors`

Purpose: collector directory.

Columns:

- `id` primary key
- `name`
- `nickname`
- `address`
- `photo_url`
- `branch`

Indexes:

- Normalized unique name.
- Normalized unique nickname when nickname is present.

### `loans`

Purpose: client/account master data.

Columns:

- `id` primary key
- `collector`
- `code`
- `first_name`
- `last_name`
- `borrower_name`
- `month_reported`
- `due_date`
- `outstanding_balance`
- `amount_collected`
- `running_balance`
- `status`
- `location`
- `area`
- `city`
- `barangay`
- `full_address`
- `contact_number`
- `branch`
- `ai_priority`
- `promise_to_pay_date`
- `follow_up_date`
- `recurring_schedule` JSONB
- `action_note`
- `action_stage`
- `created_at`

### `payments`

Purpose: payment stream.

Columns:

- `id` primary key
- `loan_id` references `loans(id)` on delete cascade
- `amount`
- `or_number` unique
- `date`
- `balance_after`
- `recorder`
- `remarks`
- `status`
- `created_at`

Index:

- Unique `(loan_id, date)`.

### `remarks`

Purpose: client update notes and commitment dates.

Columns:

- `id` primary key
- `loan_id` references `loans(id)` on delete cascade
- `text`
- `timestamp`
- `collector`
- `ptp_date`
- `follow_up_date`

### `demand_letters`

Purpose: legal process tracking.

Columns:

- `id` primary key
- `loan_id` references `loans(id)` on delete cascade
- `collector_name`
- `borrower_name`
- `type`
- `date_prepared`
- `date_received`
- `follow_up_date`
- `status`
- `remarks`
- `branch`

### `activity_logs`

Purpose: audit history attached to loans.

Columns:

- `id` primary key
- `loan_id` references `loans(id)` on delete cascade
- `timestamp`
- `type`
- `description`
- `user_name`
- `user_role`
- `module`

### `visit_logs`

Purpose: close-monitoring visit records.

Columns:

- `id` primary key
- `loan_id` references `loans(id)` on delete cascade
- `visit_date`
- `collector_notes`
- `client_comment`
- `visited_by_collector`
- `action`
- `logged_by`
- `timestamp`

## API Endpoints

Base URL:

```text
http://localhost:5000/api
```

### Users

`GET /users`

Returns all users.

`POST /users`

Creates a user.

Expected frontend body:

- `id`
- `username`
- `fullName`
- `role`
- `status`
- `branch`
- `createdAt`
- `createdBy`
- `statusHistory`

`PUT /users/:id/status`

Updates status and status history.

Body:

- `status`
- `statusHistory`

### Loans

`GET /loans`

Returns all loans ordered by last name, then first name.

`POST /loans/bulk`

Bulk inserts loans inside a transaction.

Body: array of frontend `Loan` objects.

`POST /loans`

Creates one loan.

`PUT /loans/:id`

Updates one loan.

`DELETE /loans/:id`

Deletes one loan and cascades related records.

`DELETE /loans/branch/:branch/wipe`

Deletes all loans for a branch. Passing `All Branches` deletes all loans.

This endpoint is used by wipe imports and should be treated as destructive.

### Payments

`GET /payments`

Returns all payments.

`POST /payments`

Creates or replaces a payment for the same `loan_id` and `date`.

Body:

- `id`
- `loanId`
- `amount`
- `orNumber`
- `date`
- `balanceAfter`
- `recorder`
- `remarks`
- `status`
- `createdAt`

`PUT /payments/:orNumber`

Updates payment status and remarks by OR number. Used for reversals.

### Collectors

`GET /collectors`

Returns all collectors.

`POST /collectors`

Creates a collector after duplicate identity validation. Base64 data-image photo URLs are persisted to disk and replaced with an upload path.

`PUT /collectors/:id`

Updates a collector after duplicate identity validation.

`DELETE /collectors/:id`

Deletes a collector.

### Remarks

`GET /remarks`

Returns all remarks.

`POST /remarks`

Creates a remark.

Expected frontend body:

- `id`
- `loanId`
- `text`
- `collector`
- `timestamp`
- `ptpDate`
- `followUpDate`

`PUT /remarks/:id`

Updates remark text and commitment dates.

### Demand Letters

`GET /demand_letters`

Returns all demand letters.

`POST /demand_letters`

Creates a demand letter.

`PUT /demand_letters/:id`

Updates type, dates, follow-up date, status, and remarks.

### Activity Logs

`GET /activity_logs`

Returns all activity logs.

`POST /activity_logs`

Creates one activity log.

### Visit Logs

`GET /visit_logs`

Returns all visit logs ordered newest first.

`GET /visit_logs/:loanId`

Returns visit logs for one loan ordered newest first.

`POST /visit_logs`

Creates a visit log.

## Frontend Store API

Important public methods in `services/dataStore.ts`:

- `refresh()`
- `subscribe(listener)`
- `getUsers()`
- `authenticate(username)`
- `registerUser(userData, creatorName)`
- `updateUserStatus(id, status, updaterName)`
- `getCollectors(branch)`
- `addCollector(...)`
- `updateCollector(...)`
- `deleteCollector(id)`
- `bulkAddLoans(loans, user, role, importMode, targetBranch)`
- `bulkUpdateAddresses(addresses, user, role, importMode)`
- `getLoans(branch)`
- `addLoan(loanData, user, role)`
- `updateLoan(id, updates, user, role)`
- `addRemark(...)`
- `updateRemark(...)`
- `deleteLoan(id)`
- `getLoanByCode(code)`
- `recordPayment(...)`
- `reversePayment(orNumber, reason, recorder, role)`
- `getPaymentByOR(orNumber)`
- `getRecentPayments(branch, limit)`
- `getDailyCollections(fromDate, toDate, branch)`
- `getStats(branch)`
- `getCollectorPerformance(branch)`
- `getDemandLetters(branch)`
- `getVisitLogs(loanId)`
- `addVisitLog(...)`
- `getCollectorDistribution(branch)`
- `addDemandLetter(dlData, user, role)`
- `updateDemandLetter(id, updates, user, role)`
- `exportData(user, branch)`
- `importData(jsonData, user, currentBranch)`


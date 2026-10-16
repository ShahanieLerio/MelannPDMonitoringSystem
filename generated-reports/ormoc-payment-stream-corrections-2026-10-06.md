# Ormoc payment-stream corrections

Completed: Oct 6, 2026, 2:13 PM (Asia/Manila).

**Scope:** The 11 payment-stream review clients in the prior Reported Amount audit. The user expressly included the two with Month Reported in 2026. The two remaining clients from the original first-ten list and the five terminal accounts were excluded.

**Method:** Chronologically recompute balance_after from Total Loan, any source collected adjustment, and every non-REVERSED payment. Set Reported Amount to the recomputed balance after the last GOOD payment before the first day of Month Reported. No payment date, amount, status, or Month Reported was changed.

**Result:** 10 Reported Amounts and 762 stored payment balance_after values corrected. Durano's Reported Amount was already correct; only his payment balances needed correction. The app API independently verified all 11 Reported Amounts and the complete 790-payment histories after commit.

Previous values and payment-row details are preserved in [the JSON backup](./ormoc-payment-stream-correction-backup-2026-10-06.json).

| # | Client | Code | Month Reported | Last GOOD payment before month | Reported Before | Reported After | Payment balances corrected |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: |
| 1 | BORROMEO, WILSON | 2916 | 2023-01 | 2022-12-27 | ₱3,396.00 | ₱660.00 | 29 |
| 2 | ESTREMOS, LEDGIE | 2108 | 2022-01 | 2021-11-24 | ₱2,487.00 | ₱268.00 | 9 |
| 3 | BACARISAS, LENY | 2166 | 2022-06 | 2022-05-23 | ₱4,755.00 | ₱3,070.00 | 60 |
| 4 | APUYA, ANECITO | 2252 | 2021-11 | 2021-10-30 | ₱1,870.00 | ₱300.00 | 29 |
| 5 | BACARISAS, JOCELYN | 2069 | 2022-12 | 2022-11-21 | ₱5,529.00 | ₱4,235.00 | 72 |
| 6 | YUTRAGO, EMARLYN | 2128 | 2026-05 | 2026-04-27 | ₱1,610.00 | ₱1,185.00 | 33 |
| 7 | ALVA, ECHEVARRIA | 2132 | 2021-11 | 2021-10-21 | ₱1,226.00 | ₱976.00 | 44 |
| 8 | TUDIO, ROSITA | 1428 | 2023-12 | 2023-08-11 | ₱16,650.00 | ₱16,600.00 | 104 |
| 9 | ABAJON, JOY | 994 | 2026-02 | 2026-01-29 | ₱4,610.00 | ₱4,560.00 | 55 |
| 10 | DURANO, RODULFO | 452 | 2024-04 | 2024-03-26 | ₱27,960.00 | ₱27,960.00 | 252 |
| 11 | Refugio, Annabelle | 591 | 2019-11 | 2019-10-31 | ₱9,060.00 | ₱9,040.00 | 75 |

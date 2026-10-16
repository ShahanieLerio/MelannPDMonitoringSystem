# Ormoc terminal-account financial corrections

Completed: Oct 6, 2026, 2:30 PM (Asia/Manila).

**Scope:** The five terminal-outcome accounts from the Reported Amount audit. Reported Amount means Total Loan less actual cash collections before the first day of Month Reported. A Dead/Deceased or Write-Off entry is a noncash outcome, so it does not count as a cash collection.

**Result:** Three Reported Amounts changed. Surio and Gandia were already correct under the cash-only rule. Twenty-three stored payment balance_after fields were brought into line with the app's chronological payment stream. Payment amounts, dates, statuses, remarks, Month Reported, management dispositions, and terminal classification were not changed.

**Verification:** The app API showed the expected Reported Amount for all five accounts and consistent balance_after values across all 289 payments. Previous values are saved in [the JSON backup](./ormoc-terminal-account-correction-backup-2026-10-06.json).

| # | Client | Code | Month Reported | Reported Before | Reported After | Payment balances corrected | Basis |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 | Surio, Rogelio M. | 3725 | 2024-02 | ₱17,728.00 | ₱17,728.00 | 11 | Deceased; ₱12,328 noncash entry before report |
| 2 | GANDIA, MERCY | 487 | 2018-09 | ₱10,900.00 | ₱10,900.00 | 0 | Write-Off charge; ₱10,900 noncash entry before report |
| 3 | Pacaldo, Reynaldo | 2583 | 2026-01 | ₱0.00 | ₱3,365.00 | 0 | Dead settlement happened after report month |
| 4 | BALORO, VILMA | 2564 | 2022-10 | ₱2,360.00 | ₱400.00 | 12 | Pending write-off review; recorded GOOD payments before report |
| 5 | YANGAO, EMIY | 927 | 2020-05 | ₱33,800.00 | ₱33,797.00 | 0 | Pending write-off review; ₱3 source adjustment already reflected in payment balance |

**Classification note:** Gandia's existing note says the account is a Write-Off, not a deceased client, but also contains the word Dead. This financial correction did not rewrite that historical note or change the app's terminal category logic.

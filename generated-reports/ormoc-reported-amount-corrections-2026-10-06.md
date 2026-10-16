# Ormoc Reported Amount corrections

Completed: Oct 6, 2026, 1:55 PM (Asia/Manila).

Corrected **45** records from the previously identified 83-client list where Month Reported was 2025 or earlier. The other **38** records have Month Reported in 2026 and were excluded. The two previously highlighted clients (Cabintoy and Irlandez), 11 payment-balance review cases, and 5 terminal-outcome cases were outside this correction.

Only the loans.outstanding_balance field (Reported Amount) was changed. Month Reported and payment entries were not changed. Post-commit API verification passed for all 45 corrected records and all 38 excluded 2026 records.

Backup of the previous amounts: [JSON backup](./ormoc-reported-amount-correction-backup-2026-10-06.json).

| # | Client | Code | Month Reported | Last GOOD payment before month | Before | After |
| ---: | --- | --- | --- | --- | ---: | ---: |
| 1 | HORCA, FE | 2139 | 2022-06 | 2022-04-29 | ₱3,002.00 | ₱1,670.00 |
| 2 | SEVILLA, CELERINA | 2588 | 2025-02 | 2025-01-23 | ₱6,422.00 | ₱7,722.00 |
| 3 | INSO, ANGELYN | 1355 | 2019-08 | 2019-07-25 | ₱3,235.00 | ₱2,235.00 |
| 4 | PERALTA, JUDY ANN | 2335 | 2023-02 | 2022-12-20 | ₱2,156.00 | ₱1,575.00 |
| 5 | MALUPA, JESSA | 1776 | 2025-02 | 2025-01-22 | ₱4,172.00 | ₱3,672.00 |
| 6 | ANICETO, MARILYN | 3165 | 2025-01 | 2024-12-12 | ₱8,901.00 | ₱8,472.00 |
| 7 | Cataag, Daniela | 2320 | 2022-08 | 2022-05-31 | ₱5,152.00 | ₱4,752.00 |
| 8 | FENIX, LUCIA | 1514 | 2020-06 | 2020-05-25 | ₱9,340.00 | ₱8,940.00 |
| 9 | MERCOLITA, CHARITA | 3412 | 2025-01 | 2024-12-26 | ₱3,006.00 | ₱3,366.00 |
| 10 | ESTRERA, NELFA | 2817 | 2025-11 | 2025-10-11 | ₱6,300.00 | ₱5,950.00 |
| 11 | GRACIANO, JESUSA | 1922 | 2021-09 | 2021-06-23 | ₱9,432.00 | ₱9,732.00 |
| 12 | CALA, LOUIE JAY | 3356 | 2025-01 | 2024-12-27 | ₱71,900.00 | ₱71,640.00 |
| 13 | CA�ETE, NAUME | 3451 | 2025-01 | 2024-10-07 | ₱10,250.00 | ₱10,050.00 |
| 14 | LONGAKIT, TIOFILO | 294 | 2020-05 | 2020-03-14 | ₱8,540.00 | ₱8,340.00 |
| 15 | NAILON, ESTRELLA | 1026 | 2020-03 | 2020-02-26 | ₱20,419.00 | ₱20,219.00 |
| 16 | REGALA, ROCELA | 4016 | 2025-11 | 2025-10-28 | ₱3,025.00 | ₱2,825.00 |
| 17 | AMABAO, IRENE | 4013 | 2025-10 | 2025-07-23 | ₱2,900.00 | ₱2,750.00 |
| 18 | FORTALIZA, ROCHELLE | 1218 | 2019-04 | 2019-03-30 | ₱2,710.00 | ₱2,860.00 |
| 19 | ALDAYA, RUBELYN | 2092 | 2025-11 | 2025-10-29 | ₱2,695.00 | ₱2,595.00 |
| 20 | ARIÑO, JESSA | 285 | 2017-06 | None | ₱5,223.00 | ₱5,123.00 |
| 21 | BASMAYOR, CARMELITA | 1771 | 2025-02 | 2025-01-15 | ₱2,788.00 | ₱2,688.00 |
| 22 | CERRO, EMILY | 3190 | 2023-10 | 2023-06-16 | ₱2,811.00 | ₱2,711.00 |
| 23 | CORPEZ, NECIFORA | 3471 | 2025-08 | 2025-06-10 | ₱5,730.00 | ₱5,830.00 |
| 24 | ESPINOSA, BERNANDITA | 3578 | 2025-10 | 2025-08-30 | ₱5,100.00 | ₱5,000.00 |
| 25 | LINGO, JACQUELINE | 1681 | 2024-01 | 2023-12-26 | ₱20,635.00 | ₱20,535.00 |
| 26 | MARIBAO, LELITH | 3168 | 2025-08 | 2025-07-28 | ₱26,459.00 | ₱26,359.00 |
| 27 | PANILAWON, LILIBETH | 3241 | 2024-10 | 2024-09-25 | ₱2,742.00 | ₱2,642.00 |
| 28 | PORTILLO, MAGDALENA | 3011 | 2023-10 | 2023-08-22 | ₱3,419.00 | ₱3,319.00 |
| 29 | YAON, NENITA | 4064 | 2025-12 | 2025-11-22 | ₱6,540.00 | ₱6,640.00 |
| 30 | DEMANDANTE, MERLE | 3698 | 2025-11 | 2025-09-20 | ₱1,201.00 | ₱1,111.00 |
| 31 | BAGAYAS, MYLA | 2154 | 2022-08 | 2022-06-07 | ₱2,490.00 | ₱2,440.00 |
| 32 | CAONES, ESTRELLITA | 2616 | 2023-08 | 2023-07-21 | ₱4,680.00 | ₱4,630.00 |
| 33 | DADIS, MICHELLE | 344 | 2020-06 | 2020-03-03 | ₱4,260.00 | ₱4,310.00 |
| 34 | MERAMONTE, ROZEL | 1848 | 2025-02 | 2025-01-06 | ₱4,000.00 | ₱3,950.00 |
| 35 | GAMUTAN, ANNIE | 297 | 2018-09 | 2018-06-08 | ₱8,420.00 | ₱8,390.00 |
| 36 | OLIMPUS, LUISA | 301 | 2018-04 | 2018-01-23 | ₱5,770.00 | ₱5,750.00 |
| 37 | SEBIDOS, LIA | 760 | 2018-04 | 2018-03-26 | ₱9,649.00 | ₱9,629.00 |
| 38 | JUGAR, ELIZABETH | 1005 | 2019-11 | 2019-10-31 | ₱66,550.00 | ₱66,540.00 |
| 39 | TOONG, DESERIE | 1318 | 2019-09 | 2019-08-29 | ₱11,407.00 | ₱11,397.00 |
| 40 | GABI, AMOR | 2802 | 2023-08 | 2023-07-17 | ₱6,902.00 | ₱6,897.00 |
| 41 | MAGALLANES, MADELIN | 2236 | 2022-08 | 2022-06-02 | ₱6,220.00 | ₱6,215.00 |
| 42 | MONES, EULALIA | 1366 | 2020-05 | 2020-03-12 | ₱14,610.00 | ₱14,605.00 |
| 43 | PAJARON, MERCY CHRISTINE | 1128 | 2018-10 | 2018-09-17 | ₱3,935.00 | ₱3,930.00 |
| 44 | PANTA JR, DIOSDADO | 2552 | 2024-12 | 2024-11-27 | ₱7,406.00 | ₱7,401.00 |
| 45 | FLORES, MARIFE | 247 | 2018-12 | 2018-09-18 | ₱6,054.00 | ₱6,051.00 |

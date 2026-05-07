$connString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\Admin\OneDrive\Documents\PRD\jcashdb\jcashdb.mdb;Jet OLEDB:Database Password=kim123;"

$queryLoans = "SELECT * FROM tblLoan WHERE Status = 'Good' AND Maturity >= #2016-01-01# AND Maturity <= #2026-02-15#"
$queryPayments = "SELECT p.* FROM tblPayment p INNER JOIN tblLoan l ON p.LoanID = l.LoanID WHERE l.Status = 'Good' AND l.Maturity >= #2016-01-01# AND l.Maturity <= #2026-02-15# AND p.Status = 'Good'"

$conn = New-Object System.Data.OleDb.OleDbConnection($connString)
$conn.Open()

$cmdLoans = New-Object System.Data.OleDb.OleDbCommand($queryLoans, $conn)
$daLoans = New-Object System.Data.OleDb.OleDbDataAdapter($cmdLoans)
$dtLoans = New-Object System.Data.DataTable
$daLoans.Fill($dtLoans) | Out-Null
$dtLoans | Export-Csv -Path "loans.csv" -NoTypeInformation

$cmdPayments = New-Object System.Data.OleDb.OleDbCommand($queryPayments, $conn)
$daPayments = New-Object System.Data.OleDb.OleDbDataAdapter($cmdPayments)
$dtPayments = New-Object System.Data.DataTable
$daPayments.Fill($dtPayments) | Out-Null
$dtPayments | Export-Csv -Path "payments.csv" -NoTypeInformation

$conn.Close()
Write-Host "Exported $($dtLoans.Rows.Count) loans and $($dtPayments.Rows.Count) payments."

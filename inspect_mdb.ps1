$adOpenStatic = 3
$adLockOptimistic = 3

$conn = New-Object -ComObject ADODB.Connection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\Admin\OneDrive\Documents\PRD\jcashdb\jcashdb.mdb;Jet OLEDB:Database Password=kim123;"
try {
    $conn.Open()
    $rsLoan = $conn.Execute("SELECT TOP 1 * FROM tblLoan")
    $loanCols = @()
    for ($i = 0; $i -lt $rsLoan.Fields.Count; $i++) {
        $loanCols += $rsLoan.Fields.Item($i).Name
    }
    
    $rsPayment = $conn.Execute("SELECT TOP 1 * FROM tblPayment")
    $paymentCols = @()
    for ($i = 0; $i -lt $rsPayment.Fields.Count; $i++) {
        $paymentCols += $rsPayment.Fields.Item($i).Name
    }

    $result = @{
        tblLoan = $loanCols
        tblPayment = $paymentCols
    }
    $result | ConvertTo-Json -Depth 5
    $conn.Close()
} catch {
    Write-Host "Error: $_"
}

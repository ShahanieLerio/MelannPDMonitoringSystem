$conn = New-Object -ComObject ADODB.Connection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\Admin\OneDrive\Documents\PRD\jcashdb\jcashdb.mdb;Jet OLEDB:Database Password=kim123;"
try {
    $conn.Open()
    
    $rs = $conn.Execute("SELECT DISTINCT Status, LoanStatus FROM tblLoan")
    $loanStatuses = @()
    while (-not $rs.EOF) {
        $loanStatuses += @{
            Status = $rs.Fields.Item("Status").Value
            LoanStatus = $rs.Fields.Item("LoanStatus").Value
        }
        $rs.MoveNext()
    }
    
    $rs2 = $conn.Execute("SELECT DISTINCT Status FROM tblPayment")
    $paymentStatuses = @()
    while (-not $rs2.EOF) {
        $paymentStatuses += $rs2.Fields.Item("Status").Value
        $rs2.MoveNext()
    }

    $result = @{
        tblLoanStatuses = $loanStatuses
        tblPaymentStatuses = $paymentStatuses
    }
    $result | ConvertTo-Json
    $conn.Close()
} catch {
    Write-Host "Error: $_"
}

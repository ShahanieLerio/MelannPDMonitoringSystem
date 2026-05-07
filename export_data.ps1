$conn = New-Object -ComObject ADODB.Connection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\Admin\OneDrive\Documents\PRD\jcashdb\jcashdb.mdb;Jet OLEDB:Database Password=kim123;"
try {
    $conn.Open()
    
    $rs = $conn.Execute("SELECT * FROM tblLoan WHERE Status = 'Good' AND Maturity >= #2016-01-01# AND Maturity <= #2026-02-15#")
    
    $loans = @()
    while (-not $rs.EOF) {
        $loan = @{}
        for ($i = 0; $i -lt $rs.Fields.Count; $i++) {
            $val = $rs.Fields.Item($i).Value
            if ($val -is [System.DBNull]) { $val = $null }
            elseif ($val -is [System.DateTime]) { $val = $val.ToString("yyyy-MM-dd HH:mm:ss") }
            $loan[$rs.Fields.Item($i).Name] = $val
        }
        $loans += $loan
        $rs.MoveNext()
    }
    
    $loans | ConvertTo-Json -Depth 5 | Out-File -FilePath "loans.json" -Encoding utf8
    
    # Extract payments for these loans
    $payments = @()
    if ($loans.Count -gt 0) {
        # Fetching all Good payments since the IN clause might be too long if there are many loans. 
        # We can just fetch all Good payments and filter in memory, or fetch all Good payments for these loans.
        $rs2 = $conn.Execute("SELECT * FROM tblPayment WHERE Status = 'Good'")
        while (-not $rs2.EOF) {
            $payment = @{}
            for ($i = 0; $i -lt $rs2.Fields.Count; $i++) {
                $val = $rs2.Fields.Item($i).Value
                if ($val -is [System.DBNull]) { $val = $null }
                elseif ($val -is [System.DateTime]) { $val = $val.ToString("yyyy-MM-dd HH:mm:ss") }
                $payment[$rs2.Fields.Item($i).Name] = $val
            }
            $payments += $payment
            $rs2.MoveNext()
        }
    }
    
    $payments | ConvertTo-Json -Depth 5 | Out-File -FilePath "payments.json" -Encoding utf8

    Write-Host "Exported $($loans.Count) loans and $($payments.Count) payments."
    $conn.Close()
} catch {
    Write-Host "Error: $_"
}

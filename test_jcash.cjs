const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const JCASHDB_PATH = process.env.JCASHDB_PATH;
const JCASHDB_PASSWORD = process.env.JCASHDB_PASSWORD;
const psSingleQuoted = (value) => String(value).replace(/'/g, "''");

const script = `
$ErrorActionPreference = 'Stop'
$conn = New-Object -ComObject ADODB.Connection
$conn.ConnectionString = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${psSingleQuoted(JCASHDB_PATH)};Jet OLEDB:Database Password=${psSingleQuoted(JCASHDB_PASSWORD)};Mode=Read;'
function RowsToArray($rs) {
  $rows = New-Object System.Collections.ArrayList
  while (-not $rs.EOF) {
    $row = @{}
    for ($i = 0; $i -lt $rs.Fields.Count; $i++) {
      $field = $rs.Fields.Item($i)
      if ($field.Value -is [datetime]) {
        $row[$field.Name] = ([datetime]$field.Value).ToString('yyyy-MM-dd')
      } else {
        $row[$field.Name] = $field.Value
      }
    }
    [void]$rows.Add((New-Object psobject -Property $row))
    [void]$rs.MoveNext()
  }
  return $rows.ToArray()
}
$conn.Open()
$loanSql = 'SELECT * FROM tblLoan WHERE Code=3958'
$loanRs = $conn.Execute($loanSql)
$loanRows = RowsToArray -rs $loanRs
$conn.Close()
@{ loans = $loanRows } | ConvertTo-Json -Depth 8 -Compress
`;

execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], (err, stdout, stderr) => {
    if (err) console.error(stderr || err);
    else console.log(JSON.stringify(JSON.parse(stdout), null, 2));
});

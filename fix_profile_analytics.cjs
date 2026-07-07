const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const JCASHDB_PATH = process.env.JCASHDB_PATH;
const JCASHDB_PASSWORD = process.env.JCASHDB_PASSWORD;
const MIGRATION_TEMP_DIR = path.join(__dirname, 'temp_migration');

const psSingleQuoted = (value) => String(value).replace(/'/g, "''");

const createJcashSnapshotCopy = () => {
    fs.mkdirSync(MIGRATION_TEMP_DIR, { recursive: true });
    const target = path.join(MIGRATION_TEMP_DIR, `jcashdb-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mdb`);
    fs.copyFileSync(JCASHDB_PATH, target);
    return target;
};

const parseNumber = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(String(val).replace(/,/g, ''));
    return Number.isNaN(num) ? null : num;
};

const toDateOnly = (val) => {
    if (!val) return null;
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().split('T')[0];
    } catch {
        return null;
    }
};

const pick = (obj, keys, defaultVal = null) => {
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return defaultVal;
};

const readJcashCycleSnapshot = () => new Promise((resolve, reject) => {
    let snapshotPath;
    try {
        snapshotPath = createJcashSnapshotCopy();
    } catch (copyErr) {
        return reject(new Error(`Unable to create read-only scan snapshot from ${JCASHDB_PATH}: ${copyErr.message}`));
    }

    const script = `
$ErrorActionPreference = 'Stop'
$conn = New-Object -ComObject ADODB.Connection
$conn.ConnectionString = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${psSingleQuoted(snapshotPath)};Jet OLEDB:Database Password=${psSingleQuoted(JCASHDB_PASSWORD)};Mode=Read;'
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
$loanSql = 'SELECT * FROM tblLoan WHERE [Maturity] IS NOT NULL'
$loanRs = $conn.Execute($loanSql)
$loanRows = RowsToArray -rs $loanRs
$conn.Close()
@{ loans = $loanRows } | ConvertTo-Json -Depth 8 -Compress
`;

    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { maxBuffer: 1024 * 1024 * 100, timeout: 120000 }, (err, stdout, stderr) => {
        try {
            if (snapshotPath && fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath);
        } catch (cleanupErr) {}

        if (err) return reject(new Error(stderr || err.message));
        try {
            const parsed = JSON.parse(stdout || '{}');
            resolve({
                loans: Array.isArray(parsed.loans) ? parsed.loans : (parsed.loans ? [parsed.loans] : [])
            });
        } catch (parseErr) {
            reject(new Error(`Unable to parse jcashdb.mdb output: ${parseErr.message}`));
        }
    });
});

async function main() {
    console.log('Reading from JCASH...');
    const snapshot = await readJcashCycleSnapshot();
    console.log(`Found ${snapshot.loans.length} loans in JCASH.`);
    
    console.log('Fetching loans from PostgreSQL...');
    const client = await pool.connect();
    try {
        const dbLoansRes = await client.query('SELECT id, code, borrower_name FROM loans');
        const dbLoans = dbLoansRes.rows;
        console.log(`Found ${dbLoans.length} loans in PostgreSQL.`);
        
        let updateCount = 0;
        
        await client.query('BEGIN');
        
        // Map JCASH loans by LoanID
        const jcashLoanMap = new Map();
        for (const loan of snapshot.loans) {
            const loanId = String(pick(loan, ['LoanID', 'ID', 'loan_id'])).trim();
            if (loanId) {
                const totalLoan = parseNumber(pick(loan, ['Total', 'TotalLoan', 'LoanAmount']));
                const principal = parseNumber(pick(loan, ['Principal', 'PrincipalAmount', 'PrincipalLoan']));
                const dateRelease = toDateOnly(pick(loan, ['DateRelease', 'DateReleased', 'ReleaseDate']));
                
                jcashLoanMap.set(loanId, {
                    total_loan: totalLoan || null,
                    principal: principal || null,
                    date_release: dateRelease || null
                });
            }
        }
        
        for (const dbLoan of dbLoans) {
            const jcashData = jcashLoanMap.get(dbLoan.id);
            if (jcashData) {
                if (jcashData.total_loan !== null || jcashData.principal !== null || jcashData.date_release !== null) {
                    await client.query(
                        'UPDATE loans SET total_loan = $1, principal = $2, date_release = $3 WHERE id = $4',
                        [jcashData.total_loan, jcashData.principal, jcashData.date_release, dbLoan.id]
                    );
                    updateCount++;
                }
            }
        }
        
        await client.query('COMMIT');
        console.log(`Successfully updated ${updateCount} loans with profile analytics (total_loan, principal, date_release).`);
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during update:', err);
    } finally {
        client.release();
        pool.end();
    }
}

main().catch(console.error);

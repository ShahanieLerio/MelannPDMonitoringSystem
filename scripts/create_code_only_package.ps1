param(
    [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'Melann-Code-Only-Branch-Template.zip')
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$stagingPath = [IO.Path]::GetFullPath((Join-Path $projectRoot '.code-only-package-staging'))
$outputFullPath = [IO.Path]::GetFullPath($OutputPath)

if (-not $stagingPath.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Staging directory must remain inside the project.'
}
if (Test-Path -LiteralPath $stagingPath) {
    throw "Staging directory already exists: $stagingPath"
}
if (Test-Path -LiteralPath $outputFullPath) {
    throw "Output already exists: $outputFullPath"
}

$rootFiles = @(
    '.gitignore', 'App.tsx', 'constants.tsx', 'declarations.d.ts',
    'index.html', 'index.tsx', 'package.json', 'package-lock.json',
    'README.md', 'reportedAmount.cjs', 'reportingCycle.cjs',
    'schema.sql', 'server.cjs', 'setupTests.ts', 'tsconfig.json',
    'types.ts', 'vite.config.ts'
)
$sourceDirectories = @('assets', 'components', 'docs', 'hooks', 'services')
$supportFiles = @(
    'database/README.md',
    'database/company_upgrade_no_data_loss.sql',
    'scripts/create_code_only_package.ps1',
    'scripts/init_db.cjs',
    'scripts/setup_db.js',
    'scripts/validate_database_package.cjs',
    'public/favicon.jpg',
    'public/favicon.png',
    'public/favicon.svg',
    'public/LetterHead.jpg'
)

New-Item -ItemType Directory -Path $stagingPath | Out-Null
try {
    foreach ($relativePath in $rootFiles + $supportFiles) {
        $source = Join-Path $projectRoot $relativePath
        $target = Join-Path $stagingPath $relativePath
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $target
    }
    foreach ($directory in $sourceDirectories) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $directory) -Destination (Join-Path $stagingPath $directory) -Recurse
    }
    Get-ChildItem -LiteralPath $projectRoot -File |
        Where-Object { $_.Name -match '\.test\.(ts|tsx|cjs)$' -or $_.Name -eq 'example.test.ts' } |
        ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stagingPath $_.Name) }

    @'
# Code-only branch template

This archive contains application source, tests, static design assets, and database schema files. It contains no database records, client exports, uploaded collector photos, backups, or credentials.

1. Extract into a new folder and run `npm install`.
2. Create `.env.local` with a NEW, empty `DATABASE_URL` for the target branch. Add an optional `VITE_GEMINI_API_KEY` if needed.
3. Apply `schema.sql` to that new database, then run `npm.cmd run db:validate`, `npx.cmd tsc --noEmit`, `npm.cmd test -- --run`, and `npm.cmd run build`.
4. Start the backend with `npm.cmd run server` and frontend with `npm.cmd run dev`.

The backend creates the default `admin` account when the users table is empty. It does not import the original branch's records. Branch names and role choices are currently encoded in the app; update them for the target branch before rollout. The setup and login behavior should be reviewed before placing this on a shared network.
'@ | Set-Content -LiteralPath (Join-Path $stagingPath 'CODE_ONLY_SETUP.md') -Encoding UTF8

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($stagingPath, $outputFullPath, [IO.Compression.CompressionLevel]::Optimal, $false)
    Write-Output "Created $outputFullPath"
}
finally {
    if (Test-Path -LiteralPath $stagingPath) {
        Remove-Item -LiteralPath $stagingPath -Recurse -Force
    }
}

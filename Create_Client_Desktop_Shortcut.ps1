param(
    [string]$TargetBat = "$PSScriptRoot\Client_Melann_Past_Due.bat",
    [string]$IconPath = "$PSScriptRoot\assets\PDIcon.ico",
    [string]$ShortcutName = "Melann Past Due Client.lnk"
)

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop $ShortcutName
$workingDirectory = Split-Path -Parent $TargetBat

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $TargetBat
$shortcut.WorkingDirectory = $workingDirectory
$shortcut.IconLocation = "$IconPath,0"
$shortcut.Description = "Open Melann Past Due and Report Monitoring"
$shortcut.Save()

Write-Host "Created shortcut: $shortcutPath"

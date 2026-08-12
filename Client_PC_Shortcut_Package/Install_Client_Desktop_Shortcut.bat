@echo off
setlocal

set "SOURCE_DIR=%~dp0"
set "INSTALL_DIR=%LOCALAPPDATA%\Melann Past Due Shortcut"
set "APP_URL=http://192.168.254.115:3000"
set "BAT_NAME=Melann Past Due Client.bat"
set "ICO_NAME=PDIcon.ico"
set "SHORTCUT_NAME=Melann Past Due Client.lnk"
set "TARGET_BAT=%INSTALL_DIR%\%BAT_NAME%"
set "TARGET_ICO=%INSTALL_DIR%\%ICO_NAME%"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

if exist "%SOURCE_DIR%Client_Melann_Past_Due.bat" (
    copy /Y "%SOURCE_DIR%Client_Melann_Past_Due.bat" "%TARGET_BAT%" >nul
) else (
    >"%TARGET_BAT%" echo @echo off
    >>"%TARGET_BAT%" echo start "" "%APP_URL%"
)

if exist "%SOURCE_DIR%assets\%ICO_NAME%" (
    copy /Y "%SOURCE_DIR%assets\%ICO_NAME%" "%TARGET_ICO%" >nul
) else if exist "%SOURCE_DIR%%ICO_NAME%" (
    copy /Y "%SOURCE_DIR%%ICO_NAME%" "%TARGET_ICO%" >nul
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$desktop=[Environment]::GetFolderPath('Desktop'); $shortcutPath=Join-Path $desktop '%SHORTCUT_NAME%'; $shell=New-Object -ComObject WScript.Shell; $shortcut=$shell.CreateShortcut($shortcutPath); $shortcut.TargetPath='%TARGET_BAT%'; $shortcut.WorkingDirectory='%INSTALL_DIR%'; if (Test-Path '%TARGET_ICO%') { $shortcut.IconLocation='%TARGET_ICO%,0' }; $shortcut.Description='Open Melann Past Due and Report Monitoring'; $shortcut.Save(); Write-Host ('Created shortcut: ' + $shortcutPath)"

echo.
echo Desktop shortcut created: %SHORTCUT_NAME%
echo Link: %APP_URL%
pause

endlocal

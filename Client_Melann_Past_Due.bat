@echo off
setlocal

set "APP_URL=http://192.168.254.115:3000"

echo Opening Melann Past Due and Report Monitoring...
echo %APP_URL%
start "" "%APP_URL%"

endlocal

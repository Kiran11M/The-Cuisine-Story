@echo off
title The Cuisine Story - Order Server
cd /d "%~dp0"

REM When run as administrator (needed once), allow phones on the WiFi to reach port 8080.
net session >nul 2>&1
if %errorlevel%==0 (
  netsh http add urlacl url=http://+:8080/ sddl=D:^(A;;GX;;;WD^) >nul 2>&1
  netsh advfirewall firewall show rule name="Cuisine Story Orders" >nul 2>&1 || netsh advfirewall firewall add rule name="Cuisine Story Orders" dir=in action=allow protocol=TCP localport=8080 profile=private,domain >nul
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause

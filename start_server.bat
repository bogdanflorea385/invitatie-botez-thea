@echo off
REM === Opreste orice proces Python care ruleaza deja ===
taskkill /F /IM python.exe >nul 2>&1

REM === Navigheaza in folderul proiectului ===
cd /d "C:\Users\bogda\Desktop\invitatie-botez-thea\backend"

REM === Porneste serverul Flask pe portul 5050 ===
python app.py

pause

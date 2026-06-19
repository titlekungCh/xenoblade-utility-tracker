@echo off
REM Launches the Xenoblade Utility Tracker local app and opens it in your browser.
cd /d "%~dp0"
echo Starting Xenoblade Utility Tracker...
python "app\server.py"
pause

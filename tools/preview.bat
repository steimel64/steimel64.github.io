@echo off
rem Double-click on Windows to preview the site with all animations.
rem Browsers block the site's module scripts on file:// pages, so serve the repo root.
cd /d "%~dp0.."
set PORT=8064
echo Previewing at http://localhost:%PORT%  (close this window to stop)
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 1; Start-Process 'http://localhost:%PORT%/'"
python -m http.server %PORT% || py -m http.server %PORT%

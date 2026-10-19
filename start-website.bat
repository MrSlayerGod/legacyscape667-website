@echo off
cd /d "%~dp0"
title LegacyScape Atlas - RS667
cls
echo ==========================================
echo    LEGACYSCAPE ATLAS  ^|  RS667 CACHE
 echo ==========================================
echo.
echo Starting local website on http://localhost:8000/
echo Leave this window open while using the Atlas.
echo.
where java >nul 2>nul
if not errorlevel 1 (
    java -m jdk.httpserver -p 8000 -d .
    if not errorlevel 1 goto end
)
where python >nul 2>nul
if not errorlevel 1 (
    echo Trying the Python web server instead...
    python -m http.server 8000
    goto end
)
echo Unable to start. Install JDK 21 or Python 3.
echo Or upload all site files to a static web hosting service.
:end
pause

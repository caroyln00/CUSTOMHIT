@echo off
setlocal
cd /d "%~dp0"

echo Checking Node.js...
call node -v || goto :fail
call npm -v || goto :fail

echo.
echo Installing dependencies...
call npm install || goto :fail

echo.
echo Checking TypeScript...
call npm run typecheck || goto :fail

echo.
echo Running tests...
call npm test || goto :fail

echo.
echo HIT v7.56.0 checks passed.
pause
exit /b 0

:fail
echo.
echo HIT setup failed. Copy the full error before closing this window.
pause
exit /b 1

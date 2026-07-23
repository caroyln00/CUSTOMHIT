@echo off
setlocal

echo Checking Node.js and npm...
node -v
if errorlevel 1 goto :fail
call npm -v
if errorlevel 1 goto :fail

echo.
echo Installing dependencies...
call npm install
if errorlevel 1 goto :fail

echo.
echo Checking TypeScript...
call npm run typecheck
if errorlevel 1 goto :fail

echo.
echo Running tests...
call npm test
if errorlevel 1 goto :fail

echo.
echo HIT dependencies, types, and tests passed.
pause
exit /b 0

:fail
echo.
echo HIT setup failed. Copy the full error before closing this window.
pause
exit /b 1

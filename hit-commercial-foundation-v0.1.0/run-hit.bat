@echo off
setlocal
if not exist .env (
  echo ERROR: .env is missing. Copy .env.example to .env and fill it in.
  pause
  exit /b 1
)
npm start
pause

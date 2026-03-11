@echo off
echo Iniciando Codemates...

start "codemates-server" cmd /k ".venv\Scripts\activate && cd apps\server && python -m uvicorn main:app --reload"

timeout /t 2 /nobreak >nul

start "codemates-web" cmd /k "cd apps\web && npm run dev"

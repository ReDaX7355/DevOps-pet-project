@echo off
cd /d "%~dp0"

echo Starting backend on http://localhost:4000 ...
start "todo-backend" cmd /k "cd /d backend && npm start"

echo Starting frontend dev server ...
start "todo-frontend" cmd /k "cd /d frontend && npm run dev"

echo Both backend and frontend are starting in separate windows.

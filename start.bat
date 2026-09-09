@echo off
echo ==========================================================
echo  BHARAT 3D - 2D-to-3D Spatial Property Registry
echo  Smart India Hackathon Prototype (Problem #26011)
echo ==========================================================

echo [1/3] Generating datasets & seeding database...
python scripts\generate_demo_data.py
python scripts\seed_demo.py

echo.
echo [2/3] Starting backend server in separate window...
start cmd /k "cd backend && uvicorn app.main:app --reload --port 8000"

echo.
echo [3/3] Starting frontend development server...
cd frontend
npm run dev

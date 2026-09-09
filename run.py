import os
import subprocess
import sys
import time

def run():
    print("==========================================================")
    print(" 🇮🇳  BHARAT 3D: 2D-to-3D Spatial Property Registry")
    print("     Smart India Hackathon Prototype (Problem #26011)")
    print("==========================================================")

    # 1. Check/Seed Database
    print("\n[1/3] Checking demo data & database seeding...")
    subprocess.run([sys.executable, "scripts/generate_demo_data.py"], check=True)
    subprocess.run([sys.executable, "scripts/seed_demo.py"], check=True)

    print("\n[2/3] Starting FastAPI Backend on http://localhost:8000...")
    print("      API Docs: http://localhost:8000/docs")

    print("\n[3/3] Demo Credentials:")
    print("      • Surveyor:     survey@bharat3d.demo      / demo2026")
    print("      • Municipality: municipality@bharat3d.demo / demo2026")
    print("      • Utility:      utility@bharat3d.demo      / demo2026")
    print("      • Citizen:      citizen@bharat3d.demo      / demo2026")
    print("      • Admin:        admin@bharat3d.demo        / demo2026")
    print("\nTo launch backend:  cd backend && uvicorn app.main:app --reload --port 8000")
    print("To launch frontend: cd frontend && npm install && npm run dev")
    print("==========================================================")

if __name__ == "__main__":
    run()

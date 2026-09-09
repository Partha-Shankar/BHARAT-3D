import os
import subprocess

DB_PATH = "d:/Bharat 3d/backend/bharat3d.db"

if __name__ == "__main__":
    if os.path.exists(DB_PATH):
        print(f"Deleting existing database at {DB_PATH}")
        os.remove(DB_PATH)
    else:
        print("No existing database found.")
        
    print("Running seed_demo.py...")
    script_path = os.path.join(os.path.dirname(__file__), "seed_demo.py")
    subprocess.run(["python", script_path], check=True)
    print("Reset complete.")

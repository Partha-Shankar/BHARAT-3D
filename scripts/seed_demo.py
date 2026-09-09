import os
import json
import sqlite3
import bcrypt

DB_PATH = "d:/Bharat 3d/backend/bharat3d.db"
DATA_DIR = "d:/Bharat 3d/data/demo/areas/area_01"

def create_tables(conn):
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        survey_polygon TEXT,
        selected_area_id TEXT,
        dataset_version INTEGER DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS parcels (
        id TEXT PRIMARY KEY,
        ulpin TEXT,
        land_use TEXT,
        area_sqm REAL,
        geometry TEXT
    );

    CREATE TABLE IF NOT EXISTS buildings (
        id TEXT PRIMARY KEY,
        name TEXT,
        usage TEXT,
        floors INTEGER,
        basements INTEGER,
        height REAL,
        base_height REAL,
        geometry TEXT
    );

    CREATE TABLE IF NOT EXISTS floors (
        id TEXT PRIMARY KEY,
        building_id TEXT,
        floor_number INTEGER,
        name TEXT,
        area_sqm REAL,
        FOREIGN KEY(building_id) REFERENCES buildings(id)
    );

    CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        floor_id TEXT,
        building_id TEXT,
        unit_number TEXT,
        usage TEXT,
        area_sqm REAL,
        FOREIGN KEY(floor_id) REFERENCES floors(id),
        FOREIGN KEY(building_id) REFERENCES buildings(id)
    );

    CREATE TABLE IF NOT EXISTS infrastructure (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        operator TEXT,
        geometry TEXT
    );

    CREATE TABLE IF NOT EXISTS violations (
        id TEXT PRIMARY KEY,
        building_id TEXT,
        type TEXT,
        description TEXT,
        status TEXT,
        FOREIGN KEY(building_id) REFERENCES buildings(id)
    );

    CREATE TABLE IF NOT EXISTS ownership (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id TEXT,
        owner_name TEXT,
        share_percentage REAL,
        acquired_date TEXT,
        FOREIGN KEY(unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS tax_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id TEXT,
        tax_year TEXT,
        annual_tax REAL,
        status TEXT,
        FOREIGN KEY(unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS leases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id TEXT,
        tenant_name TEXT,
        start_date TEXT,
        end_date TEXT,
        rent_amount REAL,
        FOREIGN KEY(unit_id) REFERENCES units(id)
    );
    """)
    conn.commit()

def seed_users_and_projects(conn):
    c = conn.cursor()
    password = b"demo2026"
    hashed = bcrypt.hashpw(password, bcrypt.gensalt()).decode('utf-8')
    
    users = [
        ("survey@bharat3d.demo", hashed, "SURVEYOR"),
        ("municipality@bharat3d.demo", hashed, "MUNICIPALITY"),
        ("utility@bharat3d.demo", hashed, "UTILITY_OPERATOR"),
        ("citizen@bharat3d.demo", hashed, "CITIZEN"),
        ("admin@bharat3d.demo", hashed, "ADMIN")
    ]
    
    c.executemany("INSERT OR IGNORE INTO users (email, password_hash, role) VALUES (?, ?, ?)", users)
    
    projects = [
        (1, "Central Urban Zone - Ward 16 Survey", "REVIEW", "area_01", 10),
        (2, "Metro Transit Corridor Survey", "IN_PROGRESS", "area_02", 2),
        (3, "Civic Infrastructure Survey", "PLANNED", "area_03", 3)
    ]
    
    c.executemany("INSERT OR REPLACE INTO projects (id, name, status, selected_area_id, dataset_version) VALUES (?, ?, ?, ?, ?)", projects)
    conn.commit()

def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def seed_data(conn):
    c = conn.cursor()
    print("Loading data from Area 01...")
    
    parcels = load_json("parcels.geojson")
    if parcels and "features" in parcels:
        for f in parcels["features"]:
            p = f["properties"]
            c.execute("INSERT OR REPLACE INTO parcels (id, ulpin, land_use, area_sqm, geometry) VALUES (?, ?, ?, ?, ?)",
                      (p.get("id"), p.get("ulpin"), p.get("land_use"), p.get("area_sqm"), json.dumps(f["geometry"])))
                      
    buildings = load_json("buildings.geojson")
    if buildings and "features" in buildings:
        for f in buildings["features"]:
            p = f["properties"]
            c.execute("INSERT OR REPLACE INTO buildings (id, name, usage, floors, basements, height, base_height, geometry) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                      (p.get("id"), p.get("name"), p.get("building_type", p.get("usage")), p.get("total_floors", p.get("floors")), p.get("basement_floors", 0), p.get("height_meters", p.get("height")), p.get("base_height", 0.0), json.dumps(f["geometry"])))

    floors = load_json("floors.geojson")
    if floors:
        for f in floors:
            c.execute("INSERT OR REPLACE INTO floors (id, building_id, floor_number, name, area_sqm) VALUES (?, ?, ?, ?, ?)",
                      (f.get("id"), f.get("building_id"), f.get("floor_number"), f.get("floor_label", f.get("name")), f.get("area_sqm")))

    units = load_json("units.geojson")
    if units:
        for u in units:
            c.execute("INSERT OR REPLACE INTO units (id, floor_id, building_id, unit_number, usage, area_sqm) VALUES (?, ?, ?, ?, ?, ?)",
                      (u.get("id"), u.get("floor_id"), u.get("building_id"), u.get("unit_number"), u.get("property_type", u.get("usage_type")), u.get("area_sqm")))

    tunnels = load_json("tunnels.geojson")
    if tunnels and "features" in tunnels:
        for f in tunnels["features"]:
            p = f["properties"]
            c.execute("INSERT OR REPLACE INTO infrastructure (id, name, type, operator, geometry) VALUES (?, ?, ?, ?, ?)",
                      (p.get("id"), p.get("name"), p.get("asset_type", "TUNNEL"), p.get("operator"), json.dumps(f["geometry"])))

    flyovers = load_json("flyovers.geojson")
    if flyovers and "features" in flyovers:
        for f in flyovers["features"]:
            p = f["properties"]
            c.execute("INSERT OR REPLACE INTO infrastructure (id, name, type, operator, geometry) VALUES (?, ?, ?, ?, ?)",
                      (p.get("id"), p.get("name"), p.get("asset_type", "FLYOVER"), p.get("operator"), json.dumps(f["geometry"])))
                      
    violations = load_json("violations.geojson")
    if violations:
        for v in violations:
            c.execute("INSERT OR REPLACE INTO violations (id, building_id, type, description, status) VALUES (?, ?, ?, ?, ?)",
                      (v.get("id"), v.get("building_id"), v.get("violation_type", v.get("type")), v.get("excess", v.get("description")), v.get("status")))
                      
    conn.commit()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    create_tables(conn)
    seed_users_and_projects(conn)
    seed_data(conn)
    conn.close()

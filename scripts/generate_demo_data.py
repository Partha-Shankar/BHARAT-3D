import os
import json
import random
import math
import csv
from datetime import datetime, timedelta

# Constants & Directory Paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_AREAS_DIR = os.path.join(BASE_DIR, "data", "demo", "areas")
DATA_DATASET_DIR = os.path.join(BASE_DIR, "data", "demo")
PREPARED_UPLOAD_DIR = os.path.join(BASE_DIR, "prepared_upload")

# 10 Distinct Geographical Demo Areas across the Capital Urban Region
AREA_CONFIGS = [
    {"id": "area_01", "name": "Central Heights", "ward": "Ward 16", "center_lat": 28.6280, "center_lon": 77.2090, "theme": "Apartment Tower & Mall Hub with Central Subsurface Road Tunnel"},
    {"id": "area_02", "name": "Metro District", "ward": "Ward 22", "center_lat": 28.6340, "center_lon": 77.2180, "theme": "Transit Terminal, Elevated Flyover & High-Density Commercial Core"},
    {"id": "area_03", "name": "Civic Square", "ward": "Ward 08", "center_lat": 28.6220, "center_lon": 77.2250, "theme": "Metro Hub, Civic Apartment Enclave & Underground Multi-level Parking"},
    {"id": "area_04", "name": "Transit Quarter", "ward": "Ward 31", "center_lat": 28.6410, "center_lon": 77.2020, "theme": "Commercial-heavy Zone with Integrated Rail Concourse & Subterranean Utilities"},
    {"id": "area_05", "name": "Urban Heights", "ward": "Ward 14", "center_lat": 28.6180, "center_lon": 77.2140, "theme": "Residential-heavy High-Rise Condominium Sector & Arterial Flyover"},
    {"id": "area_06", "name": "Central Market Zone", "ward": "Ward 19", "center_lat": 28.6300, "center_lon": 77.2310, "theme": "Dense Commercial Market Corridor, Retail Plaza & Rail Siding"},
    {"id": "area_07", "name": "Civic Transit Zone", "ward": "Ward 05", "center_lat": 28.6250, "center_lon": 77.1950, "theme": "Underground-infrastructure-heavy Zone with Dual Metro & Road Tunnels"},
    {"id": "area_08", "name": "Integrated Urban Zone", "ward": "Ward 27", "center_lat": 28.6500, "center_lon": 77.2060, "theme": "Mixed Urban Redevelopment Zone with Elevated Skywalks & Slabs"},
    {"id": "area_09", "name": "Vertical City District", "ward": "Ward 11", "center_lat": 28.6450, "center_lon": 77.2220, "theme": "Dense Vertical Property Zone with 15-Storey Tower & Stratified Deeds"},
    {"id": "area_10", "name": "Central Urban Core", "ward": "Ward 01", "center_lat": 28.6320, "center_lon": 77.2100, "theme": "Flagship Integrated 3D Cadastral Digital Twin Zone"}
]

INDIAN_CITIZENS = [
    ("Priya Mehta", "ID-XXXX-8921", "FREEHOLD"),
    ("Rajesh Kumar Sharma", "ID-XXXX-1044", "FREEHOLD"),
    ("Anil & Sunita Verma", "ID-XXXX-3829", "JOINT"),
    ("Kavita Krishnamurthy", "ID-XXXX-7192", "FREEHOLD"),
    ("Mohammed Irfan Khan", "ID-XXXX-5510", "FREEHOLD"),
    ("Suresh Reddy", "ID-XXXX-9281", "LEASEHOLD"),
    ("Ananya Singh", "ID-XXXX-4493", "FREEHOLD"),
    ("Rohan Gupta", "ID-XXXX-6628", "FREEHOLD"),
    ("Deepak Chopra", "ID-XXXX-8102", "FREEHOLD"),
    ("Meenakshi Sundaram", "ID-XXXX-2940", "FREEHOLD"),
    ("Amitabh Banerjee", "ID-XXXX-7731", "FREEHOLD"),
    ("Pooja Hegde", "ID-XXXX-3184", "FREEHOLD"),
    ("Siddharth Malhotra", "ID-XXXX-5927", "FREEHOLD"),
    ("Neha Kapoor", "ID-XXXX-4819", "FREEHOLD")
]

TENANTS = [
    "Rohan Gupta", "Vikramaditya Rao", "Sneha Patel", "Aditya Birla Retail",
    "Apex Healthcare", "Zomato Kitchens", "Croma Digital Hub", "FabIndia Living",
    "Reliance Smart Bazaar", "Starbucks Coffee", "HDFC Bank Branch", "N/A"
]

def make_coords(base_lon, base_lat, x_meters, y_meters):
    meter_lat = 1.0 / 111111.0
    meter_lon = 1.0 / (111111.0 * math.cos(math.radians(base_lat)))
    return [round(base_lon + (x_meters * meter_lon), 8), round(base_lat + (y_meters * meter_lat), 8)]

def make_polygon_ring(base_lon, base_lat, x, y, w, h):
    c1 = make_coords(base_lon, base_lat, x, y)
    c2 = make_coords(base_lon, base_lat, x + w, y)
    c3 = make_coords(base_lon, base_lat, x + w, y + h)
    c4 = make_coords(base_lon, base_lat, x, y + h)
    return [c1, c2, c3, c4, c1]

def make_feature(geometry_type, coordinates, properties):
    return {
        "type": "Feature",
        "geometry": {
            "type": geometry_type,
            "coordinates": coordinates
        },
        "properties": properties
    }

def generate_all_areas():
    print("=" * 70)
    print("BHARAT 3D: Generating 10 Complete Prepared Urban Areas & Upload Packages")
    print("=" * 70)

    os.makedirs(DATA_AREAS_DIR, exist_ok=True)
    os.makedirs(PREPARED_UPLOAD_DIR, exist_ok=True)

    for a_idx, cfg in enumerate(AREA_CONFIGS, 1):
        area_id = cfg["id"]
        area_num = f"{a_idx:02d}"
        area_name = cfg["name"]
        ward = cfg["ward"]
        base_lat = cfg["center_lat"]
        base_lon = cfg["center_lon"]

        random.seed(42 + a_idx * 17)

        # Target directories for area data
        area_dir = os.path.join(DATA_AREAS_DIR, area_id)
        os.makedirs(area_dir, exist_ok=True)
        os.makedirs(os.path.join(area_dir, "3d"), exist_ok=True)
        os.makedirs(os.path.join(area_dir, "drone"), exist_ok=True)
        os.makedirs(os.path.join(area_dir, "floorplans"), exist_ok=True)

        # Also create backward-compatible dataset_{num} folder
        legacy_dataset_dir = os.path.join(DATA_DATASET_DIR, f"dataset_{area_num}")
        os.makedirs(legacy_dataset_dir, exist_ok=True)
        os.makedirs(os.path.join(legacy_dataset_dir, "3d"), exist_ok=True)
        os.makedirs(os.path.join(legacy_dataset_dir, "drone"), exist_ok=True)
        os.makedirs(os.path.join(legacy_dataset_dir, "floorplans"), exist_ok=True)

        # Target directory for ready-to-upload package
        pkg_dir = os.path.join(PREPARED_UPLOAD_DIR, f"survey_package_{area_num}")
        os.makedirs(pkg_dir, exist_ok=True)
        os.makedirs(os.path.join(pkg_dir, "drone"), exist_ok=True)
        os.makedirs(os.path.join(pkg_dir, "floorplans"), exist_ok=True)

        # Data collection containers
        parcels_features = []
        buildings_features = []
        floors_data = []
        floors_features = []
        units_data = []
        units_features = []
        roads_features = []
        footpaths_features = []
        tunnels_features = []
        flyovers_features = []
        utilities_features = []
        railway_features = []
        metro_features = []
        mall_features = []
        underground_parking_features = []
        violations_data = []
        violations_features = []
        scene_3d_features = []

        ownership_rows = [["unit_vprid", "owner_name", "masked_id", "ownership_type", "share_percentage", "title_deed", "effective_date"]]
        leases_rows = [["unit_vprid", "tenant_name", "lease_start", "lease_end", "monthly_rent", "status"]]
        tax_rows = [["unit_vprid", "financial_year", "usage_type", "assessed_value", "annual_tax", "amount_paid", "amount_due", "payment_status"]]

        # -------------------------------------------------------------
        # 1. 2D Parcels (36 to 48 parcels per area)
        # -------------------------------------------------------------
        num_parcels = 40 + (a_idx % 8)
        cols = 8
        rows = math.ceil(num_parcels / cols)
        parcel_ulpin_map = {}

        for p in range(1, num_parcels + 1):
            c = (p - 1) % cols
            r = (p - 1) // cols
            px = (c - (cols / 2)) * 60 + random.randint(-4, 4)
            py = (r - (rows / 2)) * 50 + random.randint(-4, 4)
            pw = 52.0
            ph = 42.0

            poly = make_polygon_ring(base_lon, base_lat, px, py, pw, ph)
            ulpin = f"IN-{area_num}-{p:04d}"
            parcel_id = f"PRC-{area_num}-{p:03d}"
            parcel_ulpin_map[p] = ulpin

            land_use = "COMMERCIAL" if p in [3, 4, 7, 12, 18, 25] else "RESIDENTIAL"
            if p in [1, 2]:
                land_use = "INFRASTRUCTURE"

            p_feat = make_feature("Polygon", [poly], {
                "id": parcel_id,
                "ulpin": ulpin,
                "ward_id": ward,
                "area_name": area_name,
                "survey_number": f"SY-{100 * a_idx + p}",
                "land_use": land_use,
                "area_sqm": round(pw * ph, 1),
                "has_3d_property": True if p in [1, 3, 4, 7, 8, 12, 14, 15, 18] else False,
                "zone": area_name
            })
            parcels_features.append(p_feat)

        # -------------------------------------------------------------
        # 2. Roads & Footpaths
        # -------------------------------------------------------------
        main_road_coords = [make_coords(base_lon, base_lat, -300, 0), make_coords(base_lon, base_lat, 300, 0)]
        cross_road_coords = [make_coords(base_lon, base_lat, 0, -250), make_coords(base_lon, base_lat, 0, 250)]
        north_road_coords = [make_coords(base_lon, base_lat, -300, 120), make_coords(base_lon, base_lat, 300, 120)]

        roads_features.append(make_feature("LineString", main_road_coords, {
            "id": f"RD-{area_num}-01", "name": f"{area_name} Main Spine Road (R-01)", "width": 24.0, "lanes": 6, "surface": "ASPHALT"
        }))
        roads_features.append(make_feature("LineString", cross_road_coords, {
            "id": f"RD-{area_num}-02", "name": f"{area_name} Cross Link Boulevard (R-02)", "width": 18.0, "lanes": 4, "surface": "ASPHALT"
        }))
        roads_features.append(make_feature("LineString", north_road_coords, {
            "id": f"RD-{area_num}-03", "name": f"{area_name} North Arterial (R-03)", "width": 16.0, "lanes": 4, "surface": "ASPHALT"
        }))

        # Footpaths alongside roads
        fp_north = [make_coords(base_lon, base_lat, -290, 13), make_coords(base_lon, base_lat, 290, 13)]
        fp_south = [make_coords(base_lon, base_lat, -290, -13), make_coords(base_lon, base_lat, 290, -13)]
        footpaths_features.append(make_feature("LineString", fp_north, {
            "id": f"FP-{area_num}-01", "name": f"{area_name} North Pedestrian Sidewalk", "width": 3.0, "pavement": "PAVER_BLOCKS"
        }))
        footpaths_features.append(make_feature("LineString", fp_south, {
            "id": f"FP-{area_num}-02", "name": f"{area_name} South Pedestrian Sidewalk", "width": 3.0, "pavement": "PAVER_BLOCKS"
        }))

        # -------------------------------------------------------------
        # 3. Core Buildings & High-Rise Structures
        # -------------------------------------------------------------
        # Building 1: Primary Residential Apartment Tower (Aarav Heights style) - 12 Floors, 4 units/floor = 48 units
        b1_x, b1_y, b1_w, b1_h = -55, 35, 38, 24
        b1_poly = make_polygon_ring(base_lon, base_lat, b1_x, b1_y, b1_w, b1_h)
        b1_id = f"BLD-{area_num}-01"
        b1_ulpin = parcel_ulpin_map[8]
        b1_floors = 12
        b1_height = 39.0

        b1_props = {
            "id": b1_id,
            "name": f"{area_name} Aarav Heights Tower",
            "ulpin": b1_ulpin,
            "building_code": b1_id,
            "building_type": "RESIDENTIAL",
            "total_floors": b1_floors,
            "basement_floors": 2,
            "height_meters": b1_height,
            "footprint_area_sqm": round(b1_w * b1_h, 1),
            "ground_elevation": 215.0,
            "color": "#2563EB",
            "has_3d": True
        }
        b1_feat = make_feature("Polygon", [b1_poly], b1_props)
        buildings_features.append(b1_feat)

        # 3D Building Base Envelope
        scene_3d_features.append(make_feature("Polygon", [b1_poly], {
            "id": b1_id, "name": b1_props["name"], "entity_type": "building",
            "height": b1_height, "base_height": 0.0, "color": "#2563EB", "floors": b1_floors, "usage": "RESIDENTIAL", "has_3d": True
        }))

        # Sliced Floors for B1 Tower
        for f in range(1, b1_floors + 1):
            floor_id = f"FLR-{b1_id}-F{f:02d}"
            base_h = (f - 1) * 3.25
            top_h = f * 3.25
            z_min = 215.0 + base_h
            z_max = 215.0 + top_h

            floor_obj = {
                "id": floor_id,
                "building_id": b1_id,
                "floor_number": f,
                "floor_label": f"Floor {f}",
                "base_height": base_h,
                "height": top_h,
                "z_min": z_min,
                "z_max": z_max,
                "area_sqm": round(b1_w * b1_h, 1),
                "units_count": 4,
                "units": []
            }

            # 4 Subdivided Units on this floor (Flat 801, 802, 803, 804 style)
            half_w = b1_w / 2.0
            half_h = b1_h / 2.0
            unit_quads = [
                (b1_x, b1_y, half_w, half_h, 1),
                (b1_x + half_w, b1_y, half_w, half_h, 2),
                (b1_x, b1_y + half_h, half_w, half_h, 3),
                (b1_x + half_w, b1_y + half_h, half_w, half_h, 4)
            ]

            for ux, uy, uw, uh, u_quad in unit_quads:
                vprid = f"VPR-{b1_id.replace('-','')}-F{f:02d}-U{u_quad:02d}"
                unit_poly = make_polygon_ring(base_lon, base_lat, ux, uy, uw, uh)
                unit_area = round(uw * uh, 1)
                unit_vol = round(unit_area * 3.25, 1)

                # Special Highlight Demo Unit: Flat 804 on Floor 8
                if f == 8 and u_quad == 4:
                    owner_name = "Priya Mehta"
                    masked_id = "ID-XXXX-8921"
                    tenant_name = "Rohan Gupta"
                    lease_status = "ACTIVE"
                    tax_val = 18400
                    payment_status = "PAID"
                    unit_type = "RESIDENTIAL"
                    occupancy = "LEASED"
                elif f == 12 and u_quad in [1, 2]: # Penthouse Duplex
                    owner_name = "Kavita Krishnamurthy"
                    masked_id = "ID-XXXX-7192"
                    tenant_name = "N/A"
                    lease_status = "VACANT"
                    tax_val = 32000
                    payment_status = "PAID"
                    unit_type = "DUPLEX_PENTHOUSE"
                    occupancy = "OWNER_OCCUPIED"
                else:
                    citizen = INDIAN_CITIZENS[(f * 4 + u_quad) % len(INDIAN_CITIZENS)]
                    owner_name = citizen[0]
                    masked_id = citizen[1]
                    tenant_name = TENANTS[(f + u_quad) % len(TENANTS)]
                    lease_status = "ACTIVE" if tenant_name != "N/A" else "VACANT"
                    tax_val = int(unit_area * 160)
                    payment_status = "PAID" if (f + u_quad) % 5 != 0 else "PENDING"
                    unit_type = "RESIDENTIAL"
                    occupancy = "LEASED" if tenant_name != "N/A" else "OWNER_OCCUPIED"

                u_obj = {
                    "id": f"UNT-{vprid}",
                    "vprid": vprid,
                    "unit_number": f"Flat {f}0{u_quad}",
                    "property_type": unit_type,
                    "usage_type": "RESIDENTIAL",
                    "floor_number": f,
                    "floor_id": floor_id,
                    "building_id": b1_id,
                    "ulpin": b1_ulpin,
                    "carpet_area_sqm": round(unit_area * 0.82, 1),
                    "built_up_area_sqm": unit_area,
                    "area_sqm": unit_area,
                    "volume_cum": unit_vol,
                    "z_min": z_min,
                    "z_max": z_max,
                    "base_height": base_h,
                    "height": top_h,
                    "owner_name": owner_name,
                    "masked_id": masked_id,
                    "occupancy_status": occupancy,
                    "tenant_name": tenant_name,
                    "lease_status": lease_status,
                    "annual_tax": tax_val,
                    "payment_status": payment_status,
                    "compliance_status": "COMPLIANT",
                    "title_deed": f"DEED-DL-2024-{1000 + f * 10 + u_quad}"
                }
                floor_obj["units"].append(u_obj)
                units_data.append(u_obj)

                # Add individual Unit Polygon to 3D scene
                scene_3d_features.append(make_feature("Polygon", [unit_poly], {
                    "id": u_obj["id"],
                    "vprid": vprid,
                    "name": f"{area_name} • {u_obj['unit_number']}",
                    "entity_type": "unit",
                    "building_id": b1_id,
                    "floor_number": f,
                    "base_height": base_h,
                    "height": top_h,
                    "color": "#F59E0B" if (f == 8 and u_quad == 4) else ("#3B82F6" if f % 2 == 0 else "#2563EB"),
                    "owner_name": owner_name,
                    "tenant_name": tenant_name,
                    "annual_tax": tax_val,
                    "has_3d": True
                }))

                ownership_rows.append([vprid, owner_name, masked_id, "FREEHOLD", 100, u_obj["title_deed"], "2024-04-15"])
                leases_rows.append([vprid, tenant_name, "2025-01-01", "2026-12-31", 38000, lease_status])
                tax_rows.append([vprid, "2026-27", "RESIDENTIAL", tax_val * 10, tax_val, tax_val if payment_status == "PAID" else 0, 0 if payment_status == "PAID" else tax_val, payment_status])

            floors_data.append(floor_obj)
            floors_features.append(make_feature("Polygon", [b1_poly], {
                "id": floor_id,
                "building_id": b1_id,
                "floor_number": f,
                "name": f"Floor {f}",
                "base_height": base_h,
                "height": top_h,
                "color": "#F59E0B" if f == 8 else ("#2563EB" if f % 2 == 0 else "#1D4ED8"),
                "entity_type": "floor"
            }))

        # Building 2: Secondary Residential Condominium (Sunrise / Horizon) - 5 Floors
        b2_x, b2_y, b2_w, b2_h = -120, -60, 30, 20
        b2_poly = make_polygon_ring(base_lon, base_lat, b2_x, b2_y, b2_w, b2_h)
        b2_id = f"BLD-{area_num}-02"
        b2_ulpin = parcel_ulpin_map[14]
        b2_floors = 5
        b2_height = 15.0

        b2_props = {
            "id": b2_id, "name": f"{area_name} Residency Block B", "ulpin": b2_ulpin,
            "building_code": b2_id, "building_type": "RESIDENTIAL", "total_floors": b2_floors,
            "basement_floors": 0, "height_meters": b2_height, "footprint_area_sqm": b2_w * b2_h,
            "ground_elevation": 215.0, "color": "#3B82F6", "has_3d": True
        }
        buildings_features.append(make_feature("Polygon", [b2_poly], b2_props))
        scene_3d_features.append(make_feature("Polygon", [b2_poly], {
            "id": b2_id, "name": b2_props["name"], "entity_type": "building",
            "height": b2_height, "base_height": 0.0, "color": "#3B82F6", "floors": b2_floors, "usage": "RESIDENTIAL", "has_3d": True
        }))

        for f in range(1, b2_floors + 1):
            floor_id = f"FLR-{b2_id}-F{f:02d}"
            base_h = (f - 1) * 3.0
            top_h = f * 3.0
            for u in range(1, 3):
                vprid = f"VPR-{b2_id.replace('-','')}-F{f:02d}-U{u:02d}"
                units_data.append({
                    "id": f"UNT-{vprid}", "vprid": vprid, "unit_number": f"Unit {f}0{u}",
                    "property_type": "RESIDENTIAL", "usage_type": "RESIDENTIAL", "floor_number": f,
                    "floor_id": floor_id, "building_id": b2_id, "ulpin": b2_ulpin,
                    "area_sqm": (b2_w * b2_h) / 2.0, "volume_cum": ((b2_w * b2_h) / 2.0) * 3.0,
                    "base_height": base_h, "height": top_h, "compliance_status": "COMPLIANT"
                })
                ownership_rows.append([vprid, INDIAN_CITIZENS[(f*2+u)%len(INDIAN_CITIZENS)][0], "ID-XXXX-4411", "FREEHOLD", 100, f"DEED-DL-2023-{500+f*2+u}", "2023-01-10"])
                leases_rows.append([vprid, "N/A", "2024-01-01", "2025-12-31", 24000, "VACANT"])
                tax_rows.append([vprid, "2026-27", "RESIDENTIAL", 95000, 9500, 9500, 0, "PAID"])

        # -------------------------------------------------------------
        # 4. Commercial Mall & Leased Retail Stores (Civic Grand Mall)
        # -------------------------------------------------------------
        mall_x, mall_y, mall_w, mall_h = 45, 25, 65, 45
        mall_poly = make_polygon_ring(base_lon, base_lat, mall_x, mall_y, mall_w, mall_h)
        mall_id = f"BLD-{area_num}-03"
        mall_ulpin = parcel_ulpin_map[3]
        mall_floors = 4
        mall_height = 18.5

        mall_props = {
            "id": mall_id, "name": f"{area_name} Civic Grand Mall & Retail Hub", "ulpin": mall_ulpin,
            "building_code": mall_id, "building_type": "COMMERCIAL", "total_floors": mall_floors,
            "basement_floors": 2, "height_meters": mall_height, "footprint_area_sqm": mall_w * mall_h,
            "ground_elevation": 215.0, "color": "#F59E0B", "has_3d": True
        }
        mall_feat = make_feature("Polygon", [mall_poly], mall_props)
        buildings_features.append(mall_feat)
        mall_features.append(mall_feat)

        scene_3d_features.append(make_feature("Polygon", [mall_poly], {
            "id": mall_id, "name": mall_props["name"], "entity_type": "mall",
            "height": mall_height, "base_height": 0.0, "color": "#F59E0B", "floors": mall_floors, "usage": "COMMERCIAL", "has_3d": True
        }))

        # Mall Commercial Stores Breakdown across 4 Levels
        mall_store_configs = [
            (1, 1, "Store S-101 (Anchor Hypermarket)", "Apex Retail Supermarket", "ACTIVE", 1200.0, 145000),
            (1, 2, "Store S-102 (Electronics Hub)", "Croma Digital Store", "ACTIVE", 450.0, 65000),
            (2, 1, "Store S-201 (Fashion Apparel)", "FabIndia Living", "ACTIVE", 320.0, 48000),
            (2, 2, "Store S-202 (Footwear Outlet)", "Bata India Ltd", "EXPIRED", 210.0, 32000),
            (2, 3, "Store S-203 (Vacant Retail Unit)", "N/A", "VACANT", 180.0, 0),
            (3, 1, "Store S-301 (Food Court Zone A)", "Haldiram Express", "ACTIVE", 400.0, 85000),
            (3, 2, "Store S-302 (Specialty Coffee Cafe)", "Starbucks Coffee", "ACTIVE", 160.0, 52000),
            (4, 1, "Store S-401 (4-Screen Multiplex)", "PVR INOX Cinemas", "ACTIVE", 1800.0, 260000)
        ]

        for flr, s_idx, store_name, tenant_name, l_status, carpet_area, monthly_rent in mall_store_configs:
            vprid = f"VPR-{mall_id.replace('-','')}-F{flr:02d}-S{s_idx:02d}"
            tax_val = int(carpet_area * 180)
            u_obj = {
                "id": f"UNT-{vprid}",
                "vprid": vprid,
                "unit_number": store_name,
                "property_type": "COMMERCIAL_RETAIL",
                "usage_type": "COMMERCIAL",
                "floor_number": flr,
                "floor_id": f"FLR-{mall_id}-F{flr:02d}",
                "building_id": mall_id,
                "ulpin": mall_ulpin,
                "carpet_area_sqm": carpet_area,
                "built_up_area_sqm": round(carpet_area * 1.15, 1),
                "area_sqm": carpet_area,
                "volume_cum": round(carpet_area * 4.6, 1),
                "base_height": (flr - 1) * 4.6,
                "height": flr * 4.6,
                "owner_name": f"{area_name} Mall Real Estate Trust",
                "masked_id": "ID-CORP-9081",
                "occupancy_status": "LEASED" if tenant_name != "N/A" else "VACANT",
                "tenant_name": tenant_name,
                "lease_status": l_status,
                "annual_tax": tax_val,
                "payment_status": "PAID" if l_status == "ACTIVE" else "PENDING",
                "compliance_status": "COMPLIANT",
                "title_deed": f"COMM-DEED-2022-{s_idx * 100 + flr}"
            }
            units_data.append(u_obj)
            ownership_rows.append([vprid, f"{area_name} Mall Management Ltd", "ID-CORP-9081", "COMMERCIAL_LEASE", 100, u_obj["title_deed"], "2022-06-01"])
            leases_rows.append([vprid, tenant_name, "2024-01-01", "2027-12-31", monthly_rent, l_status])
            tax_rows.append([vprid, "2026-27", "COMMERCIAL", tax_val * 12, tax_val, tax_val, 0, "PAID"])

        # -------------------------------------------------------------
        # 5. Railway Station & Elevated Metro Infrastructure
        # -------------------------------------------------------------
        rail_x, rail_y, rail_w, rail_h = 130, 95, 80, 32
        rail_poly = make_polygon_ring(base_lon, base_lat, rail_x, rail_y, rail_w, rail_h)
        rail_id = f"BLD-{area_num}-04"
        rail_feat = make_feature("Polygon", [rail_poly], {
            "id": rail_id, "name": f"{area_name} Central Junction Railway Terminal", "ulpin": parcel_ulpin_map[1],
            "building_code": rail_id, "building_type": "INFRASTRUCTURE", "total_floors": 2,
            "height_meters": 12.0, "operator": "Northern Railways", "status": "OPERATIONAL", "has_3d": True
        })
        buildings_features.append(rail_feat)
        railway_features.append(rail_feat)
        scene_3d_features.append(make_feature("Polygon", [rail_poly], {
            "id": rail_id, "name": rail_feat["properties"]["name"], "entity_type": "building",
            "height": 12.0, "base_height": 0.0, "color": "#0D9488", "floors": 2, "usage": "COMMERCIAL", "has_3d": True
        }))

        # Metro Station & Elevated Concourse
        metro_x, metro_y, metro_w, metro_h = -60, 115, 45, 22
        metro_poly = make_polygon_ring(base_lon, base_lat, metro_x, metro_y, metro_w, metro_h)
        metro_id = f"BLD-{area_num}-05"
        metro_feat = make_feature("Polygon", [metro_poly], {
            "id": metro_id, "name": f"{area_name} Metro Interchange Station (Elevated +6m)", "ulpin": parcel_ulpin_map[2],
            "building_code": metro_id, "building_type": "INFRASTRUCTURE", "total_floors": 2,
            "height_meters": 14.0, "base_height": 6.0, "operator": "DMRC", "status": "OPERATIONAL", "has_3d": True
        })
        buildings_features.append(metro_feat)
        metro_features.append(metro_feat)
        scene_3d_features.append(make_feature("Polygon", [metro_poly], {
            "id": metro_id, "name": metro_feat["properties"]["name"], "entity_type": "building",
            "height": 14.0, "base_height": 6.0, "color": "#7C3AED", "floors": 2, "usage": "INFRASTRUCTURE", "has_3d": True
        }))

        # -------------------------------------------------------------
        # 6. Elevated Flyover (FLY-001) with Real Solid Piers
        # -------------------------------------------------------------
        fly_poly = make_polygon_ring(base_lon, base_lat, -180, -5, 340, 14)
        fly_id = f"FLY-{area_num}-01"
        fly_feat = make_feature("Polygon", [fly_poly], {
            "id": fly_id,
            "name": f"{area_name} Elevated Bypass Flyover (Deck: +8.5m)",
            "asset_type": "FLYOVER",
            "elevation_meters": 8.5,
            "length_meters": 340,
            "width_meters": 14.0,
            "operator": "PWD Delhi / NHAI",
            "status": "OPERATIONAL",
            "associated_road": f"RD-{area_num}-01"
        })
        flyovers_features.append(fly_feat)

        # Elevated Deck Mesh (+8.5m to +10.7m)
        scene_3d_features.append(make_feature("Polygon", [fly_poly], {
            "id": fly_id,
            "name": fly_feat["properties"]["name"],
            "entity_type": "flyover",
            "height": 10.7,
            "base_height": 8.5,
            "color": "#EA580C",
            "usage": "INFRASTRUCTURE",
            "has_3d": True
        }))

        # 6 Solid Support Pier Columns (0.0m ground up to +8.5m deck)
        for p in range(6):
            px = -160 + (p * 60)
            pier_poly = make_polygon_ring(base_lon, base_lat, px - 2, 0, 4, 4)
            scene_3d_features.append(make_feature("Polygon", [pier_poly], {
                "id": f"FLY-PIER-{area_num}-0{p + 1}",
                "name": f"{area_name} Flyover Concrete Pier P-{p + 1}",
                "entity_type": "infrastructure",
                "height": 8.5,
                "base_height": 0.0,
                "color": "#78350F",
                "usage": "INFRASTRUCTURE",
                "has_3d": True
            }))

        # -------------------------------------------------------------
        # 7. Subsurface Tunnels & Underground Parking
        # -------------------------------------------------------------
        # Subsurface Road Tunnel (-8.5m MSL)
        tnl1_poly = make_polygon_ring(base_lon, base_lat, -70, -22, 280, 12)
        tnl1_id = f"TNL-{area_num}-01"
        tnl1_feat = make_feature("Polygon", [tnl1_poly], {
            "id": tnl1_id,
            "name": f"{area_name} Subsurface Vehicular Tunnel (Depth: -8.5m)",
            "asset_type": "TUNNEL",
            "depth_meters": 8.5,
            "length_meters": 280,
            "width_meters": 12.0,
            "operator": "PWD Delhi",
            "status": "OPERATIONAL",
            "associated_parcels": f"PRC-{area_num}-012 to PRC-{area_num}-024"
        })
        tunnels_features.append(tnl1_feat)
        scene_3d_features.append(make_feature("Polygon", [tnl1_poly], {
            "id": tnl1_id, "name": tnl1_feat["properties"]["name"], "entity_type": "tunnel",
            "height": 4.8, "base_height": 0.2, "depth_meters": 8.5, "color": "#0891B2", "usage": "SUBTERRANEAN_ROAD", "has_3d": True
        }))

        # Subsurface Metro Transit Tunnel (-14.2m MSL)
        tnl2_poly = make_polygon_ring(base_lon, base_lat, -120, 125, 380, 10)
        tnl2_id = f"TNL-{area_num}-02"
        tnl2_feat = make_feature("Polygon", [tnl2_poly], {
            "id": tnl2_id,
            "name": f"{area_name} Yellow Line Metro Rail Tunnel (Depth: -14.2m)",
            "asset_type": "TUNNEL",
            "depth_meters": 14.2,
            "length_meters": 380,
            "width_meters": 10.0,
            "operator": "DMRC",
            "status": "OPERATIONAL",
            "associated_parcels": f"PRC-{area_num}-001 to PRC-{area_num}-008"
        })
        tunnels_features.append(tnl2_feat)
        scene_3d_features.append(make_feature("Polygon", [tnl2_poly], {
            "id": tnl2_id, "name": tnl2_feat["properties"]["name"], "entity_type": "tunnel",
            "height": 5.6, "base_height": 0.2, "depth_meters": 14.2, "color": "#06B6D4", "usage": "SUBTERRANEAN_METRO", "has_3d": True
        }))

        # Multi-Level Underground Parking below Mall (-6.0m MSL)
        pkg_poly = make_polygon_ring(base_lon, base_lat, mall_x + 2, mall_y + 2, mall_w - 4, mall_h - 4)
        pkg_id = f"PKG-{area_num}-01"
        pkg_feat = make_feature("Polygon", [pkg_poly], {
            "id": pkg_id,
            "name": f"{area_name} Mall 2-Level Basement Parking (Depth: -6.0m)",
            "asset_type": "UNDERGROUND_PARKING",
            "depth_meters": 6.0,
            "levels": 2,
            "capacity_bays": 350,
            "operator": f"{area_name} Mall Ltd",
            "parent_building": mall_id
        })
        underground_parking_features.append(pkg_feat)
        scene_3d_features.append(make_feature("Polygon", [pkg_poly], {
            "id": pkg_id, "name": pkg_feat["properties"]["name"], "entity_type": "tunnel",
            "height": 3.8, "base_height": 0.2, "depth_meters": 6.0, "color": "#0284C7", "usage": "SUBTERRANEAN_PARKING", "has_3d": True
        }))

        # -------------------------------------------------------------
        # 8. Subsurface Utility Networks (Lines & Corridors)
        # -------------------------------------------------------------
        util1_coords = [make_coords(base_lon, base_lat, -280, -10), make_coords(base_lon, base_lat, 280, -10)]
        util2_coords = [make_coords(base_lon, base_lat, -280, 10), make_coords(base_lon, base_lat, 280, 10)]
        util3_coords = [make_coords(base_lon, base_lat, 0, -220), make_coords(base_lon, base_lat, 0, 220)]

        utilities_features.append(make_feature("LineString", util1_coords, {
            "id": f"UTL-{area_num}-TEL-01", "name": "BSNL 96-Core High-Speed Optical Fiber Trunk", "asset_type": "TELECOM", "depth_meters": 1.4, "operator": "BSNL"
        }))
        utilities_features.append(make_feature("LineString", util2_coords, {
            "id": f"UTL-{area_num}-WTR-01", "name": "Municipal 400mm Ductile Iron Water Trunk Main", "asset_type": "WATER", "depth_meters": 1.8, "operator": "DJB"
        }))
        utilities_features.append(make_feature("LineString", util3_coords, {
            "id": f"UTL-{area_num}-PWR-01", "name": "BSES Rajdhani 11kV Underground Power Feeder", "asset_type": "ELECTRICITY", "depth_meters": 2.2, "operator": "BSES"
        }))

        # -------------------------------------------------------------
        # 9. Physically Modeled Violations (Illegal Floors, Setback, Footpath)
        # -------------------------------------------------------------
        # Sharma Commercial Plaza (Sanctioned G+4, Observed G+6 -> 2 Extra Floors in Red)
        sharma_x, sharma_y, sharma_w, sharma_h = 80, -85, 24, 22
        sharma_poly = make_polygon_ring(base_lon, base_lat, sharma_x, sharma_y, sharma_w, sharma_h)
        sharma_id = f"BLD-{area_num}-07"

        buildings_features.append(make_feature("Polygon", [sharma_poly], {
            "id": sharma_id, "name": f"{area_name} Sharma Commercial Plaza", "ulpin": parcel_ulpin_map[18],
            "building_code": sharma_id, "building_type": "COMMERCIAL", "total_floors": 6, "sanctioned_floors": 4,
            "height_meters": 21.2, "color": "#DC2626", "status": "VIOLATION_FLAGGED", "has_3d": True
        }))

        # Sanctioned Lower Portion (0.0m to 14.0m)
        scene_3d_features.append(make_feature("Polygon", [sharma_poly], {
            "id": sharma_id, "name": f"{area_name} Sharma Plaza (Sanctioned G+4)", "entity_type": "building",
            "height": 14.0, "base_height": 0.0, "color": "#64748B", "floors": 4, "usage": "COMMERCIAL", "has_3d": True
        }))

        # Illegal Floors 5 & 6 (14.0m to 21.2m) highlighted in Warning RED
        scene_3d_features.append(make_feature("Polygon", [sharma_poly], {
            "id": f"{sharma_id}-ILLEGAL-FLOORS",
            "name": f"{area_name} Sharma Plaza (UNAUTHORIZED Floors 5 & 6)",
            "entity_type": "violation",
            "height": 21.2,
            "base_height": 14.0,
            "color": "#DC2626",
            "floors": 2,
            "usage": "VIOLATION",
            "violation_code": "VLT-001",
            "status": "OPEN_NOTICE_ISSUED",
            "has_3d": True
        }))

        # Footpath Encroachment Shop (Mehta Complex encroaching 18.6 sqm of public sidewalk)
        fp_enc_x, fp_enc_y, fp_enc_w, fp_enc_h = 10, 10, 8, 5
        fp_enc_poly = make_polygon_ring(base_lon, base_lat, fp_enc_x, fp_enc_y, fp_enc_w, fp_enc_h)
        scene_3d_features.append(make_feature("Polygon", [fp_enc_poly], {
            "id": f"VLT-{area_num}-ENC-01",
            "name": f"{area_name} Commercial Footpath Encroachment (18.6 m²)",
            "entity_type": "violation",
            "height": 3.5,
            "base_height": 0.0,
            "color": "#EF4444",
            "usage": "VIOLATION",
            "violation_code": "VLT-003",
            "status": "OPEN_NOTICE_ISSUED",
            "has_3d": True
        }))

        violations_data = [
            {
                "id": f"VLT-{area_num}-001",
                "violation_code": "VLT-001",
                "building_id": sharma_id,
                "name": f"{area_name} Sharma Commercial Plaza",
                "violation_type": "UNAUTHORIZED_EXTRA_FLOORS",
                "severity": "CRITICAL",
                "sanctioned_value": "G + 4 (14.0m)",
                "observed_value": "G + 6 (21.2m)",
                "excess": "2 Unauthorized Upper Floors (7.2m vertical excess)",
                "rule_reference": "Unified Building Bye-Laws (UBBL 2016) Cl. 4.2",
                "penalty_amount": 84000,
                "status": "OPEN_NOTICE_ISSUED"
            },
            {
                "id": f"VLT-{area_num}-002",
                "violation_code": "VLT-002",
                "building_id": sharma_id,
                "name": f"{area_name} Sharma Commercial Plaza",
                "violation_type": "FRONT_SETBACK_BREACH",
                "severity": "HIGH",
                "sanctioned_value": "6.0 meters required",
                "observed_value": "3.8 meters observed",
                "excess": "2.2 meters front setback breach into ROW buffer",
                "rule_reference": "Master Plan Zonal Regulations Cl. 7",
                "penalty_amount": 25000,
                "status": "OPEN_NOTICE_ISSUED"
            },
            {
                "id": f"VLT-{area_num}-003",
                "violation_code": "VLT-003",
                "building_id": f"BLD-{area_num}-08",
                "name": f"{area_name} Retail Complex Sidewalk Encroachment",
                "violation_type": "FOOTPATH_ENCROACHMENT",
                "severity": "MEDIUM",
                "sanctioned_value": "0.0 m² public ROW",
                "observed_value": "18.6 m² occupied",
                "excess": "18.6 m² public sidewalk encroachment",
                "rule_reference": "Municipal Road Encroachment Act Sec. 32",
                "penalty_amount": 15000,
                "status": "UNDER_REVIEW"
            },
            {
                "id": f"VLT-{area_num}-004",
                "violation_code": "VLT-004",
                "building_id": b1_id,
                "name": f"{area_name} Aarav Heights Rooftop Structure",
                "violation_type": "ILLEGAL_ROOFTOP_STRUCTURE",
                "severity": "LOW",
                "sanctioned_value": "Open Terrace Only",
                "observed_value": "42 m² tin shed coverage",
                "excess": "42 m² unapproved terrace coverage",
                "rule_reference": "Fire Safety Bye-Laws Sec. 9",
                "penalty_amount": 10000,
                "status": "COMPOUNDABLE"
            }
        ]

        # -------------------------------------------------------------
        # 10. Additional Surrounding Urban Cadastral Buildings (12 to 16 buildings)
        # -------------------------------------------------------------
        for b_i in range(8, 20):
            bx = ((b_i % 4) - 2) * 90 + random.randint(-10, 10)
            by = ((b_i // 4) - 2) * 80 + random.randint(-10, 10)
            bw = random.randint(20, 32)
            bh = random.randint(18, 26)
            b_poly = make_polygon_ring(base_lon, base_lat, bx, by, bw, bh)
            b_floors = random.choice([3, 4, 5, 6, 8])
            b_h = round(b_floors * 3.2, 1)
            b_id = f"BLD-{area_num}-{b_i:02d}"
            b_ulpin = parcel_ulpin_map[b_i + 15]

            b_feat = make_feature("Polygon", [b_poly], {
                "id": b_id, "name": f"{area_name} Urban Property #{b_i}", "ulpin": b_ulpin,
                "building_code": b_id, "building_type": "RESIDENTIAL" if b_i % 3 != 0 else "COMMERCIAL",
                "total_floors": b_floors, "height_meters": b_h, "footprint_area_sqm": bw * bh,
                "ground_elevation": 215.0, "color": "#3B82F6" if b_i % 3 != 0 else "#F59E0B", "has_3d": True
            })
            buildings_features.append(b_feat)
            scene_3d_features.append(make_feature("Polygon", [b_poly], {
                "id": b_id, "name": b_feat["properties"]["name"], "entity_type": "building",
                "height": b_h, "base_height": 0.0, "color": b_feat["properties"]["color"],
                "floors": b_floors, "usage": b_feat["properties"]["building_type"], "has_3d": True
            }))

            for f in range(1, b_floors + 1):
                floor_id = f"FLR-{b_id}-F{f:02d}"
                for u in range(1, 3):
                    vprid = f"VPR-{b_id.replace('-','')}-F{f:02d}-U{u:02d}"
                    u_area = (bw * bh) / 2.0
                    units_data.append({
                        "id": f"UNT-{vprid}", "vprid": vprid, "unit_number": f"Unit {f}0{u}",
                        "property_type": "RESIDENTIAL", "usage_type": "RESIDENTIAL",
                        "floor_number": f, "floor_id": floor_id, "building_id": b_id, "ulpin": b_ulpin,
                        "area_sqm": u_area, "volume_cum": u_area * 3.2,
                        "base_height": (f - 1) * 3.2, "height": f * 3.2, "compliance_status": "COMPLIANT"
                    })
                    ownership_rows.append([vprid, INDIAN_CITIZENS[(b_i+f+u)%len(INDIAN_CITIZENS)][0], f"ID-XXXX-{random.randint(1000,9999)}", "FREEHOLD", 100, f"DEED-DL-2024-{random.randint(1000,9999)}", "2024-03-01"])
                    leases_rows.append([vprid, "N/A", "2025-01-01", "2026-12-31", 28000, "VACANT"])
                    tax_rows.append([vprid, "2026-27", "RESIDENTIAL", 120000, 12000, 12000, 0, "PAID"])

        # -------------------------------------------------------------
        # 11. Metrics & Metadata
        # -------------------------------------------------------------
        metrics = {
            "area_id": area_id,
            "area_name": area_name,
            "ward": ward,
            "parcels_count": len(parcels_features),
            "buildings_detected": len(buildings_features),
            "floors_inferred": len(floors_data) + 60,
            "vertical_units": len(units_data),
            "infrastructure_assets": len(tunnels_features) + len(flyovers_features) + len(utilities_features) + len(underground_parking_features),
            "violations_detected": len(violations_data),
            "analysis_confidence": round(0.94 + (a_idx % 5) * 0.01, 3),
            "topology_score": round(0.985 + (a_idx % 3) * 0.004, 3),
            "crs_normalized": "EPSG:4326 / UTM 43N",
            "center": [base_lon, base_lat]
        }

        metadata = {
            "area_id": area_id,
            "area_name": area_name,
            "ward_number": ward,
            "theme": cfg["theme"],
            "version": "v3.0",
            "center": [base_lon, base_lat],
            "bounding_box": [base_lon - 0.005, base_lat - 0.005, base_lon + 0.005, base_lat + 0.005],
            "crs": "EPSG:4326",
            "created_at": (datetime.now() - timedelta(days=(10 - a_idx))).isoformat(),
            "files_count": 24
        }

        # -------------------------------------------------------------
        # 12. Write All GeoJSON, CSV & Scene files to disk
        # -------------------------------------------------------------
        def write_all_to(target_directory):
            os.makedirs(target_directory, exist_ok=True)
            os.makedirs(os.path.join(target_directory, "3d"), exist_ok=True)
            os.makedirs(os.path.join(target_directory, "drone"), exist_ok=True)
            os.makedirs(os.path.join(target_directory, "floorplans"), exist_ok=True)
            with open(os.path.join(target_directory, "parcels.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": parcels_features}, f, indent=2)

            with open(os.path.join(target_directory, "roads.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": roads_features}, f, indent=2)

            with open(os.path.join(target_directory, "footpaths.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": footpaths_features}, f, indent=2)

            with open(os.path.join(target_directory, "buildings.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": buildings_features}, f, indent=2)

            with open(os.path.join(target_directory, "floors.geojson"), "w", encoding="utf-8") as f:
                json.dump(floors_data, f, indent=2)

            with open(os.path.join(target_directory, "units.geojson"), "w", encoding="utf-8") as f:
                json.dump(units_data, f, indent=2)

            with open(os.path.join(target_directory, "mall.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": mall_features}, f, indent=2)

            with open(os.path.join(target_directory, "railway.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": railway_features}, f, indent=2)

            with open(os.path.join(target_directory, "metro.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": metro_features}, f, indent=2)

            with open(os.path.join(target_directory, "flyovers.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": flyovers_features}, f, indent=2)

            with open(os.path.join(target_directory, "tunnels.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": tunnels_features}, f, indent=2)

            with open(os.path.join(target_directory, "underground_parking.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": underground_parking_features}, f, indent=2)

            with open(os.path.join(target_directory, "utilities.geojson"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": utilities_features}, f, indent=2)

            with open(os.path.join(target_directory, "violations.geojson"), "w", encoding="utf-8") as f:
                json.dump(violations_data, f, indent=2)

            with open(os.path.join(target_directory, "3d_data.json"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": scene_3d_features}, f, indent=2)

            with open(os.path.join(target_directory, "3d", "3d_data.json"), "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": scene_3d_features}, f, indent=2)

            # CSVs
            for filename, rows in [("ownership.csv", ownership_rows), ("leases.csv", leases_rows), ("tax.csv", tax_rows)]:
                with open(os.path.join(target_directory, filename), "w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerows(rows)

            # Registries
            with open(os.path.join(target_directory, "metrics.json"), "w", encoding="utf-8") as f:
                json.dump(metrics, f, indent=2)
            with open(os.path.join(target_directory, "metadata.json"), "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2)

            # Binary sensor files (.las, .tif, .dxf)
            with open(os.path.join(target_directory, "lidar.las"), "wb") as f:
                f.write(b"LASF\x01\x04" + b"\x00" * 1024)
            with open(os.path.join(target_directory, "dem.tif"), "wb") as f:
                f.write(b"II*\x00\x08\x00\x00\x00" + b"\x00" * 512)
            with open(os.path.join(target_directory, "dsm.tif"), "wb") as f:
                f.write(b"II*\x00\x08\x00\x00\x00" + b"\x00" * 512)
            with open(os.path.join(target_directory, "drone", "orthomosaic.tif"), "wb") as f:
                f.write(b"II*\x00\x08\x00\x00\x00" + b"\x00" * 1024)
            with open(os.path.join(target_directory, "drone", "survey.jpg"), "wb") as f:
                f.write(b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"\x00" * 256)
            with open(os.path.join(target_directory, "floorplans", "apartment_floors.dxf"), "w", encoding="utf-8") as f:
                f.write("0\nSECTION\n2\nENTITIES\n0\nPOLYLINE\n0\nENDSEC\n0\nEOF\n")
            with open(os.path.join(target_directory, "floorplans", "mall_retail.dxf"), "w", encoding="utf-8") as f:
                f.write("0\nSECTION\n2\nENTITIES\n0\nPOLYLINE\n0\nENDSEC\n0\nEOF\n")

        # Write to area_dir, legacy dataset_dir, and prepared_upload pkg_dir
        write_all_to(area_dir)
        write_all_to(legacy_dataset_dir)
        write_all_to(pkg_dir)

        print(f"[OK] Area {area_num} ({area_name}): {metrics['buildings_detected']} Buildings, {metrics['vertical_units']} Units, {metrics['infrastructure_assets']} Infra Assets -> {area_dir}")

    print("=" * 70)
    print("SUCCESS: 10 Complete Prepared Urban Areas & 10 Upload Packages Generated.")
    print("=" * 70)

if __name__ == "__main__":
    generate_all_areas()

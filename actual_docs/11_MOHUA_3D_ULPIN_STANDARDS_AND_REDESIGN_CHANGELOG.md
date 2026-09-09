# BHARAT 3D: MoHUA 3D ULPIN Standards & Digital Twin Locality Redesign

**Standard Reference:** Ministry of Housing and Urban Affairs (MoHUA) Standard B3D-STD-2026-ULPIN-01 / ISO 19152 Land Administration Domain Model (LADM)
**Document Classification:** Technical Architecture & Compliance Specification

---

## 1. Executive Summary & Interaction Model Overhaul

To align with national digital cadastre directives and provide a realistic digital twin experience for the Smart India Hackathon (SIH), the spatial interface is strictly decoupled into two distinct viewports:

`	ext
+-------------------------------------------------------------+
|                     2D Cadastre Map Page                    |
|  - Minimalist GIS map (Roads, Parcels, Footpaths)           |
|  - ONLY ONE unified big 3D polygon area covering the zone   |
|  - Clean CTA: 'CLICK TO OPEN 3D WORLD ->'                   |
+-------------------------------------------------------------+
                              |
                              | [Direct User Navigation]
                              v
+-------------------------------------------------------------+
|                 Dedicated Full 3D Digital Twin              |
|  - Realistic procedural satellite orthophoto terrain        |
|  - Real curved flyovers & curved multi-lane roads           |
|  - Full residential & commercial locality fabric            |
|  - Multi-unit floor subdivisions with individual flats      |
|  - Multi-level underground basement parking                 |
|  - Subterranean metro & railway transit with 360 deg orbit  |
|  - Sub-surface utility networks (water, electric, telecom)  |
|  - Clickable sidewalks/footpaths with Right-of-Way metadata |
|  - Clean Sidebar-only inspection card (No center HUD cards) |
+-------------------------------------------------------------+
`

---

## 2. National 3D ULPIN (VPRID) vs 2D Base ULPIN Standards

Under standard B3D-STD-2026-ULPIN-01 and ISO 19152 LADM, property identifiers are deterministically assigned based on vertical stratification and legal freehold tenure:

`
3D ULPIN Structure (VPRID):
[ISO]-[State]-[District]-[2D Base ULPIN]-[Building]-[Floor]-[Unit]-[Usage]
Example: IN-DL-01-849201-B01-F08-U804-R
`

### 2.1. Statutory Allocation Matrix

| Asset Category | Entity Name | Type | Assigned ULPIN / VPRID | Vertical Elevation / Extent | Statutory Justification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Multi-Story Residential** | Aarav Heights (Flat 804) | 3D ULPIN | IN-DL-01-849201-B01-F08-U804-R | +24.0m to +27.0m | Vertically stratified individual condominium apartment unit. |
| **Multi-Story Residential** | Nilgiri Heights | 3D ULPIN | IN-DL-01-849202-B02-F06-U602-R | +18.0m to +21.0m | High-rise residential tower with distinct unit titles. |
| **Multi-Story Residential** | Shivalik Residency | 3D ULPIN | IN-DL-01-849204-B03-F05-U501-R | +15.0m to +18.0m | Mid-rise apartment complex with stratified ownership. |
| **Commercial Retail** | Civic Center Mall | 3D ULPIN | IN-DL-01-849203-B04-F01-S102-C | +0.0m to +5.0m | Stratified retail commercial showroom unit. |
| **Freehold Plotted Villa** | Gulmohar Villa 01 | **2D Base ULPIN** | IN-DL-01-849210-VIL-01 | Ground to Sky (Freehold) | Retains base 2D ULPIN under unified freehold tenure (ad coelum doctrine). No 3D ULPIN created. |
| **Freehold Plotted Villa** | Gulmohar Villa 02 | **2D Base ULPIN** | IN-DL-01-849210-VIL-02 | Ground to Sky (Freehold) | Individual plot ownership from center of earth to sky. |
| **Elevated Infrastructure** | Central Elevated Flyover | 3D ULPIN | INF-FLY-DL01-0004 | +8.5m to +10.7m | Elevated Right-of-Way (RoW) above municipal ground parcel. |
| **Subterranean Rail** | Central Metro Tunnel & Station | 3D ULPIN | INF-TUN-DL01-0012 | -14.2m to -10.0m | Subterranean transit corridor and subterranean platform. |
| **Subterranean Rail** | Regional Railway Subsurface Line | 3D ULPIN | INF-RLW-DL01-0088 | -18.5m to -14.5m | Deep subterranean regional rail easement. |
| **Sub-surface Parking** | Civic Center 2-Level Basement | 3D ULPIN | INF-BSM-849201-B02 | -7.0m to -1.0m | Multi-level underground parking parcel attached to commercial hub. |
| **Sub-surface Utilities** | Water Main Trunk Line | 3D ULPIN | INF-UTL-WAT-DL01-1042| -3.2m | Sub-surface municipal utility easement buffer. |
| **Sub-surface Utilities** | Power & Telecom Duct Bank | 3D ULPIN | INF-UTL-PWR-DL01-2091| -1.8m | Underground power transmission & optical fiber duct. |
| **Pedestrian Sidewalk** | Ring Road Pedestrian Footpath | 3D ULPIN | INF-ROW-DL01-FP01 | +0.0m to +0.2m | Municipal pedestrian right-of-way corridor. |
| **Institutional / Health** | City Multi-Specialty Hospital | Unified 3D Asset | INF-HSP-DL01-0001 | +0.0m to +24.0m | **Negative Invariant**: Hospital wards/ICUs do NOT receive individual 3D ULPINs. |
| **Unauthorized Violation** | Sharma Plaza (Floors 5 & 6) | Violation 3D ULPIN | IN-DL-01-849205-B07-F05-UNAUTHORIZED | +15.0m to +21.0m | Illegal vertical airspace encroachment beyond sanctioned G+4 limit. |

---

## 3. 3D Locality Environment Features

### 3.1. 2D Map Experience
- Renders **only one single master polygon** covering the entire locality/ward survey boundary with a distinct orange outline and clean cyan tint.
- A prominent central call-to-action button allows direct navigation to the dedicated 3D viewer.

### 3.2. Realistic Curved Geometry
- **Curved Elevated Flyovers**: Constructed using quadratic 3D Bezier curve mathematics (QuadraticBezierCurve3) with support pier columns situated outside building parcels.
- **Curved Urban Road Network**: Curving dual-carriageway arterial avenues with road markings, lane dividers, zebra crossings, and curbs.

### 3.3. Micro-Level Floor and House Subdivision
- Multi-floor apartment buildings feature multi-unit partitioning per floor (e.g. Unit A U-1, Unit B U-2, Unit C U-3, Unit D U-4).
- Each unit renders distinct wall layouts, room subdivisions, balconies, window panes, and interior entrance portals.

### 3.4. Complete 360 deg Underground Spherical Navigation
- Camera orbit controls permit unrestricted azimuthal and polar rotation (minPolarAngle: 0, maxPolarAngle: Math.PI).
- Users can orbit beneath the ground plane (Z < 0) with semi-transparent procedural terrain, exposing the underground metro station, regional railway tunnel, multi-level basement parking, and utility pipelines.

### 3.5. Procedural Satellite Ortho-Texture
- The ground terrain incorporates a high-fidelity procedural satellite canvas texture combining vegetation, urban parcel boundaries, footpaths, asphalt transitions, and subtle noise to emulate high-resolution aerial imagery.

### 3.6. Clean Sidebar Inspector UI
- All property title details, 2D/3D ULPIN breakdowns, spatial coordinates, ownership data, structural clearance metrics, and tax statuses are rendered strictly inside the collapsible floating right sidebar upon clicking any 3D asset.
- The center viewport remains unobstructed for optimal spatial awareness and digital twin immersion.

### 3.7. Custom Survey Boundary Geometry Fidelity
- The 2D Cadastre page renders the **exact polygon shape and georeferenced location** delineated or selected by the user in Step 1 (Area Delineation).
- The centroid is dynamically computed to anchor the 'CLICK TO OPEN 3D WORLD ->' CTA marker and center camera framing precisely over the user's survey boundary.


### 3.8. Simplified Area Delineation & 10 3D Map Combinations
- **Clean Map Starting State**: Removed pre-delineated zone buttons and pre-existing shapes. The survey delineation map starts completely clean and open.
- **Direct Box Drawing Interaction**: Users can simply click & drag across the 2D map to draw a custom rectangular bounding box.
- **Dynamic Area Extent Card**: The calculation card and confirmation CTA only appear dynamically after a box is delineated.
- **Single Delete / Redraw Action**: Only a clean trash/delete button is retained for clearing and redrawing the survey boundary.
- **10 Database 3D Locality Combinations & Randomizer**: When confirming the survey boundary, the system stores the exact drawn bounding box and assigns one of 10 distinct 3D digital twin world combinations (from high-density residential towers and metro interchanges to commercial arcade sectors and eco-districts).


### 3.9. Multi-Modal Data Ingestion & 10 Package File Repositories
- **Disk Package Structure Generated**: Created 10 structured survey packages in \d:/Bharat 3d/data/survey_packages/survey_package_01\ through \survey_package_10\.
- **Subfolder Sensor Taxonomy**:
  - \lidar/\: ASPRS Classified LiDAR point clouds (\.las\, \.laz\, \.json\).
  - \drone_imagery/\: High-resolution RGB orthomosaics (\.tif\, \.csv\, \.xml\).
  - \loorplans_bim/\: BIM models and CAD floorplates (\.dxf\, \.ifc\, \.dwg\).
  - \cadastre_gis/\: 2D Cadastral boundary shapefiles and GeoJSONs (\.geojson\, \.shp\, \.gpkg\).
  - \gnss_cors/\: Ground control reference points and RINEX files (\.csv\, \.rnx\, \.txt\).
  - \levation_dem_dsm/\: Gridded DSM and DTM elevation rasters (\.tif\).
  - \legal_revenue_deeds/\: Sub-Registrar ownership deeds and tax rolls (\.csv\, \.json\).
- **Simulated Upload & Receiving Stream**: The ingestion portal UI features live upload simulation with progress indicators, transfer rates (42.8 MB/s), SHA-256 integrity digests, and CRS quarantine verification.
- **Directory Tree View**: Built-in tab allows switching between categorized cards and the interactive folder tree view.


### 3.10. Dedicated Drag-and-Drop Sensor Ingestion Blocks
- **Dedicated Modality Blocks**: Clean individual upload cards for Drone Imagery, LiDAR Point Clouds, BIM Floor Plans, 2D Cadastre, GNSS CORS, DEM/DSM Elevation Rasters, and Title Deeds with supported extensions shown in brackets (e.g. (.las, .laz), (.tif, .tiff)).
- **Interactive Drag & Drop / File Browser**: Supports native dragging of local files or click-to-browse file picker for each modality.
- **Client-Side Simulation Pipeline**: Dynamically captures user-provided file names and file sizes, simulating real-time progress bars (0% -> 100%), SHA-256 geodetic hashing, and CRS validation without network blocking.
- **Gated Analysis Execution**: The primary **START MULTI-MODAL 3D ANALYSIS** CTA activates with an amber glow once all 7 datasets are uploaded and verified.


### 3.11. Minimalist & Clean Data Ingestion Interface
- **Clutter-Free Visual Design**: Removed technical debug noise, SHA-256 strings, and complex subfolder paths from the UI.
- **Simplified Status Terminology**: Changed status labels from 'Quarantined' to a clean, user-friendly 'Uploaded ✓'.
- **Ultra-Clean Card Blocks**: Each sensor modality features a clean title, extension hint in brackets (e.g. (.tif, .jpg)), and a minimalist dropzone.
- **Instant Interactive Upload**: Users can drag & drop any file or click to browse. The system simulates a smooth progress bar and transitions to 'Uploaded' with file details.
- **Single Master CTA**: Gated 'START 3D ANALYSIS' button activates with an amber glow once all datasets are uploaded.

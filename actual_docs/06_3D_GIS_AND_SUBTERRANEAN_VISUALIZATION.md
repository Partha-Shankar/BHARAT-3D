# BHARAT 3D: 3D GIS & Subterranean Visualization Engine

## 1. MapLibre GL JS 2D Cadastral Zone Layer

BHARAT 3D adopts a clean separation of concerns between 2D base cadastral maps and 3D digital twins:
- **Single Master 3D Cadastral Zone**: The 2D map renders a single unified boundary polygon enclosing the ward/locality boundary with a bold amber/orange outline (#ea580c) and subtle blue tint (#0284c7, opacity 0.16).
- **Interactive Call-to-Action**: A central interactive badge directs the surveyor or citizen directly into the high-performance 3D Digital Twin Viewer.

---

## 2. Dedicated 3D Digital Twin Locality Engine (Three.js WebGL)

The dedicated 3D viewer renders a complete, realistic urban locality built with Three.js:

### 2.1. Realistic Curved Geometry
- **Curved Elevated Flyovers**: Modeled via 3D quadratic Bezier curves (QuadraticBezierCurve3) with concrete deck slabs, guardrails, and vertical pier columns spaced along the curve without obstructing ground buildings.
- **Curved Road Network**: Dual-carriageway arterial avenues with road curbs, painted lane markings, zebra crossings, and intersecting pathways.

### 2.2. Multi-Unit Floor and House Subdivision
- Multi-floor apartment towers (Aarav Heights, Nilgiri Heights, Shivalik Residency) feature individual unit partitions (Flats 101, 102, 103, 104...) per floor.
- Each flat renders interior divider walls, window frames, balconies, and entry doors.

### 2.3. High-Fidelity Satellite Ortho-Texture Terrain
- Dynamic procedural ground canvas with multi-layered grass fields, asphalt roads, parcel lot lines, and high-frequency noise approximating satellite/aerial photogrammetry.

### 2.4. 360-Degree Spherical Orbit Controls
- Orbital controls configured with unrestricted polar rotation (minPolarAngle: 0, maxPolarAngle: Math.PI), enabling complete inspection of subterranean transit and foundations from below ground ( < 0$).

---

## 3. Subterranean & Underground Infrastructure Mechanics

Subterranean assets are rendered in true negative Z-space beneath the semi-transparent ground plane:
1. **Subterranean Metro Transit & Station Platform**: $-14.2m$ MSL with tunnel tubes, station platforms, and escalators.
2. **Subsurface Regional Railway Line**: $-18.5m$ MSL deep-tunnel rail corridor.
3. **Multi-Level Underground Basement Parking**: $-7.0m$ to $-1.0m$ MSL multi-story subterranean vehicle parking attached to the commercial civic mall.
4. **Subterranean Utility Networks**: Water mains ($-3.2m$), power transmission and optical fiber ducts ($-1.8m$).
5. **Right-of-Way Sidewalks**: Interactive pedestrian footpaths with municipal Right-of-Way (RoW) metadata.

---

## 4. Non-Intrusive Right-Sidebar Inspector UI

- When an object is clicked in the 3D scene (building, flat, flyover, metro tunnel, basement parking, utility line, or sidewalk), all cadastral metadata, 3D/2D ULPIN codes, ownership, tax, and spatial coordinates populate exclusively inside the collapsible right sidebar.
- The center viewport remains 100% clean and unobstructed.
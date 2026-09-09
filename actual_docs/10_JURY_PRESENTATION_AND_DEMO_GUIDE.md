# BHARAT 3D: 5-Minute Hackathon Jury Demonstration Script

## 1. Persona Credentials Summary

All personas share the password: **`demo2026`**

| Role | Email | Password | Primary Demo Screen |
| :--- | :--- | :--- | :--- |
| **Surveyor** | `survey@bharat3d.demo` | `demo2026` | `/surveyor/map` & `/surveyor/editor` |
| **Municipality** | `municipality@bharat3d.demo` | `demo2026` | `/municipality/violations` |
| **Utility Operator** | `utility@bharat3d.demo` | `demo2026` | `/utility/permits` |
| **Citizen** | `citizen@bharat3d.demo` | `demo2026` | `/citizen` |

---

## 2. Minute-by-Minute Demonstration Flow

### Minute 1: The Core Problem & Philosophy
- **Action**: Open `http://localhost:5173/login`, click **"1-Click Demo: Surveyor"**.
- **Speech**: *"Honorable judges, traditional land registries are flat 2D maps. But modern Indian cities exist in 3D. Our core principle is: Keep India's 2D ULPIN system as the foundation, and add a 3D volumetric layer only where vertical property exists."*

### Minute 2: 3D Cadastral Viewport & Subterranean X-Ray
- **Action**: Go to `/surveyor/map`. Toggle **`3D Volumetric`**, then toggle **`🚇 Underground`**.
- **Speech**: *"Notice how our map renders 12 discrete stacked floors for Aarav Heights, the elevated flyover at +8.5m, and the Yellow Line Metro Tunnel deep at -14.2m MSL. In underground mode, surface land turns transparent so subterranean infrastructure is crystal clear."*

### Minute 3: 3D BIM Floor Exploder & Editor
- **Action**: Click **"3D BIM Floor Exploder"**. Drag the explode slider to 35%, orbit the building in 3D, and click Floor 8. Then go to `/surveyor/editor` and click **"Add Floor"**.
- **Speech**: *"Surveyors can explode high-rises to inspect unit-level volumetric cadastre in 3D, add floors, and certify 884 legal VPRIDs."*

### Minute 4: Municipality Town Planning & Violation Detection
- **Action**: Switch persona to **Municipality** (`/municipality/violations`). Focus on Sharma Commercial Plaza.
- **Speech**: *"Our system automatically catches vertical violations. Sharma Plaza was approved for G+4, but our LiDAR survey measured G+6. The 2 unauthorized upper floors are flagged in red, with automatic municipal notice generation and tax recalculation."*

### Minute 5: Utility Excavation & Citizen Property Portal
- **Action**: Switch to **Utility** (`/utility/permits`) and run a clash check. Then switch to **Citizen** (`/citizen`) to show Flat 804 3D deed.
- **Speech**: *"Utility operators prevent underground cable and metro strikes using 3D buffer clash detection, and citizens can view their exact 3D property boundaries, volume in cubic meters, and digital title deeds. This is BHARAT 3D: India's spatial digital twin."*

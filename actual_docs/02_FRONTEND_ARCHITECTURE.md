# BHARAT 3D: Frontend Architecture & UI Component Design

## 1. Overview & Technology Stack

The BHARAT 3D frontend is built as a single-page application (SPA) optimized for government geospatial professionals, municipal town planners, utility engineers, and citizens.

- **Core Framework:** React 18.3.1
- **Build Tool:** Vite 5.3.1 (Sub-second HMR, optimized production rollup chunks)
- **Language:** TypeScript 5.4.5 (Strict type-checking across all schemas)
- **Styling:** TailwindCSS 3.4.4 + Lucide React Icons
- **State Management:** Zustand 4.5.2
- **Data Fetching:** Axios + TanStack React Query v5
- **Mapping & 3D:** MapLibre GL JS 4.3.2 + Three.js

---

## 2. Directory Structure

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── Header.tsx           # Global persona switcher, connection HUD, notifications
│   │   ├── Sidebar.tsx          # Dynamic role-based navigation links
│   │   └── MainLayout.tsx       # Standard shell container
│   ├── map/
│   │   ├── Map2D.tsx            # High-performance MapLibre 3D GIS viewport
│   │   └── Map3D.tsx            # Three.js 3D Exploded BIM Floor & Subsurface Viewer
│   └── ui/
│       ├── Button.tsx           # Standardized button variants (primary, accent, outline, danger)
│       ├── Card.tsx             # Surface containers with subtle borders & elevation
│       └── Badge.tsx            # Status pills (Sanctioned, Violation, Certified, Leased)
├── lib/
│   ├── api.ts                  # Axios client configured with base URL and JWT interceptor
│   └── auth.ts                 # Local storage token and user session persistence
├── stores/
│   ├── appStore.ts             # Global map mode, active project ID, selected entity
│   └── authStore.ts            # Authenticated user persona, permissions, login/logout
└── pages/
    ├── auth/LoginPage.tsx       # Role-based 1-click persona login
    ├── surveyor/                # Surveyor workflow pages (Area, Upload, Processing, Map, Editor)
    ├── municipality/            # Municipality dashboards (Violations, Approvals, Notices)
    ├── utility/                 # Utility operator (Excavation Clash Detector, NOC Generator)
    └── citizen/                 # Citizen property deed portal & tax payments
```

---

## 3. Global State Management (Zustand)

The application maintains two primary Zustand stores:

### 3.1. `authStore.ts`
Manages the active persona authentication session. Supports 4 personas:
- `surveyor` (`survey@bharat3d.demo` / `demo2026`)
- `municipality` (`municipality@bharat3d.demo` / `demo2026`)
- `utility` (`utility@bharat3d.demo` / `demo2026`)
- `citizen` (`citizen@bharat3d.demo` / `demo2026`)

### 3.2. `appStore.ts`
Manages global GIS viewport modes and active selections:
- `mapMode`: `'2d' | '3d' | 'underground' | 'hybrid'`
- `selectedProjectId`: Default `'proj-001'`
- `selectedEntity`: Active building, floor, or subterranean asset metadata.

---

## 4. UI Design System & Government-Grade Aesthetics

1. **Color Palette**:
   - Deep Navy Slate (`bg-slate-900`, `bg-slate-950`): High-contrast dark backgrounds for 3D map HUDs and BIM viewports.
   - Government Blue (`#2563EB` / `#1D4ED8`): Compliant residential towers (Aarav Heights).
   - Commercial Indigo (`#4F46E5`): Commercial properties (Civic Grand Mall).
   - Subterranean Cyan (`#06B6D4`): Underground metro tunnels and subsurface infrastructure.
   - Infrastructure Orange (`#EA580C`): Elevated flyover decks.
   - Warning Red (`#DC2626`): Unsanctioned extra floors and critical municipal violations.
2. **Typography & HUDs**:
   - Monospace numeric telemetry: Live pitch/yaw degrees (`65° Pitch • -25° Yaw`), exact MSL elevations (`+39.0m MSL`, `-14.2m BGL`), and ULPIN hashes.

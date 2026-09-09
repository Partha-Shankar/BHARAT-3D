# BHARAT 3D: 3D GIS & Subterranean Visualization Engine

## 1. MapLibre GL JS 3D Extrusion Engine

BHARAT 3D uses **MapLibre GL JS** with GPU-accelerated `fill-extrusion` layers to render true 3D volumetric structures directly in the browser canvas.

### 1.1. Dynamic Extrusion Properties
```javascript
map.addLayer({
  id: 'cadastre-buildings-3d',
  type: 'fill-extrusion',
  source: 'cadastre-3d-data',
  paint: {
    'fill-extrusion-color': [
      'case',
      ['==', ['get', 'entity_type'], 'violation'], '#DC2626', // Red violation
      ['==', ['get', 'entity_type'], 'tunnel'],    '#06B6D4', // Cyan tunnel
      ['==', ['get', 'entity_type'], 'flyover'],   '#EA580C', // Orange flyover
      ['coalesce', ['get', 'color'], '#2563EB']
    ],
    'fill-extrusion-height': ['coalesce', ['get', 'height'], 15.0],
    'fill-extrusion-base':   ['coalesce', ['get', 'base_height'], 0.0],
    'fill-extrusion-opacity': 0.90
  }
});
```

---

## 2. Subterranean & Underground Mode Mechanics

Standard GIS platforms clamp $Z < 0$ elevations to the ground surface. BHARAT 3D implements a custom **Subterranean X-Ray Mode**:
1. When switching to **`Underground` Mode**:
   - The surface imagery opacity drops to **12%** (`raster-opacity: 0.12`).
   - The background canvas shifts to a deep navy blueprint grid (`#0b1120`).
   - Subterranean assets (Yellow Line Metro Tunnel at $-14.2\text{ m}$, Road Tunnel at $-8.5\text{ m}$, Mall 2-Level Basement Parking at $-6.0\text{ m}$) are rendered with glowing cyan/neon extrusion channels.
   - The camera eases smoothly to **$68^\circ$ pitch** and **$38^\circ$ bearing** for optimal subterranean perspective.

---

## 3. Elevated Infrastructure Deck (Flyover FLY-001)

The Central Urban Elevated Flyover is rendered floating above the ground plane:
- **Base Height (`base_height`)**: $+8.5\text{ m}$ MSL
- **Top Height (`height`)**: $+10.7\text{ m}$ MSL
- **Support Pillars**: Solid concrete pier columns rendered at $100\text{ m}$ intervals extending from $0.0\text{ m}$ ground level to the $+8.5\text{ m}$ deck underside.

---

## 4. Three.js 3D BIM Floor Exploder Viewer

For micro-level inspection of individual high-rise apartments, BHARAT 3D embeds a custom **Three.js WebGL BIM Viewer**:
- **360° Mouse Orbit Controls**: Drag to rotate in 3D orbit space.
- **Explode Slider (0% to 100%)**: Dynamically translates each floor slab along the $Y$-axis:
  $$\Delta Y_f = (f - 1) \times (1.1 + k_{\text{explode}} \times 2.2)$$
- **Interactive Floor Highlighting**: Clicking any floor highlights the slab in amber gold, reveals unit divider partitions, and displays the exact subterranean metro clearance distance below the building's foundation ($14.2\text{ m}$ vertical clearance, 0 structural clashes).

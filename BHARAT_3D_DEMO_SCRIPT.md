# BHARAT 3D — Recording Demo Script

**Live app:** https://bharat-3d.pages.dev/  
**Context:** Smart India Hackathon PS 26011 — 3D ULPIN Generation and Vertical Property Mapping System.  
**Spoken target:** **5:20–5:45** at ~140 wpm (**~740–800 words**; hard cap **840 words**). Video may run up to **6:00** with map and 3D pauses.  
**Ward on screen:** **Central Heights, Ward 16** (`area_01`, center ~77.2090° E, 28.6280° N). **Never say Ashok Nagar** — not in the UI.

---

## 1. Timestamped recording plan

| Time | Speaker | On screen | Action |
|------|---------|-----------|--------|
| 0:00 | Anupama | **Project opening** at `/` — BHARAT 3D, “A 3D land registry for Indian cities” | Open the project. Slow scroll. |
| 0:15 | Anupama | **How the 3D extension works** — four steps, identity table | Scroll to extension content. Pause on Parent parcel, Flat 804, Basement, Metro segment. |
| 0:55 | Anupama | **What the registry checks in 3D** — five items | Scroll through all five titles and body copy. |
| 1:40 | Anupama | **Sign in** — `survey@bharat3d.demo` | **Open a workspace** or **Sign in**. Choose **Surveyor** if shown. Email on screen; password **silent**. Submit. |
| 1:52 | Anupama | `/surveyor/dashboard` — **Surveyor cadastre studio** | Confirm **Rajesh Kumar**, **SURVEYOR**. KPI row if visible. Ignore **Loading** on projects. Do not show **Analysis Confidence** bars. |
| 2:02 | Anupama | **Create 3D Cadastral Survey Project** | **New Survey Project**. **Central Urban Zone - Ward 16 Survey**, **Ward 16**, **Central Urban Zone**. **Create & Select Area**. |
| 2:12 | Anupama | **Select Survey Area** — **Step 1 of 4 • Delineation** | Draw survey box; wait for OSM tiles. **CONFIRM SURVEY BOUNDARY & UPLOAD DATA**. |
| 2:26 | Anupama | **Upload Survey Data** — **Central Heights Survey Zone (Ward 16)** | Point to modality cards. Optional **Upload All Files**. **Do not** click **START 3D ANALYSIS**. |
| 2:40 | Anupama | **3D Cadastral Survey Projects** | **Open 3D Cadastre**. Use `area_id=area_01` in URL if needed. |
| 2:48 | Anupama | **Central Heights (Ward 16) • 2D Cadastral Base Map**, **Active Cadastre** | Wait for tiles. Confirm boundary. **CLICK TO OPEN 3D WORLD →** or **ENTER 3D MINI-CITY WORLD**. |
| 3:02 | Partha | 3D world — **Central Heights (Ward 16)**, **AREA_01 • 360° Orbit** | Orbit. Click **Aarav Heights Tower A** (`BLD-01-01`). |
| 3:18 | Partha | Inspector — floor **8**, unit **4**, **Flat 804** | VPRID, carpet, volume, UDS. Say **a different owner**; do not read owner name. |
| 3:36 | Partha | **Sharma Commercial Plaza** — 3D inspector only | Height, red floors, footpath, setback. No **Bylaw Violations** sidebar route. |
| 3:52 | Partha | **Yellow Line** metro — **INF-TUN-DL01-0012** | Depth **14.2 m**. No partnership claim. |
| 4:05 | Partha | 3D view (voice continues) | ULPIN / VPRID / ISO 19152; fusion; AI; compliance; trench design; stack; **designed to** backend. |
| 5:14 | Anupama | 3D world or BHARAT 3D title | Close. Hold two seconds. Stop. |

**Exclude from recording:** 45-second processing timer, editor, registry generation, persona switch after sign-in, excavation page.

---

## 2. Complete spoken script

### 0:00–1:32 — Project opening and registry rules (Anupama)

**Anupama (0:00):** We open BHARAT 3D, the registry for Smart India Hackathon problem statement 26011. It extends India’s cadastre into three dimensions. Live at bharat-3d.pages.dev.

**Anupama (0:12):** The fourteen-digit ULPIN on the ground stays the parent. Child identities cover flats, basements, air-rights, and metro segments, with height in metres, after surveyor confirmation.

**Anupama (0:22):** **How the 3D extension works:** keep the ground ULPIN; give each owned volume a child identity with parent, level, and unit; store the height range in metres; confirm before save. The table shows parent parcel, Flat eight-oh-four, basement, and metro segment on one parcel.

**Anupama (0:40):** **What the registry checks in 3D** uses that same record. **Unauthorized extra floors and height** compares sanction to measured height and floors, so excess volume is ready for municipal enforcement. **Footpath and setback encroachment** records measurable overlap where a structure crosses the footpath or a mandatory side setback.

**Anupama (0:54):** **Excavation clash and dig-safe planning** is designed to check a proposed trench against registered tunnels and utilities before dig. We do not open that workflow here.

**Anupama (1:02):** **One ground ULPIN, child volumes where it matters** keeps one surface parent. **Surveyor confirmation before the record is saved** means fusion may propose geometry, but the registry waits for surveyor sign-off.

### 1:34–2:58 — Surveyor workflow and two-D cadastre (Anupama)

**Anupama (1:34):** I sign in as surveyor and open the surveyor workspace. Email on screen. Password typed silently.

**Anupama (1:40):** I am Rajesh Kumar, **SURVEYOR**, on **Surveyor cadastre studio**. The cards show one thirty-four parcels, sixty-four buildings, eight eighty-four volumetric units, fifty-two infrastructure assets, and eighteen bylaw flags.

**Anupama (1:52):** I create **Central Urban Zone - Ward 16 Survey**, **Ward 16**, **Central Urban Zone**, then **Create & Select Area**.

**Anupama (2:02):** I draw the survey boundary on the two-D map and click **CONFIRM SURVEY BOUNDARY & UPLOAD DATA**.

**Anupama (2:10):** **Upload Survey Data** shows **Central Heights Survey Zone (Ward 16)**. The modality cards match what fusion is designed to ingest. The platform is designed to take drone imagery, LiDAR, GIS, CAD, GNSS, elevation, ownership, and tax into one ward model. I skip **START 3D ANALYSIS**.

**Anupama (2:24):** I choose **Open 3D Cadastre** for this project.

**Anupama (2:30):** **Central Heights (Ward 16) • 2D Cadastral Base Map**, **Active Cadastre**. I wait for tiles, confirm the boundary, then **CLICK TO OPEN 3D WORLD**, or **ENTER 3D MINI-CITY WORLD**. **Central Heights**, ward sixteen, area zero-one.

### 3:00–5:12 — Three-D ward and architecture (Partha)

**Partha (3:00):** I stay as surveyor. **Central Heights (Ward 16)**, **AREA_01 • 360° Orbit**.

**Partha (3:08):** **Aarav Heights Tower A**, **BLD-01-01**, parent **IN-DL-01-849201**, twelve floors. Floor eight, unit four: **Flat 804**.

**Partha (3:18):** Carpet one hundred eight point five square metres. Volume three hundred forty-seven point two cubic metres. Undivided share two point zero eight three percent, one of forty-eight. VPRID **IN-DL-01-849201-B01-F08-U804-R**. The unit shows an owner on screen — a different owner from surveyor Rajesh Kumar.

**Partha (3:34):** **Sharma Commercial Plaza** in the three-D inspector only. Sanctioned **G plus four at fourteen point five metres** versus **G plus six at twenty-two point eight metres**. Floors five and six in red. Footpath overlap three point five metres. Setback two point one metres against three point zero required.

**Partha (3:50):** **Yellow Line** metro, asset **INF-TUN-DL01-0012**, depth fourteen point two metres. Registered infrastructure only — no metro-agency partnership.

**Partha (3:58):** ULPIN is the parent. VPRID is the volumetric child. ISO nineteen one fifty-two separates the spatial unit from rights on it.

**Partha (4:06):** Fusion is designed to bring drone imagery, LiDAR, GIS, CAD, GNSS, elevation, ownership, and tax into one ward model. AI is designed to propose geometry; the surveyor certifies before it becomes a record. No accuracy number.

**Partha (4:18):** Compliance is deterministic on height, setback, and footpath. Excavation safety is designed to test a trench against underground buffers — design only: two metre trench, fibre at one point four metres, four hundred millimetre water main at one point eight metres, twelve point two metres metro clearance. We do not show that page.

**Partha (4:34):** This project uses React eighteen, TypeScript, Vite, FastAPI, role-based access, and JWT. Public app on Cloudflare Pages. API on Render.

**Partha (4:44):** It is designed to run on PostGIS, object storage, a job queue, OGC three-D Tiles, EPSG four three two six, metric UTM, and models such as YOLOv11-seg, PointNet++, and a project reconstruction network — not all claimed on the live site today.

### 5:14–5:34 — Close (Anupama)

**Anupama (5:14):** BHARAT 3D gives one ground identity, plus a volume only where the city rises or goes underground. The surveyor certifies. The municipality can read the breach. Utility work can be planned against what is below. The citizen can see the unit that belongs to them. ULPIN stays the legal parent. VPRID is added only where there is height or depth. Thank you.

---

## 3. Recording checklist

- [ ] Browser 100% zoom; single tab; mic check; ~140 wpm.
- [ ] Open the project at `https://bharat-3d.pages.dev/` (or matching build).
- [ ] First shot is **Project opening** at `/` — explain the registry as the system, not as a tour of a web page.
- [ ] Sign-in: `survey@bharat3d.demo`; password **never spoken**; **Rajesh Kumar**, **SURVEYOR**, `/surveyor/dashboard`.
- [ ] Ward labels: **Central Heights**, **Ward 16** only.
- [ ] Skip **START 3D ANALYSIS**, processing timer, editor, registry generation, persona switch, excavation page.
- [ ] Ignore **Loading** on projects; hide **Analysis Confidence** bars.
- [ ] Map: wait for tiles; **CLICK TO OPEN 3D WORLD →** or **ENTER 3D MINI-CITY WORLD**.
- [ ] 3D: **Flat 804**, floor **8**, unit **4**; **a different owner** — do not read the unit owner name.
- [ ] **Sharma Commercial Plaza** in 3D inspector only; no sidebar **Bylaw Violations**.
- [ ] Metro **INF-TUN-DL01-0012**, **14.2 m**; no partnership language.
- [ ] Spoken script under **840 words**; video under **6:00**.

---

## 4. Timing check (spoken words only)

Counts exclude stage directions, speaker labels, and timestamps. Re-run a word count on section 2 after any edit.

### Anupama

| Block | Spoken words |
|-------|----------------|
| Project opening and registry rules 0:00–1:32 | 210 |
| Surveyor workflow and 2D 1:34–2:58 | 172 |
| Close 5:14–5:34 | 58 |
| **Anupama total** | **440** |

`440 ÷ 140 = 3.14 min` (~3:09)

### Partha

| Block | Spoken words |
|-------|----------------|
| 3D ward and architecture 3:00–5:12 | 327 |
| **Partha total** | **327** |

`327 ÷ 140 = 2.34 min` (~2:20)

### Total

| Speaker | Words | words ÷ 140 | Approx. time |
|---------|-------|-------------|--------------|
| Anupama | 440 | 440 / 140 = 3.14 | ~3:09 |
| Partha | 327 | 327 / 140 = 2.34 | ~2:20 |
| **Combined** | **767** | **767 / 140 = 5.48** | **~5:29** |

**Speaker share:** Anupama `440 / 767 = 57.4%`; Partha `327 / 767 = 42.6%`.

Map load and 3D orbit pauses typically bring total video runtime into the **5:20–5:45** band without adding spoken words.

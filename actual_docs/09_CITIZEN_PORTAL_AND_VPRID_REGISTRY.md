# BHARAT 3D: Citizen Portal & 3D Property Registry (VPRID)

## 1. Volumetric Property Registry ID (VPRID) Taxonomy

Under BHARAT 3D, every individual high-rise unit receives a unique, globally queryable 3D cadastral identifier:

$$\text{VPRID} = \text{VPR}-\underbrace{\text{BLD001}}_{\text{Building ID}}-\underbrace{\text{F08}}_{\text{Floor}}-\underbrace{\text{U04}}_{\text{Unit Number}}$$

Example: `VPR-BLD001-F08-U04` (Flat 804, Floor 8, Aarav Heights Condominium).

---

## 2. Citizen Property Card & Digital Deed Inspection

When a citizen searches their ULPIN or VPRID, the portal displays:
- **True 3D Spatial Geometry**: Exact floor elevation ($Z = 239.0\text{ m}$ to $242.0\text{ m}$ MSL), ceiling height ($3.0\text{ m}$), and 3D volumetric space ($345.6\text{ m}^3$).
- **Verified Carpet Area**: $115.2\text{ m}^2$ ($1,240\text{ sq.ft}$).
- **Registered Title Ownership**: Priya Mehta (Owner) / Rohan Gupta (Tenant).
- **Encumbrance Status**: Clear title, 0 legal disputes, bank mortgage registered with State Bank of India.
- **Municipal Property Tax**: $₹18,400 / \text{year}$ (Status: Paid).

---

## 3. Simulated Online Tax Settlement

Citizens can simulate municipal property tax payments with 1 click:
1. Citizen views outstanding dues.
2. Selects payment gateway (UPI / NetBanking / Debit Card).
3. Instant digital settlement updates SQLite/PostGIS database in real-time.
4. Downloads official **Government 3D Digital Cadastre Ownership Certificate**.

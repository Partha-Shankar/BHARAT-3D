# BHARAT 3D: Utility Excavation & 3D Clash Detection Engine

## 1. Problem: Subsurface Utility Strikes

Excavation works in urban roads frequently damage high-voltage electrical cables, water mains, and gas pipes, or risk penetrating underground transit tunnels due to a lack of accurate 3D subterranean data.

---

## 2. 3D Subsurface Cylinder Buffer Algorithm

When a utility operator inputs a proposed excavation line (from Coordinate $A$ to Coordinate $B$, with trench depth $D$ and width $W$):

1. **3D Trench Envelope Construction**:
   $$\text{Box}_{\text{trench}} = [X_1, Y_1, Z_{\text{ground}}] \to [X_2, Y_2, Z_{\text{ground}} - D]$$
2. **Infrastructure Safety Buffer Extraction**:
   For each underground asset (Metro Tunnel $T$, Road Tunnel $R$, Utility Conduit $U$):
   $$\text{Buffer}_{\text{cylinder}}(A) = \{P \in \mathbb{R}^3 \mid \text{dist}(P, \text{Centerline}_A) \le r_A + \text{safety\_margin}\}$$
3. **Clash Intersection Query**:
   $$\text{Clash} = \text{Box}_{\text{trench}} \cap \text{Buffer}_{\text{cylinder}}(A)$$

---

## 3. Subterranean Assets in Central Urban Zone

- **Yellow Line Metro Transit Tunnel (`TNL-002`)**: Depth **$-14.2\text{ m}$ MSL**, Safety Radius $10.0\text{ m}$.
- **Central Road Tunnel (`TNL-001`)**: Depth **$-8.5\text{ m}$ MSL**, Safety Radius $6.0\text{ m}$.
- **Civic Mall Basement Parking (`PKG-001`)**: Depth **$-6.0\text{ m}$ MSL**, Safety Radius $4.0\text{ m}$.
- **Underground 11kV Power & 400mm Water Mains**: Depth **$-2.5\text{ m}$ to $-4.2\text{ m}$ MSL**.

---

## 4. Automated Digital Digging NOC Issuance

- If $\text{Clash} = \emptyset$: System approves permit and generates a **Digital Digging NOC** with QR code and cryptographic verification signature.
- If $\text{Clash} \ne \emptyset$: System denies permit, highlights the 3D clash intersection in red, and suggests an alternate depth profile.

# BHARAT 3D: Municipality & 3D Violation Detection Engine

## 1. Overview & Municipal Compliance Rules

Traditional municipal corporations struggle to detect vertical property violations using flat satellite imagery because top-down ortho views cannot accurately measure vertical building heights or unauthorized upper floors.

BHARAT 3D automatically compares **sanctioned architectural approval plans** against **LiDAR-measured 3D volumetric reality**.

---

## 2. Sharma Commercial Plaza (`BLD-007`) Violation Case Study

| Compliance Parameter | Sanctioned Plan (Approved) | Measured 3D Reality (Surveyed) | Status |
| :--- | :--- | :--- | :--- |
| **Max Permissible Floors** | Ground + 4 Floors ($G+4$) | Ground + 6 Floors ($G+6$) | **CRITICAL VIOLATION (+2 Illegal Floors)** |
| **Maximum Permissible Height** | $14.0\text{ meters}$ | $21.2\text{ meters}$ | **EXCEEDED (+7.2 meters)** |
| **Front Setback Requirement** | $6.0\text{ meters}$ | $3.8\text{ meters}$ | **BREACH (-2.2m Setback Encroachment)** |
| **Total Carpet Area** | $1,800\text{ m}^2$ | $2,720\text{ m}^2$ | **+920 m² Unauthorized Commercial Space** |

---

## 3. Automated 3D Violation Highlighting

In the 3D Map and BIM Viewer:
- **Floors 1 to 4 ($0\text{ m}$ to $14\text{ m}$)**: Rendered in standard slate blue (Sanctioned).
- **Floors 5 and 6 ($14\text{ m}$ to $21.2\text{ m}$)**: Rendered in **vivid warning RED (`#DC2626`)** with pulsing hazard alert tags.

---

## 4. Municipal Enforcement Actions

1. **Digital Violation Notice Generation**:
   - Automated notice issued with cryptographic SHA-256 hash.
   - Legal Section: *Section 343/344 Delhi Municipal Corporation Act (Unauthorized Vertical Construction)*.
2. **Tax Penalty & Roll Recalculation**:
   - Base Annual Tax: $₹1,20,000$
   - Unauthorized Commercial Floor Surcharge: $+₹84,000 / \text{year}$ ($₹42,000 \times 2$ floors)
   - Penalty Assessment: $+₹2,50,000$ non-compoundable compounding fee.

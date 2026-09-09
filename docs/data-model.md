# BHARAT 3D — Data Model & VPRID Specification

## 1. Separation of Identity, Ownership & Occupancy
* **Spatial Identity (`VPRID`)**: Immutable volumetric geometry $(X, Y, Z_{\min}, Z_{\max}, \text{Volume}, \text{Area})$.
* **Legal Ownership Title (`Ownership`)**: Freehold, Joint, Corporate, or Government deed holder.
* **Economic Tenancy (`Lease / Occupancy`)**: Self-occupied, Tenant, Commercial leasee, or Vacant.

---

## 2. VPRID Standard Syntax
```text
VPR-{BUILDING_CODE}-F{FLOOR:02d}-U{UNIT:02d}
Example: VPR-BLD001-F08-U04
Base 2D Parcel ULPIN: IN-DEMO-0042
```

---

## 3. Entity Hierarchy
* **Parcel**: Base 2D cadastral land boundary (ULPIN).
* **Building**: 3D structural envelope situated on a parcel.
* **Floor**: Vertical subdivision layer ($Z_{\min} \to Z_{\max}$).
* **VerticalUnit**: Enclosed 3D legal property unit (Flat, Office, Shop).
* **InfrastructureAsset**: Subsurface / elevated corridor (Tunnel, Flyover, Utility).
* **Ownership**: Title deed registration records.
* **Lease**: Rental tenancy agreements.
* **TaxRecord**: Annual municipal property tax assessments.
* **Violation**: Detected municipal bylaw breaches.
* **AuditEvent**: Immutable log of all geometric and cadastral modifications.

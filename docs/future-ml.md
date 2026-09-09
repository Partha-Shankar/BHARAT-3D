# BHARAT 3D — Production AI/ML Architecture Roadmap

## Transition from Demo Engine to Real Deep Learning Pipeline

In the current Smart India Hackathon prototype, the `DemoProcessingEngine` loads precomputed, mathematically consistent datasets to ensure an unshakeable 45-second live jury demonstration without GPU latency.

In production deployment, `DemoProcessingEngine` is directly replaced by `RealProcessingEngine` adhering to the identical interface contract.

---

## 🔬 Production Model Specifications

### 1. Building Footprint Extraction (`BuildingDetectionEngine`)
* **Model**: Mask R-CNN with ResNet-50-FPN / HRNet.
* **Input**: 4-Band Raster (Red, Green, Blue, nDSM).
* **Training Data**: Drone orthomosaics annotated across Indian urban typologies.
* **Post-Processing**: Douglas-Peucker polygon simplification with orthogonal edge snapping.

### 2. Point Cloud Semantic Classification (`PointCloudClassifier`)
* **Toolchain**: PDAL + PointNet++ / CSF (Cloth Simulation Filter).
* **Classes**: Ground (2), High Vegetation (5), Building Roofs (6), Infrastructure (17).
* **Output**: Bare-earth DTM and surface DSM rasters.

### 3. Vertical Floor Inference (`FloorSegmentationEngine`)
* **Algorithm**: Bayesian estimation combining measured height $H_{\text{bld}}$, facade window edge extraction, and typological architectural priors (Residential: $3.05m$, Commercial: $3.80m$).

### 4. 3D Topology & Boundary Verification (`TopologyValidationEngine`)
* **Validation**: CGAL / Trimesh 2-manifold solid checks, zero non-manifold edges, zero internal face intersections, and 3D Hausdorff boundary containment.

---

## 🏛️ Governance Principle
> **"AI detects candidate structures; certified government surveyors verify; deterministic rule engines enforce municipal bylaws."**

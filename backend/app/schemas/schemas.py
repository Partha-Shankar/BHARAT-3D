from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, EmailStr

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: Optional['UserResponse'] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    department: Optional[str] = None
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    ward_number: str
    zone_name: str

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    ward_number: Optional[str] = None
    zone_name: Optional[str] = None
    status: str
    created_by: Optional[int] = None
    survey_polygon: Optional[str] = None
    selected_area_id: Optional[str] = None
    dataset_version: Optional[str | int] = None
    active_dataset_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class ProjectListResponse(ProjectResponse):
    pass

class DatasetResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    version: str
    status: str
    source_types: str
    processing_metrics: Optional[str] = None
    metadata_json: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ProcessingJobResponse(BaseModel):
    id: int
    project_id: int
    dataset_id: int
    status: str
    progress: int
    current_stage: Optional[str] = None
    stages_completed: Optional[str] = None
    metrics: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ParcelResponse(BaseModel):
    id: int
    ulpin: str
    project_id: int
    survey_number: str
    ward_id: str
    land_use: str
    area_sqm: float
    geometry: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class BuildingResponse(BaseModel):
    id: int
    building_code: str
    ulpin: Optional[str] = None
    project_id: int
    name: Optional[str] = None
    building_type: str
    total_floors: int
    basement_floors: int
    height_meters: float
    footprint_area_sqm: float
    geometry: str
    floor_count: Optional[int] = 0
    unit_count: Optional[int] = 0
    violation_count: Optional[int] = 0
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class VerticalUnitResponse(BaseModel):
    id: int
    vprid: str
    floor_id: int
    building_id: int
    ulpin: Optional[str] = None
    unit_number: str
    usage_type: str
    z_min: float
    z_max: float
    area_sqm: float
    volume_cum: float
    geometry: str
    compliance_status: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class FloorResponse(BaseModel):
    id: int
    building_id: int
    floor_number: int
    floor_label: str
    z_min: float
    z_max: float
    area_sqm: float
    geometry: str
    units: Optional[List[VerticalUnitResponse]] = []
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InfrastructureAssetResponse(BaseModel):
    id: int
    asset_id: str
    project_id: int
    name: str
    asset_type: str
    operator: str
    depth_meters: Optional[float] = None
    elevation_meters: Optional[float] = None
    length_meters: Optional[float] = None
    width_meters: Optional[float] = None
    clearance_buffer: Optional[float] = None
    geometry: str
    status: str
    confidence: Optional[float] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class OwnershipResponse(BaseModel):
    id: int
    unit_vprid: str
    owner_name: str
    masked_id: str
    ownership_type: str
    share_percentage: float
    title_deed: Optional[str] = None
    effective_date: datetime
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class LeaseResponse(BaseModel):
    id: int
    unit_vprid: str
    tenant_name: str
    lease_start: datetime
    lease_end: datetime
    monthly_rent: Optional[float] = None
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TaxRecordResponse(BaseModel):
    id: int
    unit_vprid: str
    financial_year: str
    usage_type: str
    assessed_value: float
    annual_tax: float
    amount_paid: float
    amount_due: float
    payment_status: str
    assessment_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ViolationResponse(BaseModel):
    id: int
    violation_code: str
    building_id: Optional[int] = None
    asset_id: Optional[str] = None
    project_id: int
    violation_type: str
    severity: str
    rule_reference: str
    observed_value: Optional[str] = None
    permitted_value: Optional[str] = None
    excess: Optional[str] = None
    area_sqm: Optional[float] = None
    status: str
    evidence: Optional[str] = None
    geometry: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AuditEventResponse(BaseModel):
    id: int
    user_id: int
    action: str
    entity_type: str
    entity_id: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    project_id: Optional[int] = None
    dataset_id: Optional[int] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class ExcavationRequest(BaseModel):
    polygon_geojson: str
    depth_meters: float
    project_id: int

class ExcavationConflict(BaseModel):
    asset_id: str
    name: str
    asset_type: str
    conflict_type: str
    severity: str
    depth_meters: float

class ExcavationResponse(BaseModel):
    project_id: int
    is_safe: bool
    max_safe_depth: float
    conflicts: List[ExcavationConflict]

class RegistryStatsResponse(BaseModel):
    total_parcels: int
    total_buildings: int
    total_units: int
    total_owners: int
    total_tax_collected: float
    compliance_score: float

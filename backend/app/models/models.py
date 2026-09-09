import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

from app.core.database import Base

class RoleEnum(str, enum.Enum):
    SURVEYOR = "SURVEYOR"
    MUNICIPALITY = "MUNICIPALITY"
    UTILITY_OPERATOR = "UTILITY_OPERATOR"
    CITIZEN = "CITIZEN"
    ADMIN = "ADMIN"

class ProjectStatusEnum(str, enum.Enum):
    DRAFT = "DRAFT"
    PROCESSING = "PROCESSING"
    REVIEW = "REVIEW"
    CONFIRMED = "CONFIRMED"
    PUBLISHED = "PUBLISHED"

class JobStatusEnum(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"

class UnitUsageEnum(str, enum.Enum):
    RESIDENTIAL = "RESIDENTIAL"
    COMMERCIAL = "COMMERCIAL"
    COMMON = "COMMON"
    PARKING = "PARKING"
    INSTITUTIONAL = "INSTITUTIONAL"

class AssetTypeEnum(str, enum.Enum):
    TUNNEL = "TUNNEL"
    FLYOVER = "FLYOVER"
    TELECOM = "TELECOM"
    WATER = "WATER"
    ELECTRICITY = "ELECTRICITY"
    PARKING = "PARKING"
    RAILWAY = "RAILWAY"
    METRO = "METRO"

class OwnershipTypeEnum(str, enum.Enum):
    FREEHOLD = "FREEHOLD"
    JOINT = "JOINT"
    CORPORATE = "CORPORATE"
    GOVERNMENT = "GOVERNMENT"

class LeaseStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    VACANT = "VACANT"

class PaymentStatusEnum(str, enum.Enum):
    PAID = "PAID"
    PENDING = "PENDING"
    ARREARS = "ARREARS"

class SeverityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class ViolationStatusEnum(str, enum.Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    role = Column(Enum(RoleEnum))
    department = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    ward_number = Column(String)
    zone_name = Column(String)
    status = Column(Enum(ProjectStatusEnum), default=ProjectStatusEnum.DRAFT)
    created_by = Column(Integer, ForeignKey("users.id"))
    survey_polygon = Column(Text, nullable=True)
    selected_area_id = Column(String, default="area_01")
    dataset_version = Column(String, nullable=True)
    active_dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String)
    description = Column(String, nullable=True)
    version = Column(String)
    status = Column(String)
    source_types = Column(Text) # JSON
    processing_metrics = Column(Text, nullable=True) # JSON
    metadata_json = Column(Text, nullable=True) # JSON
    created_at = Column(DateTime, default=datetime.utcnow)

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    status = Column(Enum(JobStatusEnum), default=JobStatusEnum.QUEUED)
    progress = Column(Integer, default=0)
    current_stage = Column(String, nullable=True)
    stages_completed = Column(Text, nullable=True) # JSON
    metrics = Column(Text, nullable=True) # JSON
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Parcel(Base):
    __tablename__ = "parcels"
    id = Column(Integer, primary_key=True, index=True)
    ulpin = Column(String, unique=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    survey_number = Column(String)
    ward_id = Column(String)
    land_use = Column(String)
    area_sqm = Column(Float)
    geometry = Column(Text) # GeoJSON
    created_at = Column(DateTime, default=datetime.utcnow)

class Building(Base):
    __tablename__ = "buildings"
    id = Column(Integer, primary_key=True, index=True)
    building_code = Column(String, unique=True, index=True)
    ulpin = Column(String, ForeignKey("parcels.ulpin"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String, nullable=True)
    building_type = Column(String)
    total_floors = Column(Integer)
    basement_floors = Column(Integer, default=0)
    height_meters = Column(Float)
    footprint_area_sqm = Column(Float)
    geometry = Column(Text) # GeoJSON
    created_at = Column(DateTime, default=datetime.utcnow)

class Floor(Base):
    __tablename__ = "floors"
    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"))
    floor_number = Column(Integer)
    floor_label = Column(String)
    z_min = Column(Float)
    z_max = Column(Float)
    area_sqm = Column(Float)
    geometry = Column(Text) # GeoJSON
    created_at = Column(DateTime, default=datetime.utcnow)

class VerticalUnit(Base):
    __tablename__ = "vertical_units"
    id = Column(Integer, primary_key=True, index=True)
    vprid = Column(String, unique=True, index=True)
    floor_id = Column(Integer, ForeignKey("floors.id"))
    building_id = Column(Integer, ForeignKey("buildings.id"))
    ulpin = Column(String, nullable=True)
    unit_number = Column(String)
    usage_type = Column(Enum(UnitUsageEnum))
    z_min = Column(Float)
    z_max = Column(Float)
    area_sqm = Column(Float)
    volume_cum = Column(Float)
    geometry = Column(Text) # GeoJSON
    compliance_status = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class InfrastructureAsset(Base):
    __tablename__ = "infrastructure_assets"
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(String, unique=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String)
    asset_type = Column(Enum(AssetTypeEnum))
    operator = Column(String)
    depth_meters = Column(Float, nullable=True)
    elevation_meters = Column(Float, nullable=True)
    length_meters = Column(Float, nullable=True)
    width_meters = Column(Float, nullable=True)
    clearance_buffer = Column(Float, nullable=True)
    geometry = Column(Text) # GeoJSON
    status = Column(String)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Ownership(Base):
    __tablename__ = "ownerships"
    id = Column(Integer, primary_key=True, index=True)
    unit_vprid = Column(String, ForeignKey("vertical_units.vprid"))
    owner_name = Column(String)
    masked_id = Column(String)
    ownership_type = Column(Enum(OwnershipTypeEnum))
    share_percentage = Column(Float)
    title_deed = Column(String, nullable=True)
    effective_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Lease(Base):
    __tablename__ = "leases"
    id = Column(Integer, primary_key=True, index=True)
    unit_vprid = Column(String, ForeignKey("vertical_units.vprid"))
    tenant_name = Column(String)
    lease_start = Column(DateTime)
    lease_end = Column(DateTime)
    monthly_rent = Column(Float, nullable=True)
    status = Column(Enum(LeaseStatusEnum))
    created_at = Column(DateTime, default=datetime.utcnow)

class TaxRecord(Base):
    __tablename__ = "tax_records"
    id = Column(Integer, primary_key=True, index=True)
    unit_vprid = Column(String, ForeignKey("vertical_units.vprid"))
    financial_year = Column(String)
    usage_type = Column(String)
    assessed_value = Column(Float)
    annual_tax = Column(Float)
    amount_paid = Column(Float, default=0)
    amount_due = Column(Float)
    payment_status = Column(Enum(PaymentStatusEnum))
    assessment_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

class Violation(Base):
    __tablename__ = "violations"
    id = Column(Integer, primary_key=True, index=True)
    violation_code = Column(String, unique=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"), nullable=True)
    asset_id = Column(String, ForeignKey("infrastructure_assets.asset_id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    violation_type = Column(String)
    severity = Column(Enum(SeverityEnum))
    rule_reference = Column(String)
    observed_value = Column(String, nullable=True)
    permitted_value = Column(String, nullable=True)
    excess = Column(String, nullable=True)
    area_sqm = Column(Float, nullable=True)
    status = Column(Enum(ViolationStatusEnum), default=ViolationStatusEnum.OPEN)
    evidence = Column(Text, nullable=True) # JSON
    geometry = Column(Text, nullable=True) # GeoJSON
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditEvent(Base):
    __tablename__ = "audit_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String)
    entity_type = Column(String)
    entity_id = Column(String)
    old_value = Column(Text, nullable=True) # JSON
    new_value = Column(Text, nullable=True) # JSON
    project_id = Column(Integer, nullable=True)
    dataset_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

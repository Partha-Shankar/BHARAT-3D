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

export type UserRole = 'SURVEYOR' | 'MUNICIPALITY' | 'UTILITY_OPERATOR' | 'CITIZEN' | 'ADMIN';

export interface User { id: string; email: string; full_name: string; role: UserRole; department?: string; }

export interface Project { id: string; name: string; description: string; ward_number: string; zone_name: string; status: string; survey_polygon?: any; selected_area_id?: string; dataset_version: number; created_at: string; }

export interface ProcessingJob {
  id: string; project_id: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETE' | 'FAILED';
  progress: number; current_stage: string; stages_completed: ProcessingStage[];
  metrics?: ProcessingMetrics; started_at?: string; completed_at?: string;
}

export interface ProcessingStage { name: string; label: string; status: 'pending' | 'running' | 'complete'; duration_ms?: number; }

export interface ProcessingMetrics {
  buildings_detected: number; floors_inferred: number; vertical_units: number;
  infrastructure_assets: number; violations_detected: number;
  topology_score: number; building_confidence: number; floor_confidence: number;
  height_confidence: number; coordinate_alignment: number;
}

export interface Building {
  id: string; building_code: string; ulpin: string; name: string; building_type: string;
  total_floors: number; basement_floors: number; height_meters: number;
  footprint_area_sqm: number; geometry: any; floor_count: number; unit_count: number; violation_count: number;
}

export interface Floor {
  id: string; building_id: string; floor_number: number; floor_label: string;
  z_min: number; z_max: number; area_sqm: number; units: VerticalUnit[];
}

export interface VerticalUnit {
  id: string; vprid: string; unit_number: string; usage_type: string;
  z_min: number; z_max: number; area_sqm: number; volume_cum: number;
  compliance_status: string; ulpin: string; floor_id: string; building_id: string;
  ownership?: Ownership; lease?: Lease; tax?: TaxRecord;
}

export interface Ownership {
  owner_name: string; masked_id: string; ownership_type: string;
  share_percentage: number; title_deed: string; effective_date: string;
}

export interface Lease {
  tenant_name: string; lease_start: string; lease_end: string;
  monthly_rent: number; status: string;
}

export interface TaxRecord {
  financial_year: string; usage_type: string; annual_tax: number;
  payment_status: string; amount_paid: number; amount_due: number;
}

export interface InfrastructureAsset {
  id: string; asset_id: string; name: string; asset_type: string;
  operator: string; depth_meters?: number; elevation_meters?: number;
  length_meters?: number; width_meters?: number; clearance_buffer: number;
  geometry: any; status: string; confidence: number;
}

export interface Violation {
  id: string; violation_code: string; violation_type: string; severity: string;
  rule_reference: string; observed_value: number; permitted_value: number;
  excess: number; area_sqm?: number; status: string; evidence: any;
  geometry?: any; building_id?: string; created_at: string;
}

export interface AuditEvent {
  id: string; action: string; entity_type: string; entity_id: string;
  old_value?: any; new_value?: any; timestamp: string; user_id: string;
}

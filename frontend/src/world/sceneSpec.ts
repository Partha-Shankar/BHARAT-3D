// Mirror of the backend SceneSpec (app/realgen/pipeline.py). Local metres: x = east, y = north.
export type XY = [number, number];

export type Source = 'osm' | 'synthetic' | 'faker' | 'groq';

export interface TerrainGrid {
  extent: [number, number, number, number];
  n: number;
  heights: number[][]; // row 0 = north edge
  datum_msl_m: number;
  relief_m: number;
  source: string;
}

export interface Building {
  id: string;
  osm_id: string;
  name: string;
  name_source: string;
  building_type: string;
  usage: 'R' | 'C' | 'M' | 'I' | 'P';
  footprint: XY[];
  centroid: XY;
  area_m2: number;
  base_z: number;
  min_height: number;
  height: number;
  floors: number;
  floor_height: number;
  height_source: string;
  footprint_source: string;
  roof_shape: string;
  sanctioned_floors: number;
  sanctioned_height: number;
  parcel_id: string | null;
  ulpin: string | null;
  units_per_floor: number;
  basement_levels: number;
  violation_ids: string[];
  footpath_encroachment_m2: number;
  seed: number;
  sanction_status?: 'ON_RECORD' | 'NOT_ON_RECORD';
  permit_no?: string | null;
  block_no?: number;
  identity?: '3D' | '2D';
  /** 3D ULPIN norms: how this building is identified, and why */
  identity_kind?: 'STRATA' | 'SINGLE_TITLE' | 'INF_PUB' | 'PROPOSAL';
  identity_reason?: string;
  usage_class?: string;
  building_no?: string;
  inf_id?: string;
  parent_parcel_ulpin?: string | null;
  tenure?: 'strata' | 'single' | 'public';
  verified?: boolean;
  certified?: boolean;
  under_construction?: boolean;
  unit_overrides?: Record<string, number>;
  edited?: boolean;
}

export interface Road {
  id: string;
  kind: string;
  name: string | null;
  width_m: number;
  path: XY[];
  elevation_m: number;
  is_bridge: boolean;
  source: Source | 'edited';
  sidewalk?: string | null;
  is_sidewalk?: boolean;
  inf_id?: string;
  affected_ulpins?: string[];
}

export interface Railway {
  id: string;
  kind: string;
  name: string;
  path: XY[];
  elevation_m: number;
  is_bridge: boolean;
  source: Source;
}

export interface SubsurfaceAsset {
  id: string;
  kind: 'metro' | 'rail_tunnel' | 'road_tunnel' | 'water' | 'sewer' | 'telecom' | 'power' | 'gas' | 'basement';
  name: string;
  source: Source | 'edited';
  path?: XY[];
  footprint?: XY[];
  depth_m: number;
  depth_top_m?: number;
  radius_m?: number;
  buffer_m: number;
  operator?: string;
  building_id?: string;
  inf_id?: string;
  affected_ulpins?: string[];
  tunnel_group?: string;
}

export interface Violation {
  id: string;
  building_id: string;
  type: string;
  severity: string;
  sanctioned: string;
  observed: string;
  excess: string;
  floors_flagged: number[];
  measurement_confidence: string;
  basis: string;
  location?: XY;
  geometry?: XY[][];
}

export interface ConstructionSite {
  id: string;
  osm_id: string;
  kind: 'construction_site' | 'building_under_construction';
  name: string;
  polygon: XY[];
  area_m2: number;
  source: string;
  building_id: string | null;
  permit_status: 'PERMITTED' | 'NO_PERMIT_ON_RECORD';
  permit_no: string | null;
  violation_id?: string;
}

export interface SceneSpec {
  version: number;
  key: string;
  place: { locality: string; city: string; state: string; state_code: string; display_name: string };
  summary: string;
  origin: { lon: number; lat: number };
  survey_polygon: { lonlat: XY[]; local: XY[] };
  extent: [number, number, number, number];
  terrain: TerrainGrid;
  texture: { url: string; zoom: number; width: number; height: number; attribution: string };
  context_texture?: { url: string; extent: [number, number, number, number]; zoom: number };
  buildings: Building[];
  parcels: { id: string; ulpin: string; footprint: XY[]; area_m2: number; building_ids: string[]; source: string; kind?: string; identity?: string;
    encumbrances?: { inf_id: string; type: string }[] }[];
  zone?: string;
  integrity?: Record<string, { checked: number; failures: string[] }>;
  common_spaces?: CommonSpace[];
  construction_sites?: ConstructionSite[];
  footpaths?: Footpath[];
  edits_count?: number;
  edit_errors?: { edit: number; error: string }[];
  roads: Road[];
  railways: Railway[];
  water: { id: string; kind: string; polygon?: XY[]; path?: XY[] }[];
  green: { id: string; kind: string; polygon?: XY[] }[];
  trees: { x: number; y: number }[];
  stations: { name: string; kind: string; x: number; y: number }[];
  subsurface: SubsurfaceAsset[];
  violations: Violation[];
  stats: Record<string, any>;
  sources: { layer: string; source: string; kind: 'real' | 'estimated' | 'synthetic' }[];
  generated_in_s: number;
}

export interface Room {
  name: string;
  type: string;
  polygon: XY[];
  area_m2: number;
}

export interface Unit {
  unit_no: string;
  index: number;
  rooms: Room[];
  vprid: string | null;
  status: string;
  polygon: XY[];
  built_up_m2: number;
  carpet_m2: number;
  volume_m3: number;
  z_min: number;
  h_min?: number;
  h_max?: number;
  z_max: number;
  owner: string;
  occupancy: string;
  annual_tax_inr: number;
  uds_percent: number | null;
  uds_ppm?: number | null;
  unit_code?: string;
  level?: string;
  reason?: string | null;
  usage_class?: string;
  source: string;
}

/** Common Space Registry element (lifts, stairs, corridors, common parking): never a 3D ULPIN. */
export interface CommonSpace {
  id: string;
  building_id: string;
  label: string;
  levels: string;
}

export interface BuildingDetail {
  building: Building;
  floors: {
    floor: number; label: string; z_min: number;
  h_min?: number;
  h_max?: number; z_max: number; unauthorized: boolean; status: string;
    core: XY[] | null; corridor: XY[] | null; units: Unit[]; level?: string;
  }[];
  common_spaces?: CommonSpace[];
}

export interface ExcavationResult {
  overall_risk_level: string;
  clashes_detected_count: number;
  clashes: {
    asset_id: string;
    asset_name: string;
    asset_type: string;
    source: string;
    depth_meters: number;
    plan_distance_meters: number;
    vertical_clearance_meters: number;
    clash_severity: string;
  }[];
  recommendation: string;
  digital_noc_eligible: boolean;
  trench_area_m2: number;
}

export interface GenerationJob {
  id: string;
  key: string;
  status: 'RUNNING' | 'COMPLETE' | 'FAILED';
  stage_index: number;
  stage: string;
  detail: string;
  stages: string[];
  progress: number;
  area_m2: number;
  elapsed_s: number;
  error: string | null;
  stats: Record<string, any> | null;
  place?: SceneSpec['place'];
  summary?: string;
}

export interface SceneMeta {
  key: string;
  place: SceneSpec['place'];
  origin: { lon: number; lat: number };
  created_at: number;
  updated_at: number;
  area_m2: number;
  buildings: number;
  vprids_reserved: number;
  violations: number;
  subsurface_assets: number;
  edits_count: number;
  survey_polygon: XY[];
  datasets?: number;
  zone?: string;
  inf_assets?: number;
  common_spaces?: number;
  pending?: number;
  ai_proposals?: number;
  integrity?: Record<string, { checked: number; failures: number; sample: string[] }>;
}

export interface RegistryEntry {
  vprid: string | null;
  building_id: string;
  building_name: string;
  ulpin: string;
  floor: number;
  unit_index: number;
  unit_no: string;
  status: string;
  area_m2: number;
  anchor?: string;
  building_no?: string;
  level?: string;
  unit_code?: string | null;
  reason?: string | null;
  usage_class?: string;
  version?: number | null;
  undivided_share_ppm?: number | null;
}

export type EditOp =
  | { op: 'building.update'; id: string; set: Partial<Building> & { unit_overrides?: Record<string, number> } }
  | { op: 'building.add'; building: { footprint: XY[]; floors: number; usage: string; name?: string; floor_height?: number } }
  | { op: 'building.delete'; id: string }
  | { op: 'asset.update'; id: string; set: Partial<SubsurfaceAsset> }
  | { op: 'asset.add'; asset: Partial<SubsurfaceAsset> & { kind: string; path: XY[] } }
  | { op: 'asset.delete'; id: string }
  | { op: 'road.update'; id: string; set: Partial<Road> }
  | { op: 'road.add'; road: Partial<Road> & { path: XY[] } }
  | { op: 'road.delete'; id: string };

/** A compliance finding listed across areas (GET /realgen/findings). */
export interface FindingRow {
  id: string;
  key: string;
  place: string;
  type: string;
  severity: string;
  building_id: string | null;
  building_name: string | null;
  ulpin: string | null;
  floors: number | null;
  sanctioned: string;
  observed: string;
  excess: string;
  floors_flagged: number[];
  measurement_confidence: string;
  basis: string;
  location?: XY;
}

export interface RegistryHit extends RegistryEntry {
  key: string;
  place: string;
}

export interface ActivityEvent {
  key: string;
  place: string;
  at: number | null;
  kind: 'generated' | 'ingested' | 'edit' | 'lifecycle';
  by: string | null;
  seq?: number;
  detail: any;
}

/** One dataset in a survey package (ingestion step). */
export interface DatasetManifest {
  slot: string;
  title: string;
  name: string;
  size_bytes: number;
  format: string;
  checks: string[];
  sample: boolean;
}

/** A footpath surface (mapped OSM sidewalk, or an assumed band beside a major road). */
export interface Footpath {
  id: string;
  road_id: string;
  road_name: string;
  source: 'mapped' | 'assumed';
  area_m2: number;
  rings: XY[][];
}

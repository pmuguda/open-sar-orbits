/** Shared API types — mirror docs/api.md. */

export interface OmmRecord {
  OBJECT_NAME: string;
  NORAD_CAT_ID: number;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  BSTAR?: number;
  MEAN_MOTION_DOT?: number;
  MEAN_MOTION_DDOT?: number;
  OBJECT_ID?: string;
  [key: string]: unknown;
}

export interface RegistryEntry {
  object_name?: string | null;
  norad_catalog_id?: number | null;
  international_designator?: string | null;
  mission_name?: string | null;
  constellation?: string | null;
  operator?: string | null;
  country?: string | null;
  status?: string | null;
  launch_date?: string | null;
  frequency_band?: string | null;
  centre_frequency_ghz?: number | null;
  polarisation_modes?: string[] | null;
  nominal_altitude_km?: number | null;
  inclination_deg?: number | null;
  repeat_cycle_days?: number | null;
  look_direction?: string | null;
  minimum_incidence_angle_deg?: number | null;
  maximum_incidence_angle_deg?: number | null;
  minimum_resolution_m?: number | null;
  maximum_swath_width_km?: number | null;
  open_data_available?: string | null;
  archive_url?: string | null;
  provider_url?: string | null;
  documentation_url?: string | null;
  metadata_source?: string | null;
  metadata_last_verified?: string | null;
}

export interface MergedSatellite {
  norad_catalog_id: number;
  object_name: string;
  international_designator: string | null;
  epoch: string | null;
  inclination_deg: number | null;
  period_minutes: number | null;
  registry: RegistryEntry | null;
  registry_match: 'norad' | 'pattern' | null;
}

export interface OrbitsResponse {
  fetched_at: string;
  age_seconds: number;
  stale: boolean;
  source: string;
  record_count: number;
  records: OmmRecord[];
}

export interface CacheStatus {
  fetched_at: string | null;
  age_seconds: number | null;
  stale: boolean;
  record_count: number;
}

export interface StatusResponse {
  orbit_cache: CacheStatus;
  registry: {
    satellite_count: number;
    constellation_count: number;
    last_verified_max: string | null;
  };
  service: { version: string; celestrak_url: string };
}

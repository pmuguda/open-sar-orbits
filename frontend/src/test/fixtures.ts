import type { MergedSatellite, OmmRecord } from '../types';

/** Same synthetic-but-physical elements as backend/tests/fixtures. */
export const S1A_RECORD: OmmRecord = {
  OBJECT_NAME: 'SENTINEL-1A',
  OBJECT_ID: '2014-016A',
  EPOCH: '2026-07-20T12:00:00.000000',
  MEAN_MOTION: 14.591988,
  ECCENTRICITY: 0.00013,
  INCLINATION: 98.18,
  RA_OF_ASC_NODE: 100.0,
  ARG_OF_PERICENTER: 90.0,
  MEAN_ANOMALY: 270.0,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: 39634,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 55555,
  BSTAR: 0.0001,
  MEAN_MOTION_DOT: 0.000001,
  MEAN_MOTION_DDOT: 0,
};

export const EPOCH_DATE = new Date('2026-07-20T12:00:00Z');

export const MERGED_SATELLITES: MergedSatellite[] = [
  {
    norad_catalog_id: 39634,
    object_name: 'SENTINEL-1A',
    international_designator: '2014-016A',
    epoch: '2026-07-20T12:00:00Z',
    inclination_deg: 98.18,
    period_minutes: 98.7,
    registry: {
      constellation: 'Sentinel-1',
      operator: 'ESA / European Commission (Copernicus)',
      country: 'European Union',
      frequency_band: 'C',
      status: 'active',
      open_data_available: 'yes',
      mission_name: 'Copernicus Sentinel-1',
    },
    registry_match: 'norad',
  },
  {
    norad_catalog_id: 31698,
    object_name: 'TERRASAR-X',
    international_designator: '2007-026A',
    epoch: '2026-07-20T12:00:00Z',
    inclination_deg: 97.44,
    period_minutes: 94.8,
    registry: {
      constellation: 'TerraSAR-X',
      operator: 'DLR / Airbus Defence and Space',
      country: 'Germany',
      frequency_band: 'X',
      status: 'active',
      open_data_available: 'partial',
    },
    registry_match: 'norad',
  },
  {
    norad_catalog_id: 99002,
    object_name: 'MYSTERY RADAR SAT',
    international_designator: null,
    epoch: '2026-07-20T12:00:00Z',
    inclination_deg: 45.0,
    period_minutes: 101.4,
    registry: null,
    registry_match: null,
  },
];

import type { OmmRecord } from '../types';

const NUMERIC_FIELDS = [
  'NORAD_CAT_ID',
  'MEAN_MOTION',
  'ECCENTRICITY',
  'INCLINATION',
  'RA_OF_ASC_NODE',
  'ARG_OF_PERICENTER',
  'MEAN_ANOMALY',
] as const;

/** Defensive guard for records coming over the wire. */
export function isOmmRecord(value: unknown): value is OmmRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.OBJECT_NAME !== 'string' || record.OBJECT_NAME.length === 0) return false;
  if (typeof record.EPOCH !== 'string' || Number.isNaN(Date.parse(record.EPOCH))) return false;
  return NUMERIC_FIELDS.every((f) => typeof record[f] === 'number' && Number.isFinite(record[f]));
}

export function validOmmRecords(values: unknown[]): OmmRecord[] {
  return values.filter(isOmmRecord);
}

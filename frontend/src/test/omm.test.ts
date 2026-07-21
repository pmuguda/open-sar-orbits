import { describe, expect, it } from 'vitest';

import { isOmmRecord, validOmmRecords } from '../lib/omm';
import { S1A_RECORD } from './fixtures';

describe('OMM record guard', () => {
  it('accepts a valid CelesTrak OMM record', () => {
    expect(isOmmRecord(S1A_RECORD)).toBe(true);
  });

  it('rejects records with missing or non-numeric fields', () => {
    expect(isOmmRecord(null)).toBe(false);
    expect(isOmmRecord({})).toBe(false);
    expect(isOmmRecord({ ...S1A_RECORD, MEAN_MOTION: 'fast' })).toBe(false);
    expect(isOmmRecord({ ...S1A_RECORD, OBJECT_NAME: '' })).toBe(false);
    expect(isOmmRecord({ ...S1A_RECORD, EPOCH: 'not-a-date' })).toBe(false);
  });

  it('filters mixed payloads', () => {
    const records = validOmmRecords([S1A_RECORD, {}, 42, { ...S1A_RECORD, INCLINATION: null }]);
    expect(records).toHaveLength(1);
    expect(records[0].NORAD_CAT_ID).toBe(39634);
  });
});

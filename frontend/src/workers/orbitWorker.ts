/// <reference lib="webworker" />
/**
 * Batch SGP4 trajectory sampling off the main thread.
 *
 * Request:  { type: 'sample', records, startMs, endMs, stepS }
 * Response: { type: 'samples', startMs, stepS, sats: [{ noradId, data }] }
 * where data is a transferred Float64Array of [lat, lon, altKm] triples
 * (NaN triple when propagation failed at that step).
 */
import { satrecFromOmm, subpointAt } from '../lib/propagation';
import type { OmmRecord } from '../types';

export interface SampleRequest {
  type: 'sample';
  records: OmmRecord[];
  startMs: number;
  endMs: number;
  stepS: number;
}

export interface SatSamples {
  noradId: number;
  data: Float64Array;
}

export interface SampleResponse {
  type: 'samples';
  startMs: number;
  stepS: number;
  count: number;
  sats: SatSamples[];
  failed: number[];
}

self.onmessage = (event: MessageEvent<SampleRequest>) => {
  const { records, startMs, endMs, stepS } = event.data;
  const count = Math.floor((endMs - startMs) / (stepS * 1000)) + 1;
  const sats: SatSamples[] = [];
  const failed: number[] = [];
  const transfers: ArrayBuffer[] = [];

  for (const record of records) {
    try {
      const satrec = satrecFromOmm(record);
      const data = new Float64Array(count * 3);
      let valid = 0;
      for (let i = 0; i < count; i += 1) {
        const point = subpointAt(satrec, new Date(startMs + i * stepS * 1000));
        if (point) {
          data[i * 3] = point.latDeg;
          data[i * 3 + 1] = point.lonDeg;
          data[i * 3 + 2] = point.altKm;
          valid += 1;
        } else {
          data[i * 3] = NaN;
          data[i * 3 + 1] = NaN;
          data[i * 3 + 2] = NaN;
        }
      }
      if (valid < 2) {
        failed.push(record.NORAD_CAT_ID);
        continue;
      }
      sats.push({ noradId: record.NORAD_CAT_ID, data });
      transfers.push(data.buffer);
    } catch {
      failed.push(record.NORAD_CAT_ID);
    }
  }

  const response: SampleResponse = { type: 'samples', startMs, stepS, count, sats, failed };
  (self as unknown as Worker).postMessage(response, transfers);
};

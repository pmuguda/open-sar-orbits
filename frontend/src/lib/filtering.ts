import type { MergedSatellite } from '../types';

export interface Filters {
  q: string;
  constellation: string;
  operator: string;
  country: string;
  band: string;
  status: string;
  openData: string;
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  constellation: '',
  operator: '',
  country: '',
  band: '',
  status: '',
  openData: '',
};

function eq(value: string | null | undefined, expected: string): boolean {
  return expected === '' || (value ?? '').toLowerCase() === expected.toLowerCase();
}

export function matchesFilters(sat: MergedSatellite, f: Filters): boolean {
  const registry = sat.registry ?? {};
  if (f.q) {
    const needle = f.q.toLowerCase();
    const haystack = [sat.object_name, registry.mission_name, registry.constellation]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return (
    eq(registry.constellation, f.constellation) &&
    eq(registry.operator, f.operator) &&
    eq(registry.country, f.country) &&
    eq(registry.frequency_band, f.band) &&
    eq(registry.status, f.status) &&
    eq(registry.open_data_available, f.openData)
  );
}

export function filterSatellites(sats: MergedSatellite[], f: Filters): MergedSatellite[] {
  return sats.filter((s) => matchesFilters(s, f));
}

/** Distinct non-null values of a registry field, sorted, for filter dropdowns. */
export function distinctValues(
  sats: MergedSatellite[],
  field:
    'constellation' | 'operator' | 'country' | 'frequency_band' | 'status' | 'open_data_available',
): string[] {
  const values = new Set<string>();
  for (const sat of sats) {
    const value = sat.registry?.[field];
    if (typeof value === 'string' && value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

/**
 * Colour-blind-safe constellation differentiation.
 *
 * Colours are the Okabe–Ito palette; every constellation additionally gets a
 * two-letter glyph so colour is never the only signal (labels, list rows and
 * the legend all show the glyph).
 */

export interface ConstellationStyle {
  color: string;
  glyph: string;
}

// Okabe–Ito (colour-blind safe)
const PALETTE = [
  '#E69F00', // orange
  '#56B4E9', // sky blue
  '#009E73', // bluish green
  '#F0E442', // yellow
  '#0072B2', // blue
  '#D55E00', // vermillion
  '#CC79A7', // reddish purple
  '#FFFFFF', // white
] as const;

const KNOWN: Record<string, ConstellationStyle> = {
  'Sentinel-1': { color: '#E69F00', glyph: 'S1' },
  'RADARSAT-2': { color: '#56B4E9', glyph: 'R2' },
  RCM: { color: '#0072B2', glyph: 'RC' },
  'TerraSAR-X': { color: '#009E73', glyph: 'TX' },
  'TanDEM-X': { color: '#009E73', glyph: 'TD' },
  PAZ: { color: '#F0E442', glyph: 'PZ' },
  'COSMO-SkyMed': { color: '#D55E00', glyph: 'CS' },
  SAOCOM: { color: '#CC79A7', glyph: 'SA' },
  'ALOS-2': { color: '#56B4E9', glyph: 'A2' },
  'ALOS-4': { color: '#56B4E9', glyph: 'A4' },
  'RISAT-1 / EOS-04': { color: '#E69F00', glyph: 'RI' },
  'RISAT-2B': { color: '#F0E442', glyph: 'RB' },
  ICEYE: { color: '#009E73', glyph: 'IC' },
  Capella: { color: '#D55E00', glyph: 'CP' },
  Umbra: { color: '#FFFFFF', glyph: 'UM' },
  StriX: { color: '#CC79A7', glyph: 'SX' },
  'QPS-SAR': { color: '#0072B2', glyph: 'QP' },
  'Gaofen-3': { color: '#F0E442', glyph: 'GF' },
  'HJ-2 SAR': { color: '#CC79A7', glyph: 'HJ' },
  'Lutan-1': { color: '#E69F00', glyph: 'LT' },
  NISAR: { color: '#56B4E9', glyph: 'NI' },
  BIOMASS: { color: '#009E73', glyph: 'BM' },
  'KOMPSAT-5': { color: '#FFFFFF', glyph: 'K5' },
};

const UNKNOWN_STYLE: ConstellationStyle = { color: '#999999', glyph: '··' };

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function constellationStyle(name: string | null | undefined): ConstellationStyle {
  if (!name) return UNKNOWN_STYLE;
  const known = KNOWN[name];
  if (known) return known;
  const letters =
    name
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || '··';
  return { color: PALETTE[hash(name) % PALETTE.length], glyph: letters };
}

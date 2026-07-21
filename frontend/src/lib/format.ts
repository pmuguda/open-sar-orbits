/** Console-style formatting: unknown values render as the design system's `···`. */

export const UNKNOWN = '···';

export function fmt(value: string | number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || value === '') return UNKNOWN;
  return `${value}${suffix}`;
}

export function fmtNum(value: number | null | undefined, digits = 2, suffix = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN;
  return `${value.toFixed(digits)}${suffix}`;
}

export function fmtAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return UNKNOWN;
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86400).toFixed(1)} d`;
}

export function fmtUtc(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

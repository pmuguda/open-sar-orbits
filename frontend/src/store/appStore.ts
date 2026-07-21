import { create } from 'zustand';

import { EMPTY_FILTERS, type Filters } from '../lib/filtering';
import type { MergedSatellite, OmmRecord } from '../types';

export type ViewId = 'global' | 'aoi' | 'about';
export type Theme = 'dark' | 'paper';

export interface CacheMeta {
  fetchedAt: string | null;
  ageSeconds: number | null;
  stale: boolean;
  recordCount: number;
}

interface AppState {
  view: ViewId;
  theme: Theme;

  satellites: MergedSatellite[];
  records: OmmRecord[];
  cacheMeta: CacheMeta;
  loading: boolean;
  error: string | null;

  filters: Filters;
  selectedId: number | null;
  follow: boolean;

  showLabels: boolean;
  showOrbits: boolean;
  showGroundTracks: boolean;
  leftOpen: boolean;
  rightOpen: boolean;

  setView: (view: ViewId) => void;
  setTheme: (theme: Theme) => void;
  setData: (satellites: MergedSatellite[], records: OmmRecord[], meta: CacheMeta) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  select: (id: number | null) => void;
  setFollow: (follow: boolean) => void;
  toggleLayer: (layer: 'labels' | 'orbits' | 'groundTracks') => void;
  togglePanel: (side: 'left' | 'right') => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'global',
  theme: (document.documentElement.dataset.theme as Theme) || 'dark',

  satellites: [],
  records: [],
  cacheMeta: { fetchedAt: null, ageSeconds: null, stale: false, recordCount: 0 },
  loading: true,
  error: null,

  filters: EMPTY_FILTERS,
  selectedId: null,
  follow: false,

  showLabels: true,
  showOrbits: false,
  showGroundTracks: false,
  leftOpen: true,
  rightOpen: true,

  setView: (view) => set({ view }),
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  setData: (satellites, records, cacheMeta) =>
    set({ satellites, records, cacheMeta, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  resetFilters: () => set({ filters: EMPTY_FILTERS }),
  select: (selectedId) =>
    set((state) => ({ selectedId, follow: selectedId ? state.follow : false })),
  setFollow: (follow) => set({ follow }),
  toggleLayer: (layer) =>
    set((state) =>
      layer === 'labels'
        ? { showLabels: !state.showLabels }
        : layer === 'orbits'
          ? { showOrbits: !state.showOrbits }
          : { showGroundTracks: !state.showGroundTracks },
    ),
  togglePanel: (side) =>
    set((state) =>
      side === 'left' ? { leftOpen: !state.leftOpen } : { rightOpen: !state.rightOpen },
    ),
}));

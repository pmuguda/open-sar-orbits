import type { Viewer } from 'cesium';

/**
 * Imperative bridge to the Cesium viewer for the small set of components
 * (clock controls, detail panel) that need direct clock/camera access without
 * routing every tick through React state.
 */
export const globeBridge: { viewer: Viewer | null } = { viewer: null };

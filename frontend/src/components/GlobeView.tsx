import * as Cesium from 'cesium';
import { useEffect, useRef, useState } from 'react';

import { constellationStyle } from '../lib/constellations';
import { filterSatellites } from '../lib/filtering';
import { splitTrackSegments, type TrackSample } from '../lib/groundtrack';
import { useAppStore } from '../store/appStore';
import type { SampleRequest, SampleResponse, SatSamples } from '../workers/orbitWorker';
import { globeBridge } from './globeBridge';

// trajectory window: 90 min past -> 180 min future, 30 s samples
const PAST_MS = 90 * 60 * 1000;
const FUTURE_MS = 180 * 60 * 1000;
const STEP_S = 30;
// resample when the clock gets within these margins of the buffered window
const LEAD_MARGIN_MS = 30 * 60 * 1000;
const TRAIL_MARGIN_MS = 10 * 60 * 1000;

interface CachedSamples extends SatSamples {
  startMs: number;
  stepS: number;
  count: number;
}

function toColor(hex: string): Cesium.Color {
  return Cesium.Color.fromCssColorString(hex);
}

export default function GlobeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const entitiesRef = useRef<Map<number, Cesium.Entity>>(new Map());
  const tracksRef = useRef<Map<number, Cesium.Entity[]>>(new Map());
  const samplesRef = useRef<Map<number, CachedSamples>>(new Map());
  const windowRef = useRef<{ startMs: number; endMs: number } | null>(null);
  const [sampleVersion, setSampleVersion] = useState(0);

  const records = useAppStore((s) => s.records);
  const satellites = useAppStore((s) => s.satellites);
  const filters = useAppStore((s) => s.filters);
  const selectedId = useAppStore((s) => s.selectedId);
  const follow = useAppStore((s) => s.follow);
  const showLabels = useAppStore((s) => s.showLabels);
  const showOrbits = useAppStore((s) => s.showOrbits);
  const showGroundTracks = useAppStore((s) => s.showGroundTracks);
  const select = useAppStore((s) => s.select);
  const setError = useAppStore((s) => s.setError);

  // ── viewer + worker lifecycle ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let viewer: Cesium.Viewer;
    try {
      viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer: Cesium.ImageryLayer.fromProviderAsync(
          Cesium.TileMapServiceImageryProvider.fromUrl(
            Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
          ),
          {},
        ),
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
      });
    } catch {
      setError(
        'WebGL is unavailable in this browser — the 3D globe cannot start. ' +
          'Enable hardware acceleration or try a different browser.',
      );
      return;
    }

    viewer.scene.globe.enableLighting = true; // day/night terminator
    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
    viewer.clock.multiplier = 60;
    viewer.clock.shouldAnimate = true;
    viewerRef.current = viewer;
    globeBridge.viewer = viewer;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked: unknown = viewer.scene.pick(movement.position);
      const entity =
        picked && (picked as { id?: unknown }).id instanceof Cesium.Entity
          ? ((picked as { id: Cesium.Entity }).id as Cesium.Entity)
          : null;
      const norad = entity?.properties?.norad?.getValue() as number | undefined;
      select(typeof norad === 'number' ? norad : null);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    const worker = new Worker(new URL('../workers/orbitWorker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    const entities = entitiesRef.current;
    const tracks = tracksRef.current;
    return () => {
      handler.destroy();
      worker.terminate();
      globeBridge.viewer = null;
      viewerRef.current = null;
      entities.clear();
      tracks.clear();
      viewer.destroy();
    };
  }, [select, setError]);

  // ── sampling: push records to the worker, build entities from samples ──
  useEffect(() => {
    const worker = workerRef.current;
    const viewer = viewerRef.current;
    if (!worker || !viewer || records.length === 0) return;

    const requestSamples = (centerMs: number) => {
      const startMs = centerMs - PAST_MS;
      const endMs = centerMs + FUTURE_MS;
      windowRef.current = { startMs, endMs };
      const request: SampleRequest = { type: 'sample', records, startMs, endMs, stepS: STEP_S };
      worker.postMessage(request);
    };

    worker.onmessage = (event: MessageEvent<SampleResponse>) => {
      const { startMs, stepS, count, sats } = event.data;
      const currentViewer = viewerRef.current;
      if (!currentViewer || currentViewer.isDestroyed()) return;

      const start = Cesium.JulianDate.fromDate(new Date(startMs));
      const stop = Cesium.JulianDate.fromDate(new Date(startMs + (count - 1) * stepS * 1000));
      const availability = new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({ start, stop }),
      ]);
      const byId = new Map(satellites.map((s) => [s.norad_catalog_id, s]));
      const seen = new Set<number>();

      for (const sat of sats) {
        seen.add(sat.noradId);
        samplesRef.current.set(sat.noradId, { ...sat, startMs, stepS, count });

        const position = new Cesium.SampledPositionProperty();
        position.setInterpolationOptions({
          interpolationDegree: 5,
          // Cesium's .d.ts types the static side incorrectly; runtime shape is fine
          interpolationAlgorithm:
            Cesium.LagrangePolynomialApproximation as unknown as Cesium.InterpolationAlgorithm,
        });
        for (let i = 0; i < count; i += 1) {
          const lat = sat.data[i * 3];
          const lon = sat.data[i * 3 + 1];
          const alt = sat.data[i * 3 + 2];
          if (!Number.isFinite(lat)) continue;
          position.addSample(
            Cesium.JulianDate.fromDate(new Date(startMs + i * stepS * 1000)),
            Cesium.Cartesian3.fromDegrees(lon, lat, alt * 1000),
          );
        }

        const merged = byId.get(sat.noradId);
        const style = constellationStyle(merged?.registry?.constellation);
        const color = toColor(style.color);
        const existing = entitiesRef.current.get(sat.noradId);
        if (existing) {
          existing.position = position;
          existing.availability = availability;
        } else {
          const entity = currentViewer.entities.add({
            id: `sat-${sat.noradId}`,
            availability,
            position,
            properties: { norad: sat.noradId },
            point: {
              pixelSize: 6,
              color,
              outlineColor: Cesium.Color.BLACK.withAlpha(0.8),
              outlineWidth: 1,
            },
            label: {
              text: `${style.glyph} · ${merged?.object_name ?? sat.noradId}`,
              font: '11px "IBM Plex Mono", monospace',
              fillColor: Cesium.Color.fromCssColorString('#e0e0e3'),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(10, -10),
              horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
              show: true,
            },
            path: {
              show: false,
              width: 1.2,
              resolution: 120,
              material: color.withAlpha(0.55),
              leadTime: FUTURE_MS / 1000,
              trailTime: PAST_MS / 1000,
            },
          });
          entitiesRef.current.set(sat.noradId, entity);
        }
      }

      // drop entities for satellites no longer in the cached group
      for (const [norad, entity] of entitiesRef.current) {
        if (!seen.has(norad)) {
          currentViewer.entities.remove(entity);
          entitiesRef.current.delete(norad);
          samplesRef.current.delete(norad);
        }
      }
      setSampleVersion((v) => v + 1);
    };

    requestSamples(Date.now());

    // resample when the simulation clock nears the edge of the buffer
    const timer = window.setInterval(() => {
      const currentViewer = viewerRef.current;
      const window_ = windowRef.current;
      if (!currentViewer || currentViewer.isDestroyed() || !window_) return;
      const clockMs = Cesium.JulianDate.toDate(currentViewer.clock.currentTime).getTime();
      if (clockMs > window_.endMs - LEAD_MARGIN_MS || clockMs < window_.startMs + TRAIL_MARGIN_MS) {
        requestSamples(clockMs);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [records, satellites]);

  // ── visibility from filters ────────────────────────────────────────────
  useEffect(() => {
    const visible = new Set(filterSatellites(satellites, filters).map((s) => s.norad_catalog_id));
    for (const [norad, entity] of entitiesRef.current) {
      entity.show = visible.has(norad);
    }
  }, [satellites, filters, sampleVersion]);

  // ── layer toggles + selection styling ──────────────────────────────────
  useEffect(() => {
    for (const [norad, entity] of entitiesRef.current) {
      const isSelected = norad === selectedId;
      if (entity.label) entity.label.show = new Cesium.ConstantProperty(showLabels || isSelected);
      if (entity.path) entity.path.show = new Cesium.ConstantProperty(showOrbits || isSelected);
      if (entity.point) {
        entity.point.pixelSize = new Cesium.ConstantProperty(isSelected ? 10 : 6);
        entity.point.outlineColor = new Cesium.ConstantProperty(
          isSelected ? Cesium.Color.WHITE : Cesium.Color.BLACK.withAlpha(0.8),
        );
        entity.point.outlineWidth = new Cesium.ConstantProperty(isSelected ? 2 : 1);
      }
    }
  }, [showLabels, showOrbits, selectedId, sampleVersion]);

  // ── ground tracks ──────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const visible = new Set(filterSatellites(satellites, filters).map((s) => s.norad_catalog_id));
    const wanted = new Set<number>();
    if (showGroundTracks) for (const id of visible) wanted.add(id);
    if (selectedId !== null && visible.has(selectedId)) wanted.add(selectedId);

    // rebuild from scratch: samples may have moved to a new time window
    for (const [, entities] of tracksRef.current) {
      entities.forEach((e) => viewer.entities.remove(e));
    }
    tracksRef.current.clear();

    const byId = new Map(satellites.map((s) => [s.norad_catalog_id, s]));
    for (const norad of wanted) {
      const cached = samplesRef.current.get(norad);
      if (!cached) continue;
      const samples: TrackSample[] = [];
      for (let i = 0; i < cached.count; i += 1) {
        const lat = cached.data[i * 3];
        const lon = cached.data[i * 3 + 1];
        if (Number.isFinite(lat)) samples.push({ latDeg: lat, lonDeg: lon });
      }
      const style = constellationStyle(byId.get(norad)?.registry?.constellation);
      const color = toColor(style.color).withAlpha(0.45);
      const segmentEntities = splitTrackSegments(samples).map((flat, index) =>
        viewer.entities.add({
          id: `track-${norad}-${index}`,
          properties: { norad },
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(flat),
            width: 1.5,
            material: color,
            clampToGround: false,
          },
        }),
      );
      tracksRef.current.set(norad, segmentEntities);
    }
  }, [showGroundTracks, selectedId, satellites, filters, sampleVersion]);

  // ── camera follow ──────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.trackedEntity =
      follow && selectedId !== null ? entitiesRef.current.get(selectedId) : undefined;
  }, [follow, selectedId, sampleVersion]);

  return <div ref={containerRef} className="absolute inset-0" aria-label="3D globe" />;
}

// Web-Mercator math for a library-free map: which 256 px OpenStreetMap tiles cover a set of points,
// and where each point lands on them. Pixel coordinates are "world pixels" at a zoom level
// (the whole world is 256 · 2^zoom px wide).

export const TILE_SIZE = 256;
export const MAX_ZOOM = 16;
/** Zoom for a single point (or points closer than a few meters): a neighbourhood. */
export const SINGLE_POINT_ZOOM = 13;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapView {
  zoom: number;
  /** world-pixel coordinates of the view's top-left corner */
  left: number;
  top: number;
  width: number;
  height: number;
}

const MAX_LAT = 85.05112878;

export function worldPixel({ lat, lng }: LatLng, zoom: number): { x: number; y: number } {
  const size = TILE_SIZE * 2 ** zoom;
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** The highest zoom where every point fits inside width × height (minus a margin), centred on them. */
export function fitView(points: LatLng[], width: number, height: number, margin = 24): MapView {
  if (points.length === 0) return { zoom: 1, left: 0, top: 0, width, height };
  let zoom = MAX_ZOOM;
  for (; zoom > 1; zoom--) {
    const px = points.map((p) => worldPixel(p, zoom));
    const spanX = Math.max(...px.map((p) => p.x)) - Math.min(...px.map((p) => p.x));
    const spanY = Math.max(...px.map((p) => p.y)) - Math.min(...px.map((p) => p.y));
    if (spanX <= width - 2 * margin && spanY <= height - 2 * margin) break;
  }
  if (points.length === 1 || zoom > SINGLE_POINT_ZOOM) zoom = Math.min(zoom, SINGLE_POINT_ZOOM);
  const px = points.map((p) => worldPixel(p, zoom));
  const cx = (Math.max(...px.map((p) => p.x)) + Math.min(...px.map((p) => p.x))) / 2;
  const cy = (Math.max(...px.map((p) => p.y)) + Math.min(...px.map((p) => p.y))) / 2;
  return { zoom, left: cx - width / 2, top: cy - height / 2, width, height };
}

/** Where a point sits inside the view, in px from its top-left. */
export function placeInView(point: LatLng, view: MapView): { x: number; y: number } {
  const p = worldPixel(point, view.zoom);
  return { x: p.x - view.left, y: p.y - view.top };
}

/** Tiles covering the view, each with its position inside the view (wraps around in longitude). */
export function tilesForView(view: MapView): { x: number; y: number; z: number; left: number; top: number }[] {
  const count = 2 ** view.zoom;
  const tiles = [];
  for (let ty = Math.floor(view.top / TILE_SIZE); ty * TILE_SIZE < view.top + view.height; ty++) {
    if (ty < 0 || ty >= count) continue;
    for (let tx = Math.floor(view.left / TILE_SIZE); tx * TILE_SIZE < view.left + view.width; tx++) {
      tiles.push({ x: ((tx % count) + count) % count, y: ty, z: view.zoom, left: tx * TILE_SIZE - view.left, top: ty * TILE_SIZE - view.top });
    }
  }
  return tiles;
}

/** Location answers are stored at 3 decimals (~100 m): enough for a map dot, not a home address. */
export const roundCoord = (value: number) => Math.round(value * 1000) / 1000;

export function parseLatLng(value: unknown): LatLng | null {
  if (typeof value !== "string") return null;
  const m = /^(-?\d{1,2}(?:\.\d{1,3})?),(-?\d{1,3}(?:\.\d{1,3})?)$/.exec(value);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export const formatLatLng = ({ lat, lng }: LatLng) => `${roundCoord(lat)},${roundCoord(lng)}`;

/** Inverse of `placeInView`: the coordinates under a pixel (x, y from the view's top-left), e.g. a tap on the map. */
export function latLngAt(view: MapView, x: number, y: number): LatLng {
  const size = TILE_SIZE * 2 ** view.zoom;
  const worldX = (((view.left + x) % size) + size) % size;
  const worldY = Math.max(0, Math.min(size, view.top + y));
  const lng = (worldX / size) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * worldY) / size))) * 180) / Math.PI;
  return { lat, lng };
}

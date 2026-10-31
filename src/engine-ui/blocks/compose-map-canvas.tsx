"use client";
// A library-free map: OpenStreetMap tiles as absolutely positioned <img> inside a box that is as wide
// as its container (height ≈ 60% of that), with the caller's dots on top and the required attribution.
// Tiles are fetched straight from OSM by the viewer's browser; each tile image sends only our origin as referrer (OSM tile policy), never the page path.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { latLngAt, tilesForView, type LatLng, type MapView } from "@/engine/geo/web-mercator-tiles";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";

const ASPECT = 0.6;
const FALLBACK_WIDTH = 320;
/** Smallest drawn view; below this the layout isn't measured yet. */
const MIN_WIDTH = 120;

/** `makeView(width, height)` picks the zoom/centre (fit to points, or a fixed region for tap-to-choose). */
export function ComposeMapCanvas(props: {
  makeView: (width: number, height: number) => MapView;
  locale: UiLocale;
  /** minimum height in px (big projector maps pass a larger one) */
  minHeight?: number;
  onTap?: (point: LatLng) => void;
  ariaLabel?: string;
  children: (view: MapView) => ReactNode;
}) {
  const { makeView, locale, onTap, ariaLabel, children } = props;
  const s = t(locale);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(MIN_WIDTH, Math.round(el.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = Math.max(props.minHeight ?? 0, Math.round(width * ASPECT));
  const view = makeView(width, height);

  function tap(e: React.MouseEvent<HTMLDivElement>) {
    if (!onTap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onTap(latLngAt(view, e.clientX - rect.left, e.clientY - rect.top));
  }

  return (
    <div>
      <div
        ref={box}
        className={`map-box${onTap ? " tappable" : ""}`}
        style={{ height }}
        onClick={tap}
        role={onTap ? "button" : "img"}
        aria-label={ariaLabel}
        data-testid="map-box"
      >
        {tilesForView(view).map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element -- plain tiles from OSM; next/image would proxy them
          <img
            key={`${tile.z}/${tile.x}/${tile.y}/${Math.round(tile.left)}`}
            src={`https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`}
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            alt=""
            draggable={false}
            style={{ left: tile.left, top: tile.top }}
          />
        ))}
        {children(view)}
      </div>
      <div className="muted map-attribution">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">{s.composeMapAttribution}</a>
      </div>
    </div>
  );
}

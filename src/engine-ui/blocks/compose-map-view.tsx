"use client";
// Map view: every place answer as a dot on an OpenStreetMap map fitted to the points. The viewer's own
// dot is highlighted; names show beside the dots while there are few, and as a hover/long-press title
// always.
import type { ComposeViewResult } from "@/engine/api/api-contract-types";
import { fitView, placeInView } from "@/engine/geo/web-mercator-tiles";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { ComposeMapCanvas } from "./compose-map-canvas";

type MapResult = Extract<ComposeViewResult, { kind: "map" }>;

/** Beyond this many dots the labels would overlap, so only titles remain. */
const MAX_LABELLED = 12;
const BIG_MIN_HEIGHT = 420;

export function ComposeMapView({ view, locale, big }: { view: MapResult; locale: UiLocale; big: boolean }) {
  const s = t(locale);
  if (view.points.length === 0) return <p className="muted" style={{ margin: 0 }}>{s.composeMapEmpty}</p>;
  const labelled = view.points.length <= MAX_LABELLED;
  return (
    <ComposeMapCanvas makeView={(w, h) => fitView(view.points, w, h)} locale={locale} minHeight={big ? BIG_MIN_HEIGHT : undefined} ariaLabel={view.title || undefined}>
      {(mapView) =>
        view.points.map((p, i) => {
          const at = placeInView(p, mapView);
          const label = p.name && (labelled || p.mine) ? p.name : null;
          return (
            <span key={i}>
              <span className={`map-dot${p.mine ? " mine" : ""}`} style={{ left: at.x, top: at.y }} title={p.name ?? undefined} />
              {label && <span className="map-label" style={{ left: at.x, top: at.y }}>{label}</span>}
            </span>
          );
        })
      }
    </ComposeMapCanvas>
  );
}

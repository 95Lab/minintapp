"use client";
// Place input on the phone: an explicit tap on "use my location" (browser geolocation, no high accuracy,
// 10 s timeout) or a tap on a small map. Either way the point is rounded to ~100 m here, before it is
// ever sent. The value is the "lat,lng" string; nothing is requested until the person taps.
import { useState, type ReactNode } from "react";
import { formatLatLng, parseLatLng, placeInView, type LatLng, type MapView } from "@/engine/geo/web-mercator-tiles";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import { ComposeMapCanvas } from "./compose-map-canvas";

const GEOLOCATION_TIMEOUT_MS = 10_000;
/** Where the tap-to-choose map opens when there is no point yet: all of Việt Nam. */
const VIETNAM_CENTER: LatLng = { lat: 16.2, lng: 106.3 };
const VIETNAM_ZOOM = 5;
const POINT_ZOOM = 12;

function viewAround(center: LatLng, zoom: number, width: number, height: number): MapView {
  // Centre via the same projection the map uses: place the centre, then shift so it sits mid-box.
  const probe: MapView = { zoom, left: 0, top: 0, width, height };
  const c = placeInView(center, probe);
  return { ...probe, left: c.x - width / 2, top: c.y - height / 2 };
}

export function ComposePlaceField(props: { fieldId: string; label: ReactNode; value: string; onChange: (value: string) => void; disabled: boolean; locale: UiLocale }) {
  const { fieldId, label, value, onChange, disabled, locale } = props;
  const s = t(locale);
  const point = parseLatLng(value);
  // The map stays where it opened (a tap must not make it jump); it re-centres only on a located point.
  const [anchor, setAnchor] = useState<LatLng | null>(point);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  function shareMyLocation() {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    setLocating(true);
    setDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setAnchor(here);
        onChange(formatLatLng(here));
      },
      () => {
        setLocating(false);
        setDenied(true);
      },
      { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 60_000 },
    );
  }

  return (
    <div className="field place-field" id={fieldId}>
      {label}
      <div className="place-actions">
        <button type="button" className="btn btn-sm" onClick={shareMyLocation} disabled={disabled || locating}>
          {s.composePlaceUse}
        </button>
        {point && (
          <button type="button" className="btn btn-sm" onClick={() => onChange("")} disabled={disabled}>
            {s.composePlaceClear}
          </button>
        )}
      </div>
      <div className="muted" style={{ fontSize: 14 }}>{s.composePlaceTap}</div>
      <ComposeMapCanvas
        makeView={(w, h) => viewAround(anchor ?? VIETNAM_CENTER, anchor ? POINT_ZOOM : VIETNAM_ZOOM, w, h)}
        locale={locale}
        ariaLabel={s.composePlaceTap}
        onTap={disabled ? undefined : (p) => onChange(formatLatLng(p))}
      >
        {(mapView) => {
          if (!point) return null;
          const at = placeInView(point, mapView);
          return <span className="map-dot mine" style={{ left: at.x, top: at.y }} data-testid="place-dot" />;
        }}
      </ComposeMapCanvas>
      <div id={`${fieldId}-status`} className="muted" role="status" style={{ fontSize: 14 }}>
        {denied ? s.composePlaceDenied : point ? `${s.composePlaceChosen} (${formatLatLng(point)})` : ""}
      </div>
    </div>
  );
}

"use client";
// The host's one-line announcement, shown at the top of every screen. Dismissing hides it until the host
// sends a newer one (remembered per tab in sessionStorage). A newer one on a phone also vibrates and plays a
// short chime — only once the person has touched the page, because browsers block sound and vibration before that.
import { useEffect, useRef, useState } from "react";
import type { AppStateResponse } from "@/engine/api/api-contract-types";
import type { Locale } from "@/engine/app-spec/app-spec-schema";
import { t } from "@/engine/i18n/ui-strings-vi-en";

type Announcement = NonNullable<AppStateResponse["announcement"]>;

const storageKey = (kind: "seen" | "dismissed", appId: string) => `minint-announcement-${kind}-${appId}`;

function readNumber(key: string): number {
  try {
    return Number(sessionStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    // storage blocked (private mode): the banner just comes back after a reload
  }
}

/** Keeps one AudioContext, created/resumed on the first touch so a later chime is allowed to play. */
function useUserGestureAudio() {
  const ctx = useRef<AudioContext | null>(null);
  const touched = useRef(false);
  useEffect(() => {
    const unlock = () => {
      touched.current = true;
      try {
        ctx.current ??= new AudioContext();
        void ctx.current.resume();
      } catch {
        // no WebAudio: the banner still shows, silently
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  return () => {
    if (!touched.current) return;
    try {
      navigator.vibrate?.(200);
    } catch {
      // vibration unsupported or blocked
    }
    const audio = ctx.current;
    if (!audio || audio.state !== "running") return;
    // two soft rising notes, ~0.3 s in total
    [660, 880].forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + i * 0.15;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  };
}

export function AnnouncementBanner({ appId, announcement, locale, quiet = false }: { appId: string; announcement: Announcement | null; locale: Locale; quiet?: boolean }) {
  const s = t(locale);
  const alert = useUserGestureAudio();
  const [dismissedAt, setDismissedAt] = useState(0);
  const at = announcement?.at ?? 0;

  useEffect(() => setDismissedAt(readNumber(storageKey("dismissed", appId))), [appId]);

  // Alert once per announcement per tab; the sender (quiet) never needs to hear their own message.
  useEffect(() => {
    if (!at || at <= readNumber(storageKey("seen", appId))) return;
    writeNumber(storageKey("seen", appId), at);
    if (!quiet) alert();
  }, [at, appId, quiet]);

  if (!announcement || at <= dismissedAt) return null;
  const time = new Date(at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="announcement" role="status" aria-live="polite" data-testid="announcement-banner">
      <div className="announcement-body">
        <strong>{announcement.text}</strong>
        <span className="muted">{s.announcementAt.replace("{time}", time)}</span>
      </div>
      <button
        type="button"
        className="announcement-dismiss"
        aria-label={s.announcementDismiss}
        onClick={() => {
          writeNumber(storageKey("dismissed", appId), at);
          setDismissedAt(at);
        }}
      >
        ×
      </button>
    </div>
  );
}

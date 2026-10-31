"use client";
// Live brick UI: a read-only weather card or exchange-rate card (with a two-way converter). The same
// card shows on the host and on phones; there is nothing to answer. Data comes from the server
// (results.data); null means the upstream could not be reached.
import { useState } from "react";
import type { FxData, LiveResults, WeatherData } from "@/engine/api/api-contract-types";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import { weatherKind } from "@/engine/live-data/live-data-fetchers";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";
import type { HostBlockProps, ParticipantBlockProps } from "./block-ui-types";

type Live = Extract<PublicBlock, { type: "live" }>;

const ICON = { clear: "☀", cloudy: "☁", fog: "≋", rain: "☂", storm: "⚡", snow: "❄" } as const;
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (ms: number) => `${pad(new Date(ms).getHours())}:${pad(new Date(ms).getMinutes())}`;

function WeatherCard({ data, locale }: { data: WeatherData; locale: UiLocale }) {
  const s = t(locale);
  const now = weatherKind(data.nowCode);
  const weekday = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "numeric" });
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 18 }}>{data.place}</strong>
        <span className="muted">{s.liveNow}</span>
        <span className="num" style={{ fontSize: 32, fontWeight: 700 }}>
          {ICON[now]} {Math.round(data.nowTemp)}°
        </span>
        <span className="muted">{s.liveWeather[now]}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        {data.days.map((d) => {
          const kind = weatherKind(d.code);
          return (
            <div key={d.date} className="card p-card" style={{ display: "grid", gap: 4, textAlign: "center" }}>
              <div className="muted">{weekday(d.date)}</div>
              <div style={{ fontSize: 22 }} title={s.liveWeather[kind]}>{ICON[kind]}</div>
              <div className="num">
                {Math.round(d.max)}° / {Math.round(d.min)}°
              </div>
              {d.rainChance !== null && <div className="muted num">{s.liveRain(Math.round(d.rainChance))}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FxCard({ data, locale }: { data: FxData; locale: UiLocale }) {
  const s = t(locale);
  const [base, setBase] = useState("1");
  const [quote, setQuote] = useState(plain(data.rate));
  // Typing in one box fills the other; an unparseable box clears it.
  const parse = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));
  const convert = (v: string, factor: number) => (v.trim() !== "" && Number.isFinite(parse(v)) ? plain(parse(v) * factor) : "");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>
        {s.liveRate(data.base, format(data.rate, locale), data.quote)}
      </div>
      <div className="muted">{s.liveConvert}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 120 }}
          inputMode="decimal"
          aria-label={data.base}
          value={base}
          onChange={(e) => {
            setBase(e.target.value);
            setQuote(convert(e.target.value, data.rate));
          }}
        />
        <span>{data.base}</span>
        <span aria-hidden>=</span>
        <input
          className="input"
          style={{ flex: 1, minWidth: 120 }}
          inputMode="decimal"
          aria-label={data.quote}
          value={quote}
          onChange={(e) => {
            setQuote(e.target.value);
            setBase(convert(e.target.value, 1 / data.rate));
          }}
        />
        <span>{data.quote}</span>
      </div>
    </div>
  );
}

/** Editable text for a box: no grouping (so it parses back), at most 8 significant digits. */
const plain = (n: number) => n.toLocaleString("en-US", { useGrouping: false, maximumSignificantDigits: 8 });

/** 4 significant digits for tiny rates (0.00004), at most 2 decimals for big amounts. */
function format(n: number, locale: UiLocale): string {
  return new Intl.NumberFormat(locale, n >= 1 ? { maximumFractionDigits: 2 } : { maximumSignificantDigits: 4 }).format(n);
}

function LiveCard({ results, locale }: { results: LiveResults | null; locale: UiLocale }) {
  const s = t(locale);
  const data = results?.data ?? null;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {data === null ? (
        <div className="muted" role="status">{s.liveUnavailable}</div>
      ) : (
        <>
          {data.kind === "weather" ? <WeatherCard data={data} locale={locale} /> : <FxCard key={`${data.base}${data.quote}`} data={data} locale={locale} />}
          <div className="muted num" style={{ fontSize: 13 }}>
            {s.liveUpdatedAt(clock(data.fetchedAt))}
            {data.sample && <strong> · {s.liveSample}</strong>}
          </div>
        </>
      )}
    </div>
  );
}

export function LiveBlockHost({ block, results, locale }: HostBlockProps<Live, LiveResults>) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="big-q" style={{ marginBottom: 0 }}>{block.title}</div>
      <LiveCard results={results} locale={locale} />
    </div>
  );
}

export function LiveBlock({ block, results, locale }: ParticipantBlockProps<Live, LiveResults>) {
  return (
    <section className="card p-card">
      <h2 style={{ fontSize: 21 }}>{block.title}</h2>
      <LiveCard results={results} locale={locale} />
    </section>
  );
}

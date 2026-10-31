"use client";
// Custom brick UI: the AI-written page runs in <iframe sandbox="allow-scripts"> loaded from
// /sandbox/[appId]/[blockId] (opaque origin, CSP without network — see src/lib/blocks/custom). The
// page and this component talk through postMessage only: we accept a message solely from THIS
// iframe's window, validate everything it sends, and hand it the room state on ready and on change.
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { CustomResults } from "@/engine/api/api-contract-types";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import { CustomPayloadSchema, type CustomPayload } from "@/engine/blocks/custom/custom-block";
import { t } from "@/engine/i18n/ui-strings-vi-en";
import type { HostBlockProps, ParticipantBlockProps } from "./block-ui-types";

type Custom = Extract<PublicBlock, { type: "custom" }>;

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 2000;

const FromPageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("minint:ready") }),
  z.object({ type: z.literal("minint:submit"), value: z.unknown() }),
  z.object({ type: z.literal("minint:resize"), height: z.number().finite() }),
]);

interface FrameProps {
  appId: string;
  block: Custom;
  results: CustomResults | null;
  role: "host" | "participant";
  meName: string | null;
  title: string;
  /** undefined: this viewer cannot submit (host, or the app is closed) */
  onSubmit?: (value: CustomPayload["value"]) => void;
}

function CustomFrame({ appId, block, results, role, meName, title, onSubmit }: FrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(360);
  const state = { role, me: meName === null ? null : { name: meName }, answers: results?.answers ?? [], count: results?.count ?? 0 };
  const stateRef = useRef(state);
  const submitRef = useRef(onSubmit);
  // declared before the effect that posts the state, so it always posts the latest
  useEffect(() => {
    stateRef.current = state;
    submitRef.current = onSubmit;
  });

  const postState = useCallback(() => {
    // "*": the sandboxed page has an opaque origin, so there is no origin to name; the state is not secret from it.
    frameRef.current?.contentWindow?.postMessage({ type: "minint:state", state: stateRef.current }, "*");
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const msg = FromPageSchema.safeParse(event.data);
      if (!msg.success) return;
      if (msg.data.type === "minint:ready") postState();
      else if (msg.data.type === "minint:resize") setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(msg.data.height))));
      else if (submitRef.current) {
        const payload = CustomPayloadSchema.safeParse({ kind: "custom", value: msg.data.value });
        if (payload.success) submitRef.current(payload.data.value);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postState]);

  // every change of the room state (new answers, role, name) reaches the page
  const stateKey = JSON.stringify(state);
  useEffect(postState, [stateKey, postState]);

  return (
    <iframe
      ref={frameRef}
      title={title}
      src={`/sandbox/${encodeURIComponent(appId)}/${encodeURIComponent(block.id)}`}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      style={{ width: "100%", height, border: 0, borderRadius: 12, background: "#fff", display: "block" }}
    />
  );
}

export function CustomBlockHost({ block, results, locale, appId }: HostBlockProps<Custom, CustomResults>) {
  const s = t(locale);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="big-q" style={{ marginBottom: 0 }}>{block.title}</div>
      <CustomFrame appId={appId} block={block} results={results} role="host" meName={null} title={s.customFrameTitle} />
      <div className="muted num">{s.customSubmissions(results?.count ?? 0)}</div>
    </div>
  );
}

export function CustomBlock({ block, results, open, locale, appId, displayName, onSubmit }: ParticipantBlockProps<Custom, CustomResults>) {
  const s = t(locale);
  return (
    <section className="card p-card">
      <h2 style={{ fontSize: 21 }}>{block.title}</h2>
      <CustomFrame
        appId={appId}
        block={block}
        results={results}
        role="participant"
        meName={displayName}
        title={s.customFrameTitle}
        onSubmit={open ? (value) => void onSubmit("", { kind: "custom", value }) : undefined}
      />
    </section>
  );
}

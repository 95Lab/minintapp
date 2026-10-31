"use client";
// Tab bar for apps with `layout: "tabs"`: one block shown at a time. The chosen tab lives in the URL
// hash (#<blockId>) so a host can share a link to it; the host token (#k=…) never matches a block id.
import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import type { PublicBlock } from "@/engine/app-spec/strip-private-fields";
import type { AppRuntime } from "@/engine/blocks/block-definition-types";

type SpecBlock = PublicBlock;

/** Tab label: the block's own title (compose/wheel…), else its first question, else its position. */
export function blockTabLabel(block: SpecBlock, index: number): string {
  const b = block as { title?: unknown; questions?: { prompt?: unknown }[] };
  if (typeof b.title === "string" && b.title.trim()) return b.title.trim();
  const q = b.questions?.[0]?.prompt;
  if (typeof q === "string" && q.trim()) return q.trim();
  return String(index + 1);
}

/** Ids of blocks that have a host-opened step right now (an open quiz question). */
export function blocksWithOpenStep(blocks: SpecBlock[], runtime: AppRuntime): Set<string> {
  const open = runtime.openQuestionId;
  const ids = new Set<string>();
  if (!open) return ids;
  for (const b of blocks) if (b.type === "quiz" && b.questions.some((q) => q.id === open)) ids.add(b.id);
  return ids;
}

/** Block id named by a URL hash ("#<id>"), or null; a malformed escape like "#%E0" never throws. */
export function hashBlockId(blocks: SpecBlock[], hash: string): string | null {
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
  return blocks.some((b) => b.id === id) ? id : null;
}

export function AppPagesTabs({ blocks, badgeIds, render }: { blocks: SpecBlock[]; badgeIds?: Set<string>; render: (block: SpecBlock, index: number) => ReactNode }) {
  const [activeId, setActiveId] = useState(blocks[0].id);

  // Read the hash after mount (server render has none) and follow back/forward-style hash changes.
  useEffect(() => {
    const sync = () => {
      const id = hashBlockId(blocks, window.location.hash);
      if (id) setActiveId(id);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [blocks]);

  const select = useCallback((id: string) => {
    setActiveId(id);
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${encodeURIComponent(id)}`);
  }, []);

  const found = blocks.findIndex((b) => b.id === activeId);
  const activeIndex = found >= 0 ? found : 0;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const edge = e.key === "Home" ? 0 : e.key === "End" ? blocks.length - 1 : null;
    if (!step && edge === null) return;
    e.preventDefault();
    const next = edge ?? (activeIndex + step + blocks.length) % blocks.length;
    select(blocks[next].id);
    document.getElementById(`tab-${blocks[next].id}`)?.focus();
  }

  const active = blocks[activeIndex];
  return (
    <>
      <div className="tabbar" role="tablist" onKeyDown={onKeyDown}>
        {blocks.map((b, i) => (
          <button
            key={b.id}
            id={`tab-${b.id}`}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-controls={`tabpanel-${b.id}`}
            tabIndex={i === activeIndex ? 0 : -1}
            className="tab"
            onClick={() => select(b.id)}
          >
            <span className="tab-label">{blockTabLabel(b, i)}</span>
            {badgeIds?.has(b.id) && <span className="tab-dot" role="img" aria-label="•" />}
          </button>
        ))}
      </div>
      <div id={`tabpanel-${active.id}`} role="tabpanel" aria-labelledby={`tab-${active.id}`} className="tabpanel">
        {render(active, activeIndex)}
      </div>
    </>
  );
}

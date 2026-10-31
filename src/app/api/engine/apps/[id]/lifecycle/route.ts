import {secureRoute} from "@/engine/api/secure-route";
// POST /api/engine/apps/[id]/lifecycle (host)
//  close    → stop accepting answers, results stay visible
//  end      → delete participant answers now, app shows "ended" everywhere
//  reopen   → take answers again after a close (not for an app that moved on to a remix)
//  extend   → keep the app longer: expiry + 1h / 24h / 7d, at most 30 days after creation (90 for an app owned by a signed-in host)
//  announce → one short message shown to everyone (text null clears it); scanned and rate limited
//  payee    → the bank account a settle-up view's QR pays into (null clears it); host token only
//  redirect → send participants to another app the host also owns (demo plan B)
import { NextResponse } from "next/server";
import { LifecycleRequestSchema, parseBody } from "@/engine/api/request-schemas";
import { appsRepository, isUsable, maxLifetimeMs } from "@/engine/db/apps-repository";
import { LIFETIME_MS } from "@/engine/api/api-contract-types";
import { PayeeInputSchema } from "@/engine/money/payee";
import { broadcastAppChanged } from "@/engine/realtime/broadcast-app-changed";
import { checkRateLimit, isObviousPhishingPrompt, moderatePrompt, tokenMatchesHash } from "@/engine/security/security-interfaces";
import { isHostRequest, jsonError, resolveUsableApp } from "@/engine/api/route-helpers";
import { ACCOUNT_NUMBER_REGEX, URL_LIKE_REGEX } from "@/engine/security/phishing-keywords-vi-en";
import { readSession } from "@/engine/auth/host-session";

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resolved = await resolveUsableApp(id);
  if ("gone" in resolved) return resolved.gone;
  const { app } = resolved;
  if (!isHostRequest(req, app)) return jsonError(403, "host_only");

  const body = await parseBody(req, LifecycleRequestSchema);
  if (!body) return jsonError(400, "bad_action");
  const repo = appsRepository();
  let status = app.status;
  if (body.action === "close") {
    await repo.updateApp(app.id, { status: "closed" });
    status = "closed";
  } else if (body.action === "end") {
    await repo.endApp(app.id);
    status = "ended";
  } else if (body.action === "reopen") {
    if (app.status !== "closed" || app.movedTo) return jsonError(409, "app_cannot_reopen");
    await repo.updateApp(app.id, { status: "active" });
    status = "active";
  } else if (body.action === "extend") {
    const lifetimeCap = maxLifetimeMs(app);
    const cap = app.createdAt + lifetimeCap;
    const until = Math.min(Math.max(app.expiresAt, Date.now()) + LIFETIME_MS[body.by], cap);
    if (until <= app.expiresAt || !(await repo.extendApp(app.id, until))) return jsonError(409, "lifetime_max", { days: lifetimeCap / 86_400_000 });
  } else if (body.action === "announce") {
    // Host-typed text reaches every phone. Setting and clearing both bump the version and broadcast, so both are rate limited.
    if (!(await checkRateLimit("announce", app.id)).ok) return jsonError(429, "announce_rate_limited");
    // Same rules as the text of an app: no links, no account numbers (those only come from the payee form),
    // then the phishing / moderation check of a remix instruction.
    if (body.text !== null && (URL_LIKE_REGEX.test(body.text) || ACCOUNT_NUMBER_REGEX.test(body.text) || isObviousPhishingPrompt(body.text) || !(await moderatePrompt(body.text)).ok)) {
      return jsonError(422, "announce_refused");
    }
    if (!(await repo.setAnnouncement(app.id, body.text === null ? null : { text: body.text, at: Date.now() }))) return jsonError(409, "app_ended_or_moved");
  } else if (body.action === "payee") {
    // The only way a bank account gets into an app: the host's own request. Never part of a spec or an AI answer.
    const payee = body.payee === null ? null : PayeeInputSchema.safeParse(body.payee);
    if (payee && !payee.success) return jsonError(422, "payee_invalid");
    if (payee && !app.spec.blocks.some((b) => b.type === "compose" && b.views.some((v) => v.kind === "settle"))) return jsonError(409, "payee_needs_settle_view");
    if (!(await repo.setPayee(app.id, payee ? payee.data : null))) return jsonError(409, "app_ended_or_moved");
  } else {
    const target = await repo.findApp(body.toId);
    // Only redirect to an app this host also owns, and never into an app that itself redirects (no loops).
    if (!isUsable(target) || target.id === app.id || target.movedTo || !(tokenMatchesHash(body.toHostToken, target.hostTokenHash) || (!!target.ownerId && target.ownerId === readSession(req)?.userId))) {
      return jsonError(403, "move_target_not_host");
    }
    if (!(await repo.markMoved(app.id, target.id))) return jsonError(409, "app_moved");
    status = "closed";
  }
  await broadcastAppChanged(app.id, "control");
  return NextResponse.json({ ok: true, status });
}

export const POST=(...args:Parameters<typeof handlePOST>)=>secureRoute(args[0],()=>handlePOST(...args));

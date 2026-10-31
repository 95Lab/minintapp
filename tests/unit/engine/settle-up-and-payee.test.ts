// Settle-up view and the host's payee: wiring, balances / transfers (incl. "split among"), the viewer's
// own flags, paid / received marks, payee validation and access (host token only, never the AI), the QR
// text, and the phishing scan's stance on account numbers in generated text.
import { beforeEach, describe, expect, it } from "vitest";
import { POST as blockAction } from "@/app/api/engine/apps/[id]/block-action/route";
import { POST as lifecycle } from "@/app/api/engine/apps/[id]/lifecycle/route";
import { POST as respond } from "@/app/api/engine/apps/[id]/responses/route";
import { GET as getState } from "@/app/api/engine/apps/[id]/state/route";
import { AppSpecSchema, type ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { exampleSettleTrip } from "@/engine/app-spec/app-spec-examples-compose-settle";
import { exampleWorkshopVote } from "@/engine/app-spec/app-spec-examples";
import { appsRepository, participantHashFor, resetMemoryStore, type AppRecord } from "@/engine/db/apps-repository";
import type { AnswerRow, AppRuntime } from "@/engine/blocks/block-definition-types";
import { composeBlock, type ComposePayload } from "@/engine/blocks/compose/compose-block";
import { ComposePayloadSchema, PAID_ITEM_ID } from "@/engine/blocks/compose/compose-atoms-schema";
import { computeComposeResults } from "@/engine/blocks/compose/compose-results";
import { composeHostActions, receivedPayments } from "@/engine/blocks/compose/compose-runtime-state";
import { normalizeAccountName, PayeeInputSchema } from "@/engine/money/payee";
import { amountOwedBy, isVndUnit, paymentNote, paymentQrText } from "@/engine/money/settle-payment-qr";
import { crc16Ccitt } from "@/engine/money/vietqr-payload";
import { resetRateLimitMemoryStoreForTests } from "@/engine/security/rate-limit-memory-store";
import { scanAppSpecPhishing } from "@/engine/security/scan-app-spec-phishing";
import { runtimeSpec } from "./runtime-spec-test-helper";

const runtime: AppRuntime = { openQuestionId: null, revealedQuestionIds: [] };
const draftBlock = () => structuredClone(exampleSettleTrip) as unknown as { blocks: Array<Record<string, unknown>> };
const settle = AppSpecSchema.parse(structuredClone(exampleSettleTrip)).blocks[0] as ComposeBlock;
const hash = (c: string) => c.repeat(64);
const rid = (c: string) => c.repeat(12);
let at = 0;
const answer = (who: string, itemId: string, payload: Omit<ComposePayload, "kind">): AnswerRow<ComposePayload> => ({
  blockId: settle.id,
  itemId,
  participantHash: hash(who),
  displayName: who.toUpperCase(),
  payload: { kind: "compose", ...payload },
  createdAt: (at += 1),
});
const spend = (who: string, n: number, amount: number, among?: string[]) => answer(who, `e-${who}${n}aaaaaa`, { values: { amount, ...(among ? { who: among.map(rid) } : {}) } });
const join = (who: string) => answer(who, "_join", { values: {}, join: true });
const mark = (who: string, amount: number) => answer(who, PAID_ITEM_ID, { values: {}, paid: amount });

function view(answers: AnswerRow<ComposePayload>[], viewerChar: string | null = null, rt: AppRuntime = runtime) {
  const results = computeComposeResults(settle, answers, { appStatus: "active", runtime: rt, viewer: { isHost: viewerChar === null, participantHash: viewerChar ? hash(viewerChar) : null } });
  const v = results.views[0];
  if (v.kind !== "settle") throw new Error("expected a settle view");
  return v;
}

describe("settle wiring", () => {
  const accepts = (patch: (b: Record<string, unknown>) => void) => {
    const draft = draftBlock();
    patch(draft.blocks[0]);
    return AppSpecSchema.safeParse(draft).success;
  };

  it("accepts the example (amount + optional split-among person input)", () => {
    expect(AppSpecSchema.safeParse(structuredClone(exampleSettleTrip)).success).toBe(true);
    expect(accepts((b) => (b.inputs = (b.inputs as unknown[]).slice(0, 1)))).toBe(true);
  });
  it("needs entries many", () => {
    expect(accepts((b) => (b.entries = "one"))).toBe(false);
  });
  it("needs a number source", () => {
    expect(accepts((b) => ((b.views as Array<Record<string, unknown>>)[0].source = "what"))).toBe(false);
    expect(accepts((b) => ((b.views as Array<Record<string, unknown>>)[0].source = null))).toBe(false);
    expect(accepts((b) => ((b.views as Array<Record<string, unknown>>)[0].source = "nope"))).toBe(false);
  });
  it("asks every participant to check in, so 'everyone' includes people who logged nothing", () => {
    expect(composeBlock.validate(settle, { kind: "compose", values: {}, join: true }, { itemId: "_join", runtime })).toBeNull();
  });
});

describe("settle results", () => {
  it("is empty until an expense is logged", () => {
    const v = view([join("a"), join("b")]);
    expect(v.people).toEqual([]);
    expect(v.transfers).toEqual([]);
  });

  it("splits each expense among the whole roster by default, payer = who logged it", () => {
    const v = view([join("a"), join("b"), join("c"), spend("a", 1, 90_000)]);
    expect(v.total).toBe(90_000);
    expect(v.people.map((p) => [p.name, p.paid, p.balance])).toEqual([
      ["A", 90_000, 60_000],
      ["B", 0, -30_000],
      ["C", 0, -30_000],
    ]);
    expect(v.transfers.map((t) => [t.from, t.to, t.amount])).toEqual([
      ["B", "A", 30_000],
      ["C", "A", 30_000],
    ]);
  });

  it("splits among the picked people when the entry names them; unknown ids and an empty pick fall back sensibly", () => {
    const v = view([join("a"), join("b"), join("c"), spend("a", 1, 60_000, ["a", "b"]), spend("b", 1, 30_000, ["c"])]);
    // a: +60k -30k = +30k; b: -30k +30k = 0; c: -30k
    expect(Object.fromEntries(v.people.map((p) => [p.name, p.balance]))).toEqual({ A: 30_000, B: 0, C: -30_000 });
    expect(v.transfers.map((t) => [t.from, t.to, t.amount])).toEqual([["C", "A", 30_000]]);

    const ghosts = view([join("a"), join("b"), answer("a", "e-a9aaaaaa", { values: { amount: 100, who: ["ffffffffffff"] } })]);
    expect(ghosts.people.map((p) => p.balance)).toEqual([50, -50]);
  });

  it("flags the viewer's own balance and transfers, and nothing for the host screen", () => {
    const answers = [join("a"), join("b"), join("c"), spend("a", 1, 90_000)];
    const asB = view(answers, "b");
    expect(asB.people.find((p) => p.mine)?.name).toBe("B");
    expect(asB.transfers.map((t) => t.mine)).toEqual(["pay", null]);
    const asA = view(answers, "a");
    expect(asA.transfers.map((t) => t.mine)).toEqual(["receive", "receive"]);
    expect(view(answers).people.some((p) => p.mine)).toBe(false);
  });

  it("ignores zero, negative and non-numeric amounts", () => {
    const v = view([join("a"), join("b"), spend("a", 1, 0), spend("a", 2, -500), spend("b", 1, 10_000)]);
    expect(v.total).toBe(10_000);
  });

  it("shows paid marks (a withdrawn mark is a deleted record) and the host's received marks", () => {
    const answers = [join("a"), join("b"), spend("a", 1, 100_000), mark("b", 50_000)];
    const before = view(answers, "b");
    expect(before.people.map((p) => [p.name, p.markedPaid, p.received])).toEqual([["A", false, false], ["B", true, false]]);
    expect(before.transfers[0]).toMatchObject({ from: "B", markedPaid: true, received: false });

    const rt = composeHostActions.confirm_paid(settle, runtime, { args: { rosterId: rid("b"), amount: 100_000 }, random: Math.random, answers });
    expect(rt.ok && receivedPayments(rt.runtime, settle.id)).toEqual(new Map([[rid("b"), 100_000]]));
    if (!rt.ok) return;
    expect(view(answers, "a", rt.runtime).transfers[0]).toMatchObject({ received: true, receivedAmount: 100_000 });
    // the marks never count as expenses or entries
    expect(view(answers, "a", rt.runtime).total).toBe(100_000);
  });

  it("takes what the host received off the debt, and a mark for an old amount shows as outdated", () => {
    const received = (amount: number): AppRuntime => {
      const rt = composeHostActions.confirm_paid(settle, runtime, { args: { rosterId: rid("b"), amount }, random: Math.random, answers: [join("a"), join("b")] });
      if (!rt.ok) throw new Error("confirm failed");
      return rt.runtime;
    };
    const base = [join("a"), join("b"), spend("a", 1, 100_000)];
    const personB = (answers: AnswerRow<ComposePayload>[], rt: AppRuntime = runtime) => view(answers, "b", rt).people.find((p) => p.name === "B")!;

    // B owes 50k and marked exactly that
    expect(personB([...base, mark("b", 50_000)])).toMatchObject({ remaining: 50_000, markedPaid: true, markOutdated: false });
    // a new expense by A raises B's debt to 100k: the 50k mark no longer matches
    const more = [...base, spend("a", 2, 100_000), mark("b", 50_000)];
    expect(personB(more)).toMatchObject({ remaining: 100_000, markedPaid: false, markOutdated: true });
    // the host received 50k: 50k is left, which is what the mark named only if it was made for the remainder
    expect(personB(more, received(50_000))).toMatchObject({ receivedAmount: 50_000, remaining: 50_000, markedPaid: true, markOutdated: false, received: true });
    // fully received: nothing left, no stale mark, "received" stays
    expect(personB([...base, mark("b", 50_000)], received(50_000))).toMatchObject({ remaining: 0, markedPaid: false, markOutdated: false, received: true });
    // receiving more than the debt never goes negative
    expect(personB(base, received(80_000)).remaining).toBe(0);
  });
});

describe("paid marks and the host's confirm action", () => {
  const check = (block: ComposeBlock, itemId: string, payload: Omit<ComposePayload, "kind">) => composeBlock.validate(block, { kind: "compose", ...payload }, { itemId, runtime });

  it("accepts the mark (and its withdrawal) only as an empty '_paid' record on a settle block", () => {
    expect(check(settle, PAID_ITEM_ID, { values: {}, paid: 100_000 })).toBeNull();
    expect(check(settle, PAID_ITEM_ID, { values: {}, removed: true })).toBeNull();
    expect(check(settle, PAID_ITEM_ID, { values: { amount: 5 }, paid: 5 })).toBe("bad_payload");
    expect(check(settle, PAID_ITEM_ID, { values: {}, paid: 5, removed: true })).toBe("bad_payload");
    expect(check(settle, PAID_ITEM_ID, { values: {}, paid: 5, join: true })).toBe("bad_payload");
    expect(check(settle, "e-abcdefgh", { values: {}, paid: 5 })).toBe("bad_payload");
    const other = AppSpecSchema.parse(structuredClone(exampleWorkshopVote)).blocks[0] as unknown as ComposeBlock;
    expect(check(other, PAID_ITEM_ID, { values: {}, paid: 5 })).toBe("bad_payload");
  });

  it("accepts the mark amount as a whole positive number only", () => {
    expect(ComposePayloadSchema.safeParse({ kind: "compose", values: {}, paid: 0 }).success).toBe(false);
    expect(ComposePayloadSchema.safeParse({ kind: "compose", values: {}, paid: 1.5 }).success).toBe(false);
    expect(ComposePayloadSchema.safeParse({ kind: "compose", values: {}, paid: -3 }).success).toBe(false);
    expect(ComposePayloadSchema.safeParse({ kind: "compose", values: {}, paid: 1e13 }).success).toBe(false);
  });

  it("confirm_paid takes a roster id on the roster and an amount, only on a settle block", () => {
    const roster = [join("a"), join("b")];
    const run = (block: ComposeBlock, args: Record<string, string | number | boolean>) => composeHostActions.confirm_paid(block, runtime, { args, random: Math.random, answers: roster });
    expect(run(settle, { rosterId: "not-an-id", amount: 5 }).ok).toBe(false);
    expect(run(settle, { amount: 5 }).ok).toBe(false);
    expect(run(settle, { rosterId: rid("a") }).ok).toBe(false);
    expect(run(settle, { rosterId: rid("a"), amount: -1 }).ok).toBe(false);
    expect(run(settle, { rosterId: rid("a"), amount: 1.5 }).ok).toBe(false);
    // well-formed but nobody on the roster has this id
    expect(run(settle, { rosterId: rid("c"), amount: 5 }).ok).toBe(false);
    const other = AppSpecSchema.parse(structuredClone(exampleWorkshopVote)).blocks[0] as unknown as ComposeBlock;
    expect(run(other, { rosterId: rid("a"), amount: 5 }).ok).toBe(false);
    const on = run(settle, { rosterId: rid("a"), amount: 70_000 });
    expect(on.ok && receivedPayments(on.runtime, settle.id).get(rid("a"))).toBe(70_000);
    const off = on.ok ? composeHostActions.confirm_paid(settle, on.runtime, { args: { rosterId: rid("a"), amount: 0 }, random: Math.random, answers: roster }) : on;
    expect(off.ok && receivedPayments(off.runtime, settle.id).size).toBe(0);
  });
});

describe("payee name and bank checks", () => {
  const parse = (p: Record<string, unknown>) => PayeeInputSchema.safeParse({ bin: "970436", account: "0123456789", name: "NGUYEN VAN A", ...p });

  it("turns a holder name into capitals without accents", () => {
    expect(normalizeAccountName("  Nguyễn  Văn Đạt ")).toBe("NGUYEN VAN DAT");
    expect(parse({ name: "Trần Thị Bích" }).data?.name).toBe("TRAN THI BICH");
  });
  it("accepts only listed banks, 6-19 digit accounts and A-Z names of 2-50 characters", () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ bin: "123456" }).success).toBe(false);
    expect(parse({ account: "12345" }).success).toBe(false);
    expect(parse({ account: "1".repeat(20) }).success).toBe(false);
    expect(parse({ account: "1234 5678" }).success).toBe(false);
    expect(parse({ account: "12345a" }).success).toBe(false);
    expect(parse({ name: "A" }).success).toBe(false);
    expect(parse({ name: "NGUYEN 2" }).success).toBe(false);
    expect(parse({ name: "A".repeat(51) }).success).toBe(false);
    expect(parse({ extra: 1 }).success).toBe(false);
  });
});

describe("payee over the API", () => {
  let app: AppRecord;
  let hostToken: string;
  const params = () => ({ params: Promise.resolve({ id: app.id }) });
  const request = (body: unknown, headers: Record<string, string>) => new Request("http://x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const setPayee = (payee: unknown, token: string | null = hostToken) => lifecycle(request({ action: "payee", payee }, token ? { "x-host-token": token } : {}), params());
  const good = { bin: "970436", account: "0123456789", name: "Nguyễn Văn A" };
  const current = async () => (await appsRepository().findApp(app.id))!;
  const stateBody = async (headers: Record<string, string> = {}) => (await getState(new Request("http://x", { headers }), params())).json();

  beforeEach(async () => {
    resetMemoryStore();
    resetRateLimitMemoryStoreForTests();
    ({ app, hostToken } = await appsRepository().createApp({ spec: runtimeSpec(exampleSettleTrip), prompt: "t", lifetimeMs: 3_600_000 }));
  });

  it("refuses anyone but the host", async () => {
    expect((await setPayee(good, null)).status).toBe(403);
    expect((await setPayee(good, "not-the-host-token-at-all")).status).toBe(403);
    expect((await current()).payee).toBeNull();
  });

  it("refuses a bad bank, account or name with a specific error", async () => {
    for (const bad of [{ ...good, bin: "000000" }, { ...good, account: "12" }, { ...good, name: "X1" }, { ...good, account: "" }]) {
      const res = await setPayee(bad);
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ code: "payee_invalid" });
    }
    expect((await setPayee({ ...good, extra: true })).status).toBe(400);
    expect((await current()).payee).toBeNull();
  });

  it("stores the normalized payee, shows it to everyone with the bank's name, and clears it", async () => {
    const v0 = (await current()).stateVersion;
    expect((await setPayee(good)).status).toBe(200);
    expect((await current()).payee).toEqual({ bin: "970436", account: "0123456789", name: "NGUYEN VAN A" });
    expect((await current()).stateVersion).toBe(v0 + 1);
    const expected = { bin: "970436", bankName: "Vietcombank", account: "0123456789", name: "NGUYEN VAN A" };
    expect((await stateBody()).payee).toEqual(expected);
    expect((await stateBody({ "x-host-token": hostToken })).payee).toEqual(expected);

    expect((await setPayee(null)).status).toBe(200);
    expect((await stateBody()).payee).toBeNull();
  });

  it("is refused on an app without a settle view and on an ended app, and ending forgets the account", async () => {
    const poll = await appsRepository().createApp({ spec: runtimeSpec(exampleWorkshopVote), prompt: "t", lifetimeMs: 3_600_000 });
    const res = await lifecycle(request({ action: "payee", payee: good }, { "x-host-token": poll.hostToken }), { params: Promise.resolve({ id: poll.app.id }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "payee_needs_settle_view" });

    await setPayee(good);
    await lifecycle(request({ action: "end" }, { "x-host-token": hostToken }), params());
    expect((await current()).payee).toBeNull();
    expect((await setPayee(good)).status).toBe(410);
    expect(await appsRepository().setPayee(app.id, { bin: "970436", account: "0123456789", name: "A B" })).toBe(false);
  });

  it("cannot be set from an answer or a spec: a participant's request is not a host request", async () => {
    const res = await respond(
      request({ blockId: "expenses", itemId: "e-abcdefgh", participantToken: "p".repeat(20), displayName: "X", payload: { kind: "compose", values: { amount: 5 }, payee: good } }, {}),
      params(),
    );
    expect(res.status).toBe(400);
    expect((await current()).payee).toBeNull();
  });

  it("end to end: two phones log expenses, one marks paid, the host confirms; the state carries every mark", async () => {
    const tokens = { a: "a".repeat(20), b: "b".repeat(20) };
    const send = async (who: "a" | "b", itemId: string, payload: unknown) => {
      const res = await respond(request({ blockId: "expenses", itemId, participantToken: tokens[who], displayName: who.toUpperCase(), payload }, {}), params());
      expect(res.status).toBe(200);
    };
    await send("a", "_join", { kind: "compose", values: {}, join: true });
    await send("b", "_join", { kind: "compose", values: {}, join: true });
    await send("a", "e-aaaaaaaa", { kind: "compose", values: { amount: 200_000 } });
    await send("b", PAID_ITEM_ID, { kind: "compose", values: {}, paid: 100_000 });
    const b = await getState(new Request("http://x", { headers: { "x-participant-token": tokens.b } }), params()).then((r) => r.json());
    expect(b.results[0].views[0].transfers).toEqual([expect.objectContaining({ from: "B", to: "A", amount: 100_000, mine: "pay", markedPaid: true, received: false })]);

    const bId = participantHashFor(app.id, tokens.b).slice(0, 12);
    const confirm = await blockAction(request({ blockId: "expenses", action: "confirm_paid", args: { rosterId: bId, amount: 100_000 } }, { "x-host-token": hostToken }), params());
    expect(confirm.status).toBe(200);
    const host = await stateBody({ "x-host-token": hostToken });
    // fully received: the debt is settled, so the mark gives way to "received 100.000"
    expect(host.results[0].views[0].transfers[0]).toMatchObject({ markedPaid: false, markOutdated: false, received: true, receivedAmount: 100_000 });

    await send("b", PAID_ITEM_ID, { kind: "compose", values: {}, removed: true });
    expect((await stateBody()).results[0].views[0].transfers[0].markedPaid).toBe(false);
    // only the host can confirm
    expect((await blockAction(request({ blockId: "expenses", action: "confirm_paid", args: { rosterId: bId } }, {}), params())).status).toBe(403);
  });
});

describe("settling up after the log is closed", () => {
  let app: AppRecord;
  let hostToken: string;
  const tokens = { a: "a".repeat(20), b: "b".repeat(20) };
  const params = () => ({ params: Promise.resolve({ id: app.id }) });
  const request = (body: unknown, headers: Record<string, string>) => new Request("http://x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const send = (who: "a" | "b", itemId: string, payload: unknown) => respond(request({ blockId: "expenses", itemId, participantToken: tokens[who], displayName: who.toUpperCase(), payload }, {}), params());
  const confirm = (rosterId: string, amount: number) => blockAction(request({ blockId: "expenses", action: "confirm_paid", args: { rosterId, amount } }, { "x-host-token": hostToken }), params());
  const lifecycleAction = (body: unknown) => lifecycle(request(body, { "x-host-token": hostToken }), params());
  const bId = () => participantHashFor(app.id, tokens.b).slice(0, 12);
  const transferOf = async (headers: Record<string, string>) => (await getState(new Request("http://x", { headers }), params()).then((r) => r.json())).results[0].views[0].transfers[0];

  beforeEach(async () => {
    resetMemoryStore();
    resetRateLimitMemoryStoreForTests();
    ({ app, hostToken } = await appsRepository().createApp({ spec: runtimeSpec(exampleSettleTrip), prompt: "t", lifetimeMs: 3_600_000 }));
    for (const who of ["a", "b"] as const) expect((await send(who, "_join", { kind: "compose", values: {}, join: true })).status).toBe(200);
    expect((await send("a", "e-aaaaaaaa", { kind: "compose", values: { amount: 200_000 } })).status).toBe(200);
    expect((await lifecycleAction({ action: "close" })).status).toBe(200);
  });

  it("takes the paid mark and its withdrawal, but still no expenses or check-ins", async () => {
    expect((await send("b", PAID_ITEM_ID, { kind: "compose", values: {}, paid: 100_000 })).status).toBe(200);
    expect(await transferOf({ "x-participant-token": tokens.b })).toMatchObject({ markedPaid: true });
    expect((await send("b", PAID_ITEM_ID, { kind: "compose", values: {}, removed: true })).status).toBe(200);
    expect(await transferOf({ "x-participant-token": tokens.b })).toMatchObject({ markedPaid: false });
    const expense = await send("b", "e-bbbbbbbb", { kind: "compose", values: { amount: 5 } });
    expect(expense.status).toBe(409);
    expect(await expense.json()).toMatchObject({ code: "app_closed" });
    expect((await send("a", "_join", { kind: "compose", values: {}, join: true })).status).toBe(409);
  });

  it("lets the host confirm what was received, and other host actions stay closed", async () => {
    expect((await confirm(bId(), 100_000)).status).toBe(200);
    expect(await transferOf({ "x-host-token": hostToken })).toMatchObject({ received: true, receivedAmount: 100_000 });
    const other = await blockAction(request({ blockId: "expenses", action: "shuffle", args: {} }, { "x-host-token": hostToken }), params());
    expect(other.status).toBe(409);
    expect((await blockAction(request({ blockId: "expenses", action: "confirm_paid", args: { rosterId: bId(), amount: 1 } }, {}), params())).status).toBe(403);
  });

  it("refuses a confirmation for an id that is not on the roster", async () => {
    expect((await confirm("c".repeat(12), 5)).status).toBe(400);
    expect((await confirm(bId(), -5)).status).toBe(400);
  });

  it("refuses both once the app has ended", async () => {
    await lifecycleAction({ action: "end" });
    expect((await send("b", PAID_ITEM_ID, { kind: "compose", values: {}, paid: 100_000 })).status).toBe(410);
    expect((await confirm(bId(), 100_000)).status).toBe(410);
  });

  it("the repository accepts only the paid mark on a closed app and refuses everything on a blocked one", async () => {
    const repo = appsRepository();
    const row = (itemId: string) => ({ blockId: "expenses", itemId, participantHash: participantHashFor(app.id, tokens.b), displayName: "B", payload: { kind: "compose" as const, values: {}, paid: 5 } });
    expect(await repo.submitResponse(app.id, row(PAID_ITEM_ID))).toBe("ok");
    expect(await repo.submitResponse(app.id, row("_join"))).toBe("closed");
  });

  it("the payee only goes to viewers who can see a settle view", async () => {
    expect((await lifecycleAction({ action: "payee", payee: { bin: "970436", account: "0123456789", name: "Nguyen Van A" } })).status).toBe(200);
    const payeeFor = async (headers: Record<string, string>) => (await getState(new Request("http://x", { headers }), params()).then((r) => r.json())).payee;
    expect(await payeeFor({ "x-participant-token": tokens.b })).toMatchObject({ account: "0123456789" });

    // the settle view is host-only: participants get no bank details, the host still does
    const hostOnly = structuredClone(exampleSettleTrip) as unknown as { blocks: Array<{ views: Array<Record<string, unknown>> }> };
    hostOnly.blocks[0].views[0].visibleTo = "host";
    const other = await appsRepository().createApp({ spec: runtimeSpec(AppSpecSchema.parse(hostOnly)), prompt: "t", lifetimeMs: 3_600_000 });
    await appsRepository().setPayee(other.app.id, { bin: "970436", account: "0123456789", name: "A B" });
    const at = (headers: Record<string, string>) => getState(new Request("http://x", { headers }), { params: Promise.resolve({ id: other.app.id }) }).then((r) => r.json());
    expect((await at({ "x-participant-token": tokens.b })).payee).toBeNull();
    expect((await at({ "x-host-token": other.hostToken })).payee).toMatchObject({ account: "0123456789" });
  });
});

describe("payment QR text", () => {
  const payee = { bin: "970436" as const, bankName: "Vietcombank", account: "0123456789", name: "NGUYEN VAN A" };

  it("is a VietQR for the viewer's debt with a valid checksum, the account and a short ASCII note", () => {
    const text = paymentQrText(payee, 120_000, "Chia tiền chuyến đi Đà Lạt 2026", "Trần Bình");
    expect(text.startsWith("000201010212")).toBe(true);
    expect(text).toContain("0010A000000727");
    expect(text).toContain("0123456789");
    expect(text).toContain("5406120000");
    expect(text).toContain("5303704");
    expect(text.slice(-4)).toBe(crc16Ccitt(text.slice(0, -4)));
    expect(paymentNote("Chia tiền chuyến đi Đà Lạt 2026", "Trần Bình")).toBe("Chia tien chuyen di Da Tran Binh");
  });
  it("only offers a QR for đồng amounts, and for what the viewer owes", () => {
    for (const unit of [null, "đ", "VND", "vnd", " vnđ "]) expect(isVndUnit(unit)).toBe(true);
    for (const unit of ["km", "USD", "k"]) expect(isVndUnit(unit)).toBe(false);
    expect(amountOwedBy({ balance: -30_000 })).toBe(30_000);
    expect(amountOwedBy({ balance: 5 })).toBe(0);
    // what the host already received comes off, and a paid-up debt asks for nothing (no QR)
    expect(amountOwedBy({ balance: -30_000, receivedAmount: 10_000 })).toBe(20_000);
    expect(amountOwedBy({ balance: -30_000, receivedAmount: 30_000 })).toBe(0);
    expect(amountOwedBy({ balance: -30_000, receivedAmount: 50_000 })).toBe(0);
    expect(amountOwedBy(undefined)).toBe(0);
  });
});

describe("phishing scan and bank details in generated text", () => {
  const withText = (patch: (b: Record<string, unknown>) => void) => {
    const draft = draftBlock() as unknown as Record<string, unknown> & { blocks: Array<Record<string, unknown>> };
    patch(draft.blocks[0]);
    return scanAppSpecPhishing(runtimeSpec(draft as never), ["none"]);
  };

  it("passes the settle example", () => {
    expect(scanAppSpecPhishing(runtimeSpec(exampleSettleTrip), ["none"])).toMatchObject({ ok: true });
  });
  it("flags an account number next to bank or transfer wording", () => {
    for (const note of ["Chuyển khoản vào 0123456789 nhé", "STK 0123456789 Vietcombank", "Pay to account number 1234 5678 9012"]) {
      const r = withText((b) => (b.note = note));
      expect(r.ok).toBe(false);
      expect(r.issues).toContain("account_number_like_text");
    }
  });
  it("flags a long number in the title", () => {
    const draft = structuredClone(exampleSettleTrip) as unknown as { title: string };
    draft.title = "Quỹ lớp 0123456789";
    expect(scanAppSpecPhishing(runtimeSpec(draft as never), ["none"]).ok).toBe(false);
  });
  it("only records transfer wording without a number, and a bare long number elsewhere", () => {
    const wording = withText((b) => (b.note = "Nhớ chuyển khoản cho người đã chi trước"));
    expect(wording.ok).toBe(true);
    expect(wording.issues).toContain("transfer_wording_low_confidence");
    const bare = withText((b) => (b.note = "Mã chuyến 123456789"));
    expect(bare.ok).toBe(true);
    expect(bare.issues).toContain("long_number_low_confidence");
  });
});

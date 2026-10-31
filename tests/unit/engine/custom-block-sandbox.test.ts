// Sandboxed custom brick: the code scan refuses what could leave the sandbox, the payload is capped,
// the sandbox route answers with the exact CSP, and the page's text reaches the phishing scan.
import { beforeEach, describe, expect, it } from "vitest";
import { AppSpecSchema } from "@/engine/app-spec/app-spec-schema";
import { exampleClassDraw } from "@/engine/app-spec/app-spec-examples";
import { exampleTapSpeedGame, tapGameHtml, TAP_GAME_EN } from "@/engine/app-spec/app-spec-examples-custom";
import { CustomPayloadSchema, customBlock } from "@/engine/blocks/custom/custom-block";
import { buildContentSecurityPolicy, proxy } from "@/proxy";
import { SANDBOX_CSP } from "@/engine/blocks/custom/sandbox-document";
import { scanAppSpecPhishing } from "@/engine/security/scan-app-spec-phishing";
import { CUSTOM_HTML_MAX_CHARS, scanCustomCode } from "@/engine/security/custom-code-scan";
import { appsRepository, resetMemoryStore } from "@/engine/db/apps-repository";
import { GET as sandbox } from "@/app/sandbox/[appId]/[blockId]/route";
import { POST as respond } from "@/app/api/engine/apps/[id]/responses/route";
import { runtimeSpec } from "./runtime-spec-test-helper";
import { NextRequest } from "next/server";

const game = tapGameHtml(TAP_GAME_EN);
const withScript = (js: string) => `<div>Hi</div><script>${js}</script>`;
const sandboxParams = (appId: string, blockId: string) => ({ params: Promise.resolve({ appId, blockId }) });
/** What a browser sends for a page loaded into an <iframe>. */
const framed = () => new Request("http://localhost/sandbox/x/y", { headers: { "sec-fetch-dest": "iframe" } });

beforeEach(() => resetMemoryStore());

describe("custom code scan", () => {
  it("allows a clean game", () => {
    expect(scanCustomCode(game)).toEqual([]);
    expect(scanCustomCode(tapGameHtml({ ...TAP_GAME_EN, heading: "Điểm cao" }))).toEqual([]);
  });

  it.each([
    ["form", `<form action="x"><input></form>`, "tag:form"],
    ["iframe", `<iframe></iframe>`, "tag:iframe"],
    ["object", `<object data="x"></object>`, "tag:object"],
    ["embed", `<embed>`, "tag:embed"],
    ["base", `<base target="_top">`, "tag:base"],
    ["link", `<link rel="stylesheet">`, "tag:link"],
    ["meta refresh", `<meta http-equiv="refresh" content="0">`, "tag:meta_http_equiv"],
    ["external script", `<script src="a.js"></script>`, "tag:external_script"],
    ["https url", `<img src="https://evil.example/x.png">`, "url:absolute"],
    ["http url in script", withScript(`var u = "http://x";`), "url:absolute"],
    ["top.location", withScript(`top.location = "x";`), "js:top_or_parent_location"],
    ["parent.location", withScript(`parent.location.href = "x";`), "js:top_or_parent_location"],
    ["location assignment", withScript(`location = "//evil.vn/?" + x;`), "js:location"],
    ["location.href", withScript(`location.href = x;`), "js:location"],
    ["location.replace", withScript(`location.replace(x);`), "js:location"],
    ["location.assign", withScript(`location . assign(x);`), "js:location"],
    ["document.location", withScript(`document.location = x;`), "js:location"],
    ["window.location", withScript(`window.location.href = x;`), "js:location"],
    ["window['location']", withScript(`window["location"] = x;`), "js:location"],
    ["protocol-relative string", withScript(`var u = "//evil.vn/x";`), "url:protocol_relative"],
    ["protocol-relative attribute", `<img src="//evil.vn/x.png">`, "url:protocol_relative"],
    ["protocol-relative css url", `<style>a{background:url(//evil.vn/x)}</style>`, "url:protocol_relative"],
    ["document.domain", withScript(`document.domain = "x";`), "js:document_domain"],
    ["history.pushState", withScript(`history.pushState(null, "", "/x");`), "js:history"],
    ["window.name", withScript(`window.name = "x";`), "js:window_name"],
    ["window.open", withScript(`window.open("x");`), "js:window_open"],
    ["cookie", withScript(`var c = document.cookie;`), "js:cookie"],
    ["localStorage", withScript(`localStorage.setItem("a", "b");`), "js:storage"],
    ["sessionStorage", withScript(`sessionStorage.a;`), "js:storage"],
    ["indexedDB", withScript(`indexedDB.open("a");`), "js:storage"],
    ["fetch", withScript(`fetch("/x");`), "js:fetch"],
    ["XMLHttpRequest", withScript(`new XMLHttpRequest();`), "js:xhr"],
    ["WebSocket", withScript(`new WebSocket("x");`), "js:websocket"],
    ["sendBeacon", withScript(`navigator.sendBeacon("x");`), "js:beacon"],
    ["importScripts", withScript(`importScripts("x");`), "js:import_scripts"],
    ["Worker", withScript(`new Worker("x");`), "js:worker"],
    ["eval", withScript(`eval("1");`), "js:eval"],
    ["Function constructor", withScript(`new Function("return 1")();`), "js:function_constructor"],
    ["vi password", `<p>Nhập mật khẩu của bạn</p>`, "credential_wording"],
    ["otp", `<p>Enter your OTP</p>`, "credential_wording"],
    ["vi confirm code", `<p>Nhập mã xác nhận</p>`, "credential_wording"],
    ["card number", `<p>Số thẻ</p>`, "credential_wording"],
    ["cvv", `<p>CVV</p>`, "credential_wording"],
    ["password", `<p>Password</p>`, "credential_wording"],
    ["pin", `<p>Your PIN</p>`, "credential_wording"],
  ])("refuses %s", (_name, html, code) => {
    expect(scanCustomCode(html)).toContain(code);
  });

  it("does not mistake ordinary functions for the Function constructor", () => {
    expect(scanCustomCode(withScript(`function go() {} myFunction(1); spinner();`))).toEqual([]);
  });

  it("does not refuse the word 'location' in prose, a comparison, or an ordinary '//' comment", () => {
    expect(scanCustomCode(`<p>Pick a location for the game</p>` + withScript(`if (place.location == 1) { score++; } // count it\nvar s = "a" + "b";`))).toEqual([]);
  });

  it("refuses a page over the size limit", () => {
    expect(scanCustomCode("a".repeat(CUSTOM_HTML_MAX_CHARS + 1))).toContain("too_large");
  });
});

describe("custom block in the app spec", () => {
  const spec = (html: string) => ({ ...exampleTapSpeedGame, blocks: [{ type: "custom" as const, id: "g", title: "Game", html }] });

  it("validates the example and refuses code that fails the scan or is too long", () => {
    expect(AppSpecSchema.safeParse(exampleTapSpeedGame).success).toBe(true);
    expect(AppSpecSchema.safeParse(spec(withScript(`fetch("/x")`))).success).toBe(false);
    expect(AppSpecSchema.safeParse(spec("a".repeat(CUSTOM_HTML_MAX_CHARS + 1))).success).toBe(false);
  });

  it("shows the page's own words to the phishing scan", () => {
    // passes the code scan (no listed word) but the wording asks for credentials
    const sneaky = spec(`<p>Gửi mã bảo mật của bạn để nhận quà</p>`);
    const parsed = AppSpecSchema.parse(sneaky);
    const block = parsed.blocks[0];
    if (block.type !== "custom") throw new Error("expected custom");
    expect(customBlock.security.instructionTexts(block).join(" ")).toContain("mã bảo mật");
    expect(scanAppSpecPhishing(AppSpecSchema.parse(exampleTapSpeedGame), ["none"]).ok).toBe(true);
  });

  it("runs the link and account-number rules over the strings a script builds at run time", () => {
    const scan = (js: string) => scanAppSpecPhishing(AppSpecSchema.parse(spec(withScript(js))), ["none"]);
    const bank = scan(`document.body.textContent = "Chuyển khoản VCB 0123456789 nhé";`);
    expect(bank.ok).toBe(false);
    expect(bank.issues).toContain("account_number_like_text");
    const domain = scan(`document.body.textContent = "Nhận quà tại evil.vn/qua";`);
    expect(domain.ok).toBe(false);
    expect(domain.issues).toContain("url_like_text");
    const www = scan(`var s = "www.evil.example";`);
    expect(www.issues).toContain("url_like_text");
    expect(scan(`var s = "Còn lại"; document.title = s + 10;`).ok).toBe(true);
  });

  it("extracts visible text and script strings but not tags", () => {
    const block = AppSpecSchema.parse(exampleTapSpeedGame).blocks[0];
    if (block.type !== "custom") throw new Error("expected custom");
    const texts = customBlock.security.instructionTexts(block);
    expect(texts.join("\n")).toContain("Bấm nhanh trong 10 giây");
    expect(texts.join("\n")).toContain("Còn lại");
    expect(texts.join("\n")).not.toContain("<button");
  });
});

describe("custom payload and results", () => {
  it("caps the submitted value at 2000 characters of JSON", () => {
    expect(CustomPayloadSchema.safeParse({ kind: "custom", value: { score: 12 } }).success).toBe(true);
    expect(CustomPayloadSchema.safeParse({ kind: "custom", value: "x".repeat(1990) }).success).toBe(true);
    expect(CustomPayloadSchema.safeParse({ kind: "custom", value: "x".repeat(2001) }).success).toBe(false);
    expect(CustomPayloadSchema.safeParse({ kind: "custom", value: { a: 1 }, extra: 1 }).success).toBe(false);
    expect(CustomPayloadSchema.safeParse({ kind: "custom" }).success).toBe(false);
  });

  it("keeps one latest answer per person via the repository and reports count", async () => {
    const { app } = await appsRepository().createApp({ spec: runtimeSpec(exampleTapSpeedGame), prompt: "p", lifetimeMs: 3_600_000 });
    const block = app.spec.blocks[0];
    if (block.type !== "custom") throw new Error("expected custom");
    const submit = (hash: string, name: string, score: number) =>
      appsRepository().submitResponse(app.id, { blockId: "tap-game", itemId: "", participantHash: hash.repeat(64).slice(0, 64), displayName: name, payload: { kind: "custom", value: { score } } });
    await submit("a", "An", 10);
    await submit("a", "An", 25);
    await submit("b", "Binh", 7);
    const rows = (await appsRepository().listResponses(app.id)).filter((r) => r.payload.kind === "custom");
    const results = customBlock.computeResults(block, rows as never, { appStatus: "active", runtime: app.runtime, viewer: { isHost: true, participantHash: null }, locale: "vi" });
    expect(results?.count).toBe(2);
    expect(results?.answers.map((a) => [a.name, a.value])).toEqual(expect.arrayContaining([["An", { score: 25 }], ["Binh", { score: 7 }]]));
    expect(results?.answers).toHaveLength(2);
  });
});

describe("custom results order", () => {
  it("orders by the latest submission, not by when the row was first created", () => {
    const block = AppSpecSchema.parse(exampleTapSpeedGame).blocks[0];
    if (block.type !== "custom") throw new Error("expected custom");
    const row = (hash: string, name: string, createdAt: number, at: number | undefined) => ({
      blockId: "tap-game", itemId: "", participantHash: hash.repeat(64).slice(0, 64), displayName: name, createdAt,
      payload: { kind: "custom" as const, value: { n: name }, ...(at === undefined ? {} : { at }) },
    });
    // An created first but re-submitted last; Binh and Chi never re-submitted (no stamp: created time is used)
    const rows = [row("a", "An", 100, 900), row("b", "Binh", 200, 200), row("c", "Chi", 300, undefined)];
    const results = customBlock.computeResults(block, rows, { appStatus: "active", runtime: { openQuestionId: null, revealedQuestionIds: [] }, viewer: { isHost: true, participantHash: null }, locale: "vi" });
    expect(results?.answers.map((a) => [a.name, a.at])).toEqual([["Binh", 200], ["Chi", 300], ["An", 900]]);
  });

  it("keeps the newest answers when there are more than the cap", () => {
    const block = AppSpecSchema.parse(exampleTapSpeedGame).blocks[0];
    if (block.type !== "custom") throw new Error("expected custom");
    const rows = Array.from({ length: 205 }, (_, i) => ({
      blockId: "tap-game", itemId: "", participantHash: String(i).padStart(64, "0"), displayName: `P${i}`, createdAt: i,
      // the first person re-submitted last, so they must survive the cut and the oldest others must not
      payload: { kind: "custom" as const, value: i, at: i === 0 ? 10_000 : i },
    }));
    const results = customBlock.computeResults(block, rows, { appStatus: "active", runtime: { openQuestionId: null, revealedQuestionIds: [] }, viewer: { isHost: true, participantHash: null }, locale: "vi" });
    expect(results?.answers).toHaveLength(200);
    expect(results?.answers.at(-1)?.name).toBe("P0");
    expect(results?.answers.some((a) => a.name === "P1")).toBe(false);
    expect(results?.count).toBe(205);
  });

  it("stamps a submission with the server clock whatever the client sends", async () => {
    const { app } = await appsRepository().createApp({ spec: runtimeSpec(exampleTapSpeedGame), prompt: "p", lifetimeMs: 3_600_000 });
    const send = (payload: unknown) =>
      respond(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ blockId: "tap-game", itemId: "", participantToken: "t".repeat(20), displayName: "An", payload }) }), { params: Promise.resolve({ id: app.id }) });
    const before = Date.now();
    expect((await send({ kind: "custom", value: { score: 3 }, at: 1 })).status).toBe(200);
    const stored = (await appsRepository().listResponses(app.id))[0].payload as { at?: number };
    expect(stored.at).toBeGreaterThanOrEqual(before);
  });
});

describe("sandbox route", () => {
  it("serves the page with the exact CSP and hardening headers", async () => {
    const { app } = await appsRepository().createApp({ spec: runtimeSpec(exampleTapSpeedGame), prompt: "p", lifetimeMs: 3_600_000 });
    const res = await sandbox(framed(), sandboxParams(app.id, "tap-game"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toBe(
      "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",
    );
    expect(SANDBOX_CSP).toBe(res.headers.get("content-security-policy"));
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    const html = await res.text();
    expect(html.indexOf("window.minint = api")).toBeGreaterThan(-1);
    expect(html.indexOf("window.minint = api")).toBeLessThan(html.indexOf("Bấm nhanh trong 10 giây"));
  });

  it("answers 404 unless the request is a frame load (a direct visit sends sec-fetch-dest: document)", async () => {
    const { app } = await appsRepository().createApp({ spec: runtimeSpec(exampleTapSpeedGame), prompt: "p", lifetimeMs: 3_600_000 });
    const withDest = (dest: string | null) => new Request("http://localhost/sandbox/x/y", { headers: dest ? { "sec-fetch-dest": dest } : {} });
    for (const dest of ["document", "empty", "script", "frame", "embed", "object", "", null]) {
      const res = await sandbox(withDest(dest), sandboxParams(app.id, "tap-game"));
      expect(res.status, `sec-fetch-dest ${dest}`).toBe(404);
      expect(await res.text()).toBe("Not found");
    }
    expect((await sandbox(withDest("iframe"), sandboxParams(app.id, "tap-game"))).status).toBe(200);
  });

  it("answers 404 for an unknown app, an unknown block, and a block that is not custom", async () => {
    const custom = await appsRepository().createApp({ spec: runtimeSpec(exampleTapSpeedGame), prompt: "p", lifetimeMs: 3_600_000 });
    const wheel = await appsRepository().createApp({ spec: runtimeSpec(exampleClassDraw), prompt: "p", lifetimeMs: 3_600_000 });
    const req = framed;
    expect((await sandbox(req(), sandboxParams("nope", "tap-game"))).status).toBe(404);
    expect((await sandbox(req(), sandboxParams(custom.app.id, "missing"))).status).toBe(404);
    expect((await sandbox(req(), sandboxParams(wheel.app.id, "draw"))).status).toBe(404);
  });
});

describe("page CSP and proxy", () => {
  it("lets the app page frame its own origin only", () => {
    expect(buildContentSecurityPolicy({ nonce: "n", isDev: false, supabaseUrl: "" })).toContain("frame-src 'self'");
  });

  it("keeps frame-src enforced when the rest of the policy is report-only", () => {
    const original = process.env.CSP_REPORT_ONLY;
    try {
      process.env.CSP_REPORT_ONLY = "1";
      const res = proxy(new NextRequest("http://localhost/a/x"));
      expect(res.headers.get("content-security-policy-report-only")).toContain("nonce-");
      expect(res.headers.get("content-security-policy")).toBe("frame-src 'self'");
      delete process.env.CSP_REPORT_ONLY;
      const enforced = proxy(new NextRequest("http://localhost/a/x"));
      expect(enforced.headers.get("content-security-policy-report-only")).toBeNull();
      expect(enforced.headers.get("content-security-policy")).toContain("frame-src 'self'");
    } finally {
      if (original === undefined) delete process.env.CSP_REPORT_ONLY;
      else process.env.CSP_REPORT_ONLY = original;
    }
  });

  it("leaves the sandbox route's CSP to the route (no nonce CSP is added)", () => {
    const sandboxRes = proxy(new NextRequest("http://localhost/sandbox/a/b"));
    expect(sandboxRes.headers.get("content-security-policy")).toBeNull();
    expect(proxy(new NextRequest("http://localhost/a/x")).headers.get("content-security-policy")).toContain("nonce-");
  });
});

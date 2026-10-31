import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3200";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch(new URL("/api/health", base), { signal: AbortSignal.timeout(2000) });
    const health = await response.json();
    if (response.ok && health.status === "ok" && health.service === "minintapp") { ready = true; break; }
  } catch { /* Wait for server startup. */ }
  await pause(1000);
}
assert(ready, "Application did not become healthy");
async function api(path, body, headers = {}) {
  return fetch(new URL(path, base), {
    method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Origin: new URL(base).origin, ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000),
  });
}
const created = await api("/api/apps/from-template", { templateId: "poll-drinks", locale: "vi", lifetime: "1h" });
assert.equal(created.status, 201);
const { id, hostToken } = await created.json();
assert(id && hostToken);
try {
  const participantToken = "e".repeat(64);
  for (const choice of ["tea", "coffee"]) {
    const submitted = await api(`/api/apps/${id}/responses`, { blockId: "poll", itemId: "", participantToken, displayName: null, payload: { kind: "compose", values: { drink: choice } } });
    assert.equal(submitted.status, 200);
  }
  const stateResponse = await api(`/api/apps/${id}/state`, null, { "x-host-view": "1", "x-host-token": hostToken });
  assert.equal(stateResponse.status, 200);
  const state = await stateResponse.json();
  assert.equal(state.participantCount, 1);
  assert.deepEqual(state.results[0].items.map((i) => i.count), [0, 1]);
  assert(!("hostTokenHash" in state));
  const forbidden = await api(`/api/apps/${id}/lifecycle`, { action: "close" });
  assert.equal(forbidden.status, 403);
  console.log("Deployment smoke passed: health, create, vote, change vote, shared state and host permissions.");
} finally {
  const ended = await api(`/api/apps/${id}/lifecycle`, { action: "end" }, { "x-host-token": hostToken });
  assert.equal(ended.status, 200);
}

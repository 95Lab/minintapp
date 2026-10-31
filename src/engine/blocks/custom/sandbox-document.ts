// The page served inside the sandboxed iframe of a `custom` block: our bridge script first, then the
// AI-written html. The CSP below is the containment: no network of any kind, nothing but inline
// script/style and data: images/fonts, and only our own origin may frame it. The iframe itself adds
// `sandbox="allow-scripts"` (opaque origin: no cookies, no storage, no access to the host page).
// The CSP repeats that sandbox itself, as a second layer: the route only answers frame loads
// (`Sec-Fetch-Dest: iframe`), so /sandbox/… opened directly is a 404 and never runs AI-written script
// on our origin, next to the host tokens in localStorage.

export const SANDBOX_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'";

export const SANDBOX_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": SANDBOX_CSP,
  "x-content-type-options": "nosniff",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
};

/** Largest JSON (serialized) a page may submit — mirrored by the payload schema, checked again by the host page. */
export const CUSTOM_VALUE_MAX_CHARS = 2000;

/**
 * window.minint = { submit(value), onState(cb), state }. Messages to the host page are
 * minint:ready / minint:submit / minint:resize; state arrives as minint:state and is only trusted
 * when it comes from the parent window. Must not contain a closing script tag.
 */
const BRIDGE_SCRIPT = `(function () {
  var listeners = [];
  var api = {
    state: null,
    submit: function (value) {
      var json;
      try { json = JSON.stringify(value); } catch (e) { return false; }
      if (json === undefined || json.length > ${CUSTOM_VALUE_MAX_CHARS}) return false;
      parent.postMessage({ type: "minint:submit", value: JSON.parse(json) }, "*");
      return true;
    },
    onState: function (cb) {
      if (typeof cb !== "function") return;
      listeners.push(cb);
      if (api.state) { try { cb(api.state); } catch (e) {} }
    }
  };
  window.minint = api;
  window.addEventListener("message", function (event) {
    if (event.source !== parent) return;
    var data = event.data;
    if (!data || data.type !== "minint:state" || !data.state) return;
    api.state = data.state;
    listeners.slice().forEach(function (cb) { try { cb(api.state); } catch (e) {} });
  });
  function postHeight() {
    var h = Math.ceil(document.body ? document.body.getBoundingClientRect().height : 0);
    parent.postMessage({ type: "minint:resize", height: h }, "*");
  }
  document.addEventListener("DOMContentLoaded", function () {
    if (typeof ResizeObserver === "function" && document.body) new ResizeObserver(postHeight).observe(document.body);
    postHeight();
    parent.postMessage({ type: "minint:ready" }, "*");
  });
})();`;

export function buildSandboxDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,sans-serif}</style><script>${BRIDGE_SCRIPT}</script></head><body>${html}</body></html>`;
}

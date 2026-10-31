// Pure builder (src/proxy.ts) that produces the CSP header string — tested directly since the
// proxy runtime itself (NextRequest/NextResponse) isn't exercised by vitest.
import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicy } from "@/proxy";

describe("buildContentSecurityPolicy", () => {
  it("embeds the nonce in script-src and omits 'unsafe-eval' in production", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc123", isDev: false, supabaseUrl: "" });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("adds 'unsafe-eval' and localhost websockets only in development", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc123", isDev: true, supabaseUrl: "" });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws://localhost:*");
    expect(csp).toContain("ws://127.0.0.1:*");
  });

  it("adds both http and ws/wss origins for a supabase URL", () => {
    const csp = buildContentSecurityPolicy({ nonce: "n", isDev: false, supabaseUrl: "http://127.0.0.1:54421" });
    const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
    expect(connectSrc).toContain("http://127.0.0.1:54421");
    expect(connectSrc).toContain("ws://127.0.0.1:54421");
  });

  it("derives wss for an https supabase URL", () => {
    const csp = buildContentSecurityPolicy({ nonce: "n", isDev: false, supabaseUrl: "https://abcd.supabase.co" });
    const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
    expect(connectSrc).toContain("https://abcd.supabase.co");
    expect(connectSrc).toContain("wss://abcd.supabase.co");
  });

  it("ignores a malformed supabase URL instead of throwing", () => {
    expect(() => buildContentSecurityPolicy({ nonce: "n", isDev: false, supabaseUrl: "not-a-url" })).not.toThrow();
  });

  it("always applies style-src, frame-ancestors, base-uri, and object-src per spec", () => {
    const csp = buildContentSecurityPolicy({ nonce: "n", isDev: false, supabaseUrl: "" });
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  });
});

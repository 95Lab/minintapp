import { expect, it, vi } from "vitest";
import { CloudflareDNS } from "../../platform/cloudflare";
import { overlaps } from "../../platform/docker-runtime";
import { withAppLock } from "../../platform/locks";
it("detects overlapping Docker/VPN subnets, including broad routes", () => {
  expect(overlaps("172.30.128.0/28", "172.30.0.0/16")).toBe(true);
  expect(overlaps("172.30.128.0/28", "172.30.128.8/32")).toBe(true);
  expect(overlaps("172.30.128.0/28", "172.30.129.0/28")).toBe(false);
  expect(overlaps("172.30.128.0/28", "10.0.0.0/24")).toBe(false);
});
it("retries owned DNS records without duplicates and refuses unrelated records", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true, result: [{ id: "dns1", comment: "minintapp:app1" }] })).mockResolvedValueOnce(Response.json({ success: true, result: { id: "dns1" } }));
  const dns = new CloudflareDNS("zone", "secret", "ingress.example.com", request, true);
  expect(await dns.ensure("app.example.com", "app1")).toBe("dns1");
  expect(request.mock.calls[1][1]?.method).toBe("PUT");
  request.mockResolvedValueOnce(Response.json({ success: true, result: [{ id: "other", comment: "unrelated" }] }));
  await expect(dns.ensure("other.example.com", "app1")).rejects.toThrow("owned");
  expect(request).toHaveBeenCalledTimes(3);
});
it("never deletes DNS records belonging to another app", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, result: { comment: "other" } }));
  await expect(new CloudflareDNS("zone", "secret", "ingress.example.com", request, true).remove("dns1", "app1")).rejects.toThrow("ownership");
  expect(request).toHaveBeenCalledTimes(1);
});
it("does not write DNS without explicit approval", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, result: [] }));
  await expect(new CloudflareDNS("zone", "secret", "ingress.example.com", request).ensure("app.example.com", "app1")).rejects.toThrow("approval");
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][1]?.method).toBeUndefined();
});
it("serializes provisioning and cleanup for the same app while letting other apps run", async () => {
  const events: string[] = []; let release!: () => void;
  const first = withAppLock("app", async () => { events.push("first"); await new Promise<void>((resolve) => { release = resolve; }); });
  await vi.waitFor(() => expect(events).toEqual(["first"]));
  const second = withAppLock("app", async () => { events.push("second"); });
  await withAppLock("other", async () => { events.push("other"); });
  expect(events).toEqual(["first", "other"]); release(); await Promise.all([first, second]);
  expect(events).toEqual(["first", "other", "second"]);
});

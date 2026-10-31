// Pure math behind settle-up, VietQR codes and the library-free map.
import { describe, expect, it } from "vitest";
import { balancesOf, settleTransfers } from "@/engine/money/settle-transfers";
import { crc16Ccitt, vietqrNote, vietqrPayload } from "@/engine/money/vietqr-payload";
import { fitView, formatLatLng, latLngAt, parseLatLng, placeInView, tilesForView, worldPixel } from "@/engine/geo/web-mercator-tiles";

describe("settle-up", () => {
  it("splits in whole đồng and the balances sum to zero", () => {
    const b = balancesOf([{ payer: "an", amount: 100, among: ["an", "binh", "chi"] }]);
    expect([...b.values()].reduce((s, v) => s + v, 0)).toBe(0);
    // 100 / 3 = 33 r1: the first person in order takes the odd đồng
    expect(b.get("an")).toBe(100 - 34);
    expect(b.get("binh")).toBe(-33);
  });

  it("finds the few transfers that settle a trip", () => {
    const transfers = settleTransfers([
      { payer: "an", amount: 300_000, among: ["an", "binh", "chi"] },
      { payer: "binh", amount: 60_000, among: ["an", "binh", "chi"] },
    ]);
    // each owes 120k: an +180k, binh -60k, chi -120k
    expect(transfers).toEqual([
      { from: "chi", to: "an", amount: 120_000 },
      { from: "binh", to: "an", amount: 60_000 },
    ]);
  });

  it("ignores empty or non-positive expenses and gives nothing when even", () => {
    expect(settleTransfers([{ payer: "an", amount: 0, among: ["binh"] }, { payer: "an", amount: 50, among: [] }])).toEqual([]);
    expect(settleTransfers([{ payer: "an", amount: 50, among: ["an"] }])).toEqual([]);
  });
});

describe("VietQR payload", () => {
  it("uses CRC-16/CCITT-FALSE", () => {
    expect(crc16Ccitt("123456789")).toBe("29B1");
  });

  it("builds the NAPAS transfer-to-account layout with a valid checksum", () => {
    const qr = vietqrPayload({ bin: "970436", account: "0123456789", amount: 120000, note: "Tiền ăn — Đà Lạt!" });
    expect(qr.startsWith("000201010212")).toBe(true);
    expect(qr).toContain("0010A000000727");
    // beneficiary: bank BIN (00) + account number (01)
    expect(qr).toContain("012400069704360110" + "0123456789");
    expect(qr).toContain("0208QRIBFTTA");
    expect(qr).toContain("5303704");
    expect(qr).toContain("5406120000");
    expect(qr).toContain("5802VN");
    expect(qr).toContain("Tien an Da Lat");
    const body = qr.slice(0, -4);
    expect(body.endsWith("6304")).toBe(true);
    expect(qr.slice(-4)).toBe(crc16Ccitt(body));
  });

  it("is static (11) without an amount, and notes are plain ASCII", () => {
    expect(vietqrPayload({ bin: "970422", account: "123456" }).slice(6, 12)).toBe("010211");
    expect(vietqrNote("Phở <script> 50%")).toBe("Pho script 50");
  });
});

describe("map math", () => {
  it("projects the equator/prime meridian to the world centre", () => {
    expect(worldPixel({ lat: 0, lng: 0 }, 1)).toEqual({ x: 256, y: 256 });
  });

  it("fits Hà Nội and Sài Gòn inside the view and covers it with tiles", () => {
    const points = [
      { lat: 21.028, lng: 105.854 },
      { lat: 10.776, lng: 106.701 },
    ];
    const view = fitView(points, 600, 400);
    for (const p of points) {
      const at = placeInView(p, view);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x).toBeLessThanOrEqual(600);
      expect(at.y).toBeGreaterThanOrEqual(0);
      expect(at.y).toBeLessThanOrEqual(400);
    }
    const tiles = tilesForView(view);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.left < 600 && t.top < 400 && t.left > -256 && t.top > -256)).toBe(true);
  });

  it("uses a neighbourhood zoom for one point", () => {
    expect(fitView([{ lat: 21.028, lng: 105.854 }], 600, 400).zoom).toBe(13);
  });

  it("stores ~100 m precision and refuses junk", () => {
    expect(formatLatLng({ lat: 21.02849, lng: 105.85412 })).toBe("21.028,105.854");
    expect(parseLatLng("21.028,105.854")).toEqual({ lat: 21.028, lng: 105.854 });
    expect(parseLatLng("21.02849,105.854")).toBeNull();
    expect(parseLatLng("91,0")).toBeNull();
    expect(parseLatLng("javascript:1")).toBeNull();
  });
});

describe("map taps", () => {
  it("latLngAt inverts placeInView (a tap lands on the point it was drawn from)", () => {
    const view = fitView([{ lat: 21.028, lng: 105.854 }, { lat: 10.776, lng: 106.701 }], 600, 400);
    for (const p of [{ lat: 16.05, lng: 108.2 }, { lat: 21.028, lng: 105.854 }]) {
      const at = placeInView(p, view);
      const back = latLngAt(view, at.x, at.y);
      expect(back.lat).toBeCloseTo(p.lat, 6);
      expect(back.lng).toBeCloseTo(p.lng, 6);
    }
  });

  it("a tap near the edge of the world stays in range", () => {
    const view = { zoom: 2, left: 0, top: 0, width: 400, height: 300 };
    const { lat, lng } = latLngAt(view, -50, -50);
    expect(Math.abs(lat)).toBeLessThanOrEqual(90);
    expect(lng).toBeGreaterThanOrEqual(-180);
    expect(lng).toBeLessThanOrEqual(180);
  });
});

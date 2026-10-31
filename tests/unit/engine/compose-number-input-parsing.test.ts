// Numbers typed on phones: Vietnamese money formats, decimals with comma or dot, junk rejected.
import { describe, expect, it } from "vitest";
import { parseNumberInput } from "@/engine-ui/blocks/compose-number-input";

describe("parseNumberInput", () => {
  it("reads VND amounts the way people type them", () => {
    expect(parseNumberInput("50000", "đ")).toBe(50000);
    expect(parseNumberInput("50.000", "đ")).toBe(50000);
    expect(parseNumberInput("50,000", "đ")).toBe(50000);
    expect(parseNumberInput("1 250 000", "đ")).toBe(1250000);
    expect(parseNumberInput("50k", "đ")).toBe(50000);
    expect(parseNumberInput("1,2tr", "đ")).toBe(1200000);
    expect(parseNumberInput("35000đ", "đ")).toBe(35000);
  });

  it("reads decimals with a comma or a dot, and grouped thousands", () => {
    expect(parseNumberInput("2,5", "km")).toBe(2.5);
    expect(parseNumberInput("2.5", null)).toBe(2.5);
    expect(parseNumberInput("1.234.567", null)).toBe(1234567);
    expect(parseNumberInput("-3", null)).toBe(-3);
  });

  it("rejects text that is not a number", () => {
    expect(parseNumberInput("", null)).toBeNull();
    expect(parseNumberInput("abc", null)).toBeNull();
    expect(parseNumberInput("5 người", null)).toBeNull();
    expect(parseNumberInput("12e5", "đ")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { type Chart, format, suggestSize } from "./suggest";

const ORDER = ["XS", "S", "M", "L", "XL"];
const TOP: Chart = {
  measurements: ["chest", "waist"],
  sizes: {
    XS: { chest: [80, 85], waist: [64, 69] },
    S: { chest: [86, 91], waist: [70, 75] },
    M: { chest: [92, 99], waist: [76, 83] },
    L: { chest: [100, 107], waist: [84, 91] },
    XL: { chest: [108, 115], waist: [92, 99] },
  },
};

describe("suggestSize", () => {
  it("picks the size whose ranges contain every measurement", () => {
    const s = suggestSize({ chest: 96, waist: 80 }, TOP, ORDER);
    expect(s?.size).toBe("M");
    expect(s?.reason).toBe("Your chest 96 cm is within 92–99 cm; your waist 80 cm is within 76–83 cm.");
    expect(s?.missing).toEqual([]);
  });

  it("includes both ends of a range", () => {
    expect(suggestSize({ chest: 92 }, TOP, ORDER)?.size).toBe("M");
    expect(suggestSize({ chest: 99 }, TOP, ORDER)?.size).toBe("M");
  });

  it("goes up when a measurement falls between two sizes", () => {
    const s = suggestSize({ chest: 91.5 }, TOP, ORDER);
    expect(s?.size).toBe("M");
    expect(s?.reason).toContain("between S and M, so we picked the larger");
  });

  it("uses the larger size when measurements point to different sizes, and warns about looseness", () => {
    const s = suggestSize({ chest: 96, waist: 88 }, TOP, ORDER);
    expect(s?.size).toBe("L");
    expect(s?.reason).toBe("Your waist 88 cm is within 84–91 cm; it may be loose at the chest (yours is 96 cm; L starts at 100 cm).");
  });

  it("prefers the larger size when ranges overlap", () => {
    const overlapping: Chart = { measurements: ["chest"], sizes: { S: { chest: [86, 93] }, M: { chest: [92, 99] } } };
    expect(suggestSize({ chest: 92.5 }, overlapping, ["S", "M"])?.size).toBe("M");
  });

  it("works with only some measurements and lists the missing ones", () => {
    const s = suggestSize({ chest: 88, waist: null }, TOP, ORDER);
    expect(s?.size).toBe("S");
    expect(s?.missing).toEqual(["waist"]);
  });

  it("returns null without any measurement the chart uses", () => {
    expect(suggestSize({}, TOP, ORDER)).toBeNull();
    expect(suggestSize({ hips: 100 }, TOP, ORDER)).toBeNull();
  });

  it("suggests the smallest size for someone below the chart", () => {
    const s = suggestSize({ chest: 75 }, TOP, ORDER);
    expect(s?.size).toBe("XS");
    expect(s?.reason).toContain("below the smallest size");
  });

  it("returns no size, with a reason, for someone above the chart", () => {
    const s = suggestSize({ chest: 96, waist: 105 }, TOP, ORDER);
    expect(s?.size).toBeNull();
    expect(s?.reason).toBe("Your waist (105 cm) is above this item's largest size, XL (up to 99 cm).");
  });

  it("follows the product's size order and skips sizes it doesn't sell", () => {
    expect(suggestSize({ chest: 96 }, TOP, ["S", "L"])?.size).toBe("L");
    expect(suggestSize({ chest: 96 }, TOP, [])).toBeNull();
  });

  it("speaks the user's units", () => {
    const s = suggestSize({ chest: 96, waist: 80 }, TOP, ORDER, "imperial");
    expect(s?.reason).toBe("Your chest 38 in is within 36–39 in; your waist 31.5 in is within 30–32.5 in.");
  });
});

describe("format", () => {
  it("rounds inches to the nearest half", () => {
    expect(format(96, "imperial")).toBe("38 in");
    expect(format(80, "imperial")).toBe("31.5 in");
    expect(format(91.5, "metric")).toBe("91.5 cm");
  });
});

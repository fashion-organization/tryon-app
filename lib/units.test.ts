import { describe, expect, it } from "vitest";
import {
  EMPTY_DISPLAY,
  cmToFeetInches,
  convertDisplay,
  displayFromMetric,
  metricFromDisplay,
  parseNumber,
  type Display,
  type Metric,
} from "./units";

const none: Metric = { height_cm: null, weight_kg: null, chest_cm: null, waist_cm: null, hips_cm: null };
const imperial = (d: Partial<Display>): Display => ({ ...EMPTY_DISPLAY, ...d });

function saveAndShow(d: Display, from: "metric" | "imperial", to: "metric" | "imperial") {
  const r = metricFromDisplay(d, from);
  if (!r.ok) throw new Error(r.error);
  return { stored: r.metric, shown: displayFromMetric(r.metric, to) };
}

describe("parseNumber", () => {
  it("reads numbers, empty and junk", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("  ")).toBeNull();
    expect(parseNumber("170")).toBe(170);
    expect(parseNumber("68.5")).toBe(68.5);
    expect(parseNumber("68,5")).toBe(68.5);
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("-5")).toBeNaN();
  });
});

describe("height", () => {
  it("5'7\" saved in imperial shows as 170 cm (the step 1.4 check)", () => {
    const { stored, shown } = saveAndShow(imperial({ heightFt: "5", heightIn: "7" }), "imperial", "metric");
    expect(stored.height_cm).toBe(170.2);
    expect(shown.heightCm).toBe("170");
  });

  it("170 cm shows as 5'7\"", () => {
    expect(cmToFeetInches(170)).toEqual({ feet: 5, inches: 7 });
    const shown = displayFromMetric({ ...none, height_cm: 170 }, "imperial");
    expect([shown.heightFt, shown.heightIn]).toEqual(["5", "7"]);
  });

  it("round-trips through storage without drifting", () => {
    for (let total = 4 * 12; total <= 7 * 12; total++) {
      const ft = String(Math.floor(total / 12));
      const inch = String(total % 12);
      const { shown } = saveAndShow(imperial({ heightFt: ft, heightIn: inch }), "imperial", "imperial");
      expect([shown.heightFt, shown.heightIn]).toEqual([ft, inch]);
    }
  });

  it("6 ft with no inches is 6'0\"", () => {
    const { stored } = saveAndShow(imperial({ heightFt: "6" }), "imperial", "imperial");
    expect(stored.height_cm).toBe(182.9);
  });

  it("rejects 12 or more inches and inches without feet", () => {
    expect(metricFromDisplay(imperial({ heightFt: "5", heightIn: "12" }), "imperial")).toMatchObject({ ok: false, field: "heightIn" });
    expect(metricFromDisplay(imperial({ heightIn: "7" }), "imperial")).toMatchObject({ ok: false, field: "heightFt" });
  });
});

describe("weight and body measurements", () => {
  it("150 lb round-trips", () => {
    const { stored, shown } = saveAndShow(imperial({ weight: "150" }), "imperial", "imperial");
    expect(stored.weight_kg).toBe(68);
    expect(shown.weight).toBe("150");
  });

  it("inches in half-inch steps round-trip", () => {
    const { stored, shown } = saveAndShow(imperial({ chest: "38", waist: "32.5", hips: "40" }), "imperial", "imperial");
    expect(stored).toMatchObject({ chest_cm: 96.5, waist_cm: 82.6, hips_cm: 101.6 });
    expect([shown.chest, shown.waist, shown.hips]).toEqual(["38", "32.5", "40"]);
  });

  it("metric values are stored as typed", () => {
    const r = metricFromDisplay({ ...EMPTY_DISPLAY, heightCm: "170", weight: "68.5", chest: "96" }, "metric");
    expect(r).toEqual({ ok: true, metric: { ...none, height_cm: 170, weight_kg: 68.5, chest_cm: 96 } });
  });

  it("everything is optional", () => {
    expect(metricFromDisplay(EMPTY_DISPLAY, "imperial")).toEqual({ ok: true, metric: none });
    expect(displayFromMetric(none, "imperial")).toEqual(EMPTY_DISPLAY);
  });
});

describe("validation", () => {
  it("rejects values outside the allowed ranges, in the user's units", () => {
    const r = metricFromDisplay({ ...EMPTY_DISPLAY, heightCm: "300" }, "metric");
    expect(r).toMatchObject({ ok: false, field: "heightCm", error: "Height must be between 50 and 260 cm." });
    const w = metricFromDisplay(imperial({ weight: "1000" }), "imperial");
    expect(w).toMatchObject({ ok: false, field: "weight" });
    if (!w.ok) expect(w.error).toMatch(/lb\.$/);
  });

  it("rejects text", () => {
    expect(metricFromDisplay({ ...EMPTY_DISPLAY, chest: "big" }, "metric")).toMatchObject({ ok: false, field: "chest" });
  });
});

describe("switching units in the form", () => {
  it("imperial 5'7\" switches to 170 cm and back to 5'7\"", () => {
    const metric = convertDisplay(imperial({ heightFt: "5", heightIn: "7", weight: "150" }), "imperial", "metric");
    expect(metric.heightCm).toBe("170");
    expect(metric.weight).toBe("68");
    const back = convertDisplay(metric, "metric", "imperial");
    expect([back.heightFt, back.heightIn, back.weight]).toEqual(["5", "7", "150"]);
  });

  it("keeps going when one field is unreadable", () => {
    const out = convertDisplay({ ...EMPTY_DISPLAY, heightCm: "abc", chest: "100" }, "metric", "imperial");
    expect(out.heightFt).toBe("");
    expect(out.chest).toBe("39.5");
  });
});

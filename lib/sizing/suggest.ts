import { CM_PER_INCH, type Units } from "../units";

/** Body measurements the size charts use, in cm. */
export type Measurement = "chest" | "waist" | "hips";
export type BodyMeasurements = Partial<Record<Measurement, number | null>>;

/** Same shape as a product's size_chart: for each size, inclusive body ranges in cm. */
export type Chart = {
  measurements: Measurement[];
  sizes: Record<string, Partial<Record<Measurement, [number, number]>>>;
};

export type SizeSuggestion = {
  /** The suggested size, or null when the user is outside the chart. */
  size: string | null;
  /** A plain sentence that says why, e.g. "Your chest 96 cm is within 92–99 cm." */
  reason: string;
  /** Chart measurements the user hasn't entered; adding them makes the suggestion better. */
  missing: Measurement[];
};

/**
 * Suggests a size from body measurements and a product's size chart (AI roadmap §4.4). No AI:
 * for each measurement, the size whose range contains it (the larger one if two overlap, the next
 * larger one if it falls between sizes); the suggestion is the largest of those, so nothing is
 * tight. Returns null when the user has none of the measurements the chart uses.
 *
 * `order` is the product's own size order (smallest first); sizes missing from it are left out.
 */
export function suggestSize(
  body: BodyMeasurements,
  chart: Chart,
  order: string[],
  units: Units = "metric",
): SizeSuggestion | null {
  const sizes = order.filter((s) => chart.sizes[s]);
  const used = chart.measurements.filter((m) => typeof body[m] === "number" && Number.isFinite(body[m]));
  const missing = chart.measurements.filter((m) => !used.includes(m));
  if (sizes.length === 0 || used.length === 0) return null;

  const fmt = (cm: number) => format(cm, units);
  const range = (s: string, m: Measurement) => formatRange(chart.sizes[s][m]!, units);

  // The size each measurement needs, and how it got there.
  type Need = { m: Measurement; value: number; index: number; how: "within" | "between" | "below" };
  const needs: Need[] = [];
  for (const m of used) {
    const value = body[m] as number;
    const withRange = sizes.map((s, i) => ({ i, r: chart.sizes[s][m] })).filter((x): x is { i: number; r: [number, number] } => !!x.r);
    if (withRange.length === 0) continue; // this chart doesn't give a range for m

    const containing = withRange.filter(({ r }) => value >= r[0] && value <= r[1]);
    if (containing.length) {
      needs.push({ m, value, index: containing[containing.length - 1].i, how: "within" });
      continue;
    }
    const larger = withRange.find(({ r }) => r[0] > value);
    if (!larger) {
      const last = withRange[withRange.length - 1];
      return {
        size: null,
        reason: `Your ${m} (${fmt(value)}) is above this item's largest size, ${sizes[last.i]} (up to ${fmt(last.r[1])}).`,
        missing,
      };
    }
    needs.push({ m, value, index: larger.i, how: larger.i === withRange[0].i ? "below" : "between" });
  }
  if (needs.length === 0) return null;

  const chosen = Math.max(...needs.map((n) => n.index));
  const size = sizes[chosen];

  const parts: string[] = [];
  for (const n of needs) {
    const r = chart.sizes[size][n.m];
    const v = fmt(n.value);
    if (n.index < chosen && r && n.value < r[0]) {
      parts.push(`it may be loose at the ${n.m} (yours is ${v}; ${size} starts at ${fmt(r[0])})`);
    } else if (n.how === "within" || (r && n.value >= r[0] && n.value <= r[1])) {
      parts.push(`your ${n.m} ${v} is within ${range(size, n.m)}`);
    } else if (n.how === "between") {
      parts.push(`your ${n.m} ${v} is between ${sizes[n.index - 1] ?? "sizes"} and ${size}, so we picked the larger`);
    } else {
      parts.push(`your ${n.m} ${v} is below the smallest size, so ${size} is the closest`);
    }
  }
  // Facts that support the size first, then the warnings.
  parts.sort((a, b) => Number(a.startsWith("it may")) - Number(b.startsWith("it may")));
  const text = parts.join("; ");
  return { size, reason: `${text[0].toUpperCase()}${text.slice(1)}.`, missing };
}

/** [92, 99] → "92–99 cm" or "36–39 in". */
export function formatRange([min, max]: [number, number], units: Units): string {
  return `${format(min, units).replace(/ (cm|in)$/, "")}–${format(max, units)}`;
}

/** 96 → "96 cm" or "38 in" (to the nearest half inch). */
export function format(cm: number, units: Units): string {
  if (units === "imperial") {
    const inches = Math.round((cm / CM_PER_INCH) * 2) / 2;
    return `${Number.isInteger(inches) ? inches : inches.toFixed(1)} in`;
  }
  return `${Math.round(cm * 10) / 10} cm`;
}

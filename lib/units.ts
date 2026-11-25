// Body measurements are stored in metric (cm, kg) and shown in the user's preferred units.
// The form works with strings in the shown units; these pure functions convert both ways.

export type Units = "metric" | "imperial";

export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;

/** Stored values (profiles table). null = not given. */
export type Metric = {
  height_cm: number | null;
  weight_kg: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
};

/** What the form shows, as typed. Metric uses heightCm; imperial uses heightFt + heightIn. */
export type Display = {
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string; // kg or lb
  chest: string; // cm or in
  waist: string;
  hips: string;
};

export const EMPTY_DISPLAY: Display = { heightCm: "", heightFt: "", heightIn: "", weight: "", chest: "", waist: "", hips: "" };

// Allowed ranges, same as the database checks.
export const LIMITS = {
  height_cm: [50, 260],
  weight_kg: [20, 400],
  chest_cm: [40, 250],
  waist_cm: [40, 250],
  hips_cm: [40, 250],
} as const;

type MetricField = keyof Metric;

const round = (value: number, step: number) => Math.round(value / step) * step;
/** Removes float noise such as 37.99999 and trailing zeros: 38, 96.5, 68.1 */
const show = (value: number, step: number) => String(Number(round(value, step).toFixed(2)));

/** "", "  " -> null; "170", "5.5", "5,5" -> number; anything else -> NaN */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** 170 -> { feet: 5, inches: 7 } (whole inches) */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

/** Stored metric values -> strings for the form, in the given units. */
export function displayFromMetric(m: Metric, units: Units): Display {
  if (units === "metric") {
    return {
      ...EMPTY_DISPLAY,
      heightCm: m.height_cm == null ? "" : show(m.height_cm, 1),
      weight: m.weight_kg == null ? "" : show(m.weight_kg, 0.1),
      chest: m.chest_cm == null ? "" : show(m.chest_cm, 1),
      waist: m.waist_cm == null ? "" : show(m.waist_cm, 1),
      hips: m.hips_cm == null ? "" : show(m.hips_cm, 1),
    };
  }
  const ftIn = m.height_cm == null ? null : cmToFeetInches(m.height_cm);
  const inches = (cm: number | null) => (cm == null ? "" : show(cm / CM_PER_INCH, 0.5));
  return {
    ...EMPTY_DISPLAY,
    heightFt: ftIn ? String(ftIn.feet) : "",
    heightIn: ftIn ? String(ftIn.inches) : "",
    weight: m.weight_kg == null ? "" : show(m.weight_kg / KG_PER_LB, 1),
    chest: inches(m.chest_cm),
    waist: inches(m.waist_cm),
    hips: inches(m.hips_cm),
  };
}

export type ParseResult =
  | { ok: true; metric: Metric }
  | { ok: false; field: keyof Display; error: string };

/** Form strings in the given units -> metric values to store (rounded to 0.1), with validation. */
export function metricFromDisplay(d: Display, units: Units): ParseResult {
  const toStore = (n: number) => Math.round(n * 10) / 10;
  const out: Metric = { height_cm: null, weight_kg: null, chest_cm: null, waist_cm: null, hips_cm: null };

  // Height
  if (units === "metric") {
    const cm = parseNumber(d.heightCm);
    if (Number.isNaN(cm)) return bad("heightCm", "Height must be a number.");
    out.height_cm = cm == null ? null : toStore(cm);
  } else {
    const ft = parseNumber(d.heightFt);
    const inch = parseNumber(d.heightIn);
    if (Number.isNaN(ft) || Number.isNaN(inch)) return bad("heightFt", "Height must be numbers, e.g. 5 ft 7 in.");
    if (inch != null && inch >= 12) return bad("heightIn", "Inches must be less than 12.");
    if (ft != null || inch != null) {
      if (ft == null) return bad("heightFt", "Please enter feet too.");
      out.height_cm = toStore(feetInchesToCm(ft, inch ?? 0));
    }
  }

  // Weight and body measurements
  const factor = units === "metric" ? { weight: 1, length: 1 } : { weight: KG_PER_LB, length: CM_PER_INCH };
  const fields: [keyof Display, MetricField, number, string][] = [
    ["weight", "weight_kg", factor.weight, "Weight"],
    ["chest", "chest_cm", factor.length, "Chest"],
    ["waist", "waist_cm", factor.length, "Waist"],
    ["hips", "hips_cm", factor.length, "Hips"],
  ];
  for (const [displayField, metricField, multiplier, label] of fields) {
    const n = parseNumber(d[displayField]);
    if (Number.isNaN(n)) return bad(displayField, `${label} must be a number.`);
    out[metricField] = n == null ? null : toStore(n * multiplier);
  }

  // Ranges (checked in metric, reported in the user's units)
  for (const field of Object.keys(LIMITS) as MetricField[]) {
    const value = out[field];
    const [min, max] = LIMITS[field];
    if (value != null && (value < min || value > max)) {
      return bad(displayFieldFor(field, units), rangeMessage(field, units));
    }
  }
  return { ok: true, metric: out };
}

/** Converts what is in the form when the user switches units. Unreadable fields are kept empty. */
export function convertDisplay(d: Display, from: Units, to: Units): Display {
  if (from === to) return d;
  const lenient: Metric = { height_cm: null, weight_kg: null, chest_cm: null, waist_cm: null, hips_cm: null };
  const one = (field: keyof Display, metricField: MetricField) => {
    const r = metricFromDisplay({ ...EMPTY_DISPLAY, [field]: d[field] }, from);
    if (r.ok) lenient[metricField] = r.metric[metricField];
  };
  // Height needs both imperial fields together.
  const h = metricFromDisplay({ ...EMPTY_DISPLAY, heightCm: d.heightCm, heightFt: d.heightFt, heightIn: d.heightIn }, from);
  if (h.ok) lenient.height_cm = h.metric.height_cm;
  one("weight", "weight_kg");
  one("chest", "chest_cm");
  one("waist", "waist_cm");
  one("hips", "hips_cm");
  return displayFromMetric(lenient, to);
}

function bad(field: keyof Display, error: string): ParseResult {
  return { ok: false, field, error };
}

function displayFieldFor(field: MetricField, units: Units): keyof Display {
  if (field === "height_cm") return units === "metric" ? "heightCm" : "heightFt";
  return ({ weight_kg: "weight", chest_cm: "chest", waist_cm: "waist", hips_cm: "hips" } as const)[field];
}

function rangeMessage(field: MetricField, units: Units): string {
  const [min, max] = LIMITS[field];
  const names: Record<MetricField, string> = {
    height_cm: "Height",
    weight_kg: "Weight",
    chest_cm: "Chest",
    waist_cm: "Waist",
    hips_cm: "Hips",
  };
  if (units === "metric") {
    const unit = field === "weight_kg" ? "kg" : "cm";
    return `${names[field]} must be between ${min} and ${max} ${unit}.`;
  }
  if (field === "height_cm") {
    const a = cmToFeetInches(min);
    const b = cmToFeetInches(max);
    return `Height must be between ${a.feet}'${a.inches}" and ${b.feet}'${b.inches}".`;
  }
  if (field === "weight_kg") {
    return `Weight must be between ${Math.ceil(min / KG_PER_LB)} and ${Math.floor(max / KG_PER_LB)} lb.`;
  }
  return `${names[field]} must be between ${Math.ceil(min / CM_PER_INCH)} and ${Math.floor(max / CM_PER_INCH)} in.`;
}

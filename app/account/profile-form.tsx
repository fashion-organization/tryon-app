"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfile, type ProfileFormState } from "@/lib/profile-actions";
import { convertDisplay, type Display, type Units } from "@/lib/units";
import { cn } from "@/lib/utils";

const HINTS = {
  height: "Without shoes, standing straight against a wall.",
  weight: "Optional. Helps us suggest a size when a chart lists weight.",
  chest: "Around the fullest part of your chest, under your arms, tape level.",
  waist: "Around your natural waist: the narrowest part, just above your belly button.",
  hips: "Around the fullest part of your hips and seat, feet together.",
};

export function ProfileForm({
  initialName,
  initialUnits,
  initialDisplay,
}: {
  initialName: string;
  initialUnits: Units;
  initialDisplay: Display;
}) {
  const [state, action] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const [units, setUnits] = useState<Units>(initialUnits);
  const [values, setValues] = useState<Display>(initialDisplay);
  const [name, setName] = useState(initialName);

  function switchUnits(next: Units) {
    if (next === units) return;
    setValues((v) => convertDisplay(v, units, next));
    setUnits(next);
  }

  const set = (field: keyof Display) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const length = units === "metric" ? "cm" : "in";
  const weight = units === "metric" ? "kg" : "lb";
  const invalid = (field: string) => (state.field === field ? true : undefined);

  return (
    <form action={action} className="grid gap-6">
      <div className="grid gap-1.5">
        <Label htmlFor="display_name">Name</Label>
        <Input
          id="display_name"
          name="display_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="given-name"
          aria-invalid={invalid("display_name")}
        />
      </div>

      <fieldset className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <legend className="text-sm font-medium">Measurements</legend>
          <UnitsSwitch units={units} onChange={switchUnits} />
        </div>
        <p className="text-sm text-muted-foreground">
          All optional. We use them only to suggest a size from each shop&apos;s size chart. Use a soft tape
          measure over light clothing.
        </p>

        {units === "metric" ? (
          <Measure label="Height" unit="cm" hint={HINTS.height}>
            <NumberInput name="heightCm" label="Height in cm" value={values.heightCm} onChange={set("heightCm")} invalid={invalid("heightCm")} />
          </Measure>
        ) : (
          <Measure label="Height" hint={HINTS.height}>
            <div className="flex items-center gap-2">
              <NumberInput name="heightFt" label="Height, feet" value={values.heightFt} onChange={set("heightFt")} invalid={invalid("heightFt")} />
              <span className="text-sm text-muted-foreground">ft</span>
              <NumberInput name="heightIn" label="Height, inches" value={values.heightIn} onChange={set("heightIn")} invalid={invalid("heightIn")} />
              <span className="text-sm text-muted-foreground">in</span>
            </div>
          </Measure>
        )}
        <Measure label="Weight" unit={weight} hint={HINTS.weight}>
          <NumberInput name="weight" label={`Weight in ${weight}`} value={values.weight} onChange={set("weight")} invalid={invalid("weight")} />
        </Measure>
        <Measure label="Chest" unit={length} hint={HINTS.chest}>
          <NumberInput name="chest" label={`Chest in ${length}`} value={values.chest} onChange={set("chest")} invalid={invalid("chest")} />
        </Measure>
        <Measure label="Waist" unit={length} hint={HINTS.waist}>
          <NumberInput name="waist" label={`Waist in ${length}`} value={values.waist} onChange={set("waist")} invalid={invalid("waist")} />
        </Measure>
        <Measure label="Hips" unit={length} hint={HINTS.hips}>
          <NumberInput name="hips" label={`Hips in ${length}`} value={values.hips} onChange={set("hips")} invalid={invalid("hips")} />
        </Measure>
      </fieldset>

      <input type="hidden" name="units" value={units} />
      <FormMessage error={state.error} message={state.savedAt ? "Saved." : undefined} />
      <div className="sm:w-48">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}

function UnitsSwitch({ units, onChange }: { units: Units; onChange: (u: Units) => void }) {
  return (
    <div role="radiogroup" aria-label="Units" className="inline-flex rounded-lg border p-0.5 text-sm">
      {(["imperial", "metric"] as const).map((u) => (
        <button
          key={u}
          type="button"
          role="radio"
          aria-checked={units === u}
          onClick={() => onChange(u)}
          className={cn(
            "rounded-md px-3 py-1",
            units === u ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {u === "imperial" ? "ft / in / lb" : "cm / kg"}
        </button>
      ))}
    </div>
  );
}

function Measure({ label, unit, hint, children }: { label: string; unit?: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[8rem_1fr] sm:items-start sm:gap-x-4">
      <span className="pt-1.5 text-sm font-medium">{label}</span>
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          {children}
          {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function NumberInput({
  name,
  label,
  value,
  onChange,
  invalid,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  invalid?: boolean;
}) {
  return (
    <Input
      name={name}
      aria-label={label}
      value={value}
      onChange={onChange}
      inputMode="decimal"
      autoComplete="off"
      className="w-24"
      aria-invalid={invalid}
    />
  );
}

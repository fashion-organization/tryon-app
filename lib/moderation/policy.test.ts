import { describe, expect, it } from "vitest";
import { decide } from "./policy";

describe("moderation policy", () => {
  it("passes an ordinary photo", () => {
    expect(decide({ sexual: 0.01, violence: 0.001 })).toEqual({ ok: true });
  });

  it("passes swimwear-level scores", () => {
    expect(decide({ sexual: 0.6 })).toEqual({ ok: true });
  });

  it("blocks explicit images", () => {
    expect(decide({ sexual: 0.95 })).toMatchObject({ ok: false, category: "sexual" });
  });

  it("blocks anything that may involve minors at a low score", () => {
    expect(decide({ sexual: 0.3, "sexual/minors": 0.15 })).toMatchObject({ ok: false, category: "sexual/minors" });
  });

  it("blocks graphic violence", () => {
    expect(decide({ "violence/graphic": 0.7 })).toMatchObject({ ok: false, category: "violence/graphic" });
  });

  it("ignores categories it doesn't know and missing scores", () => {
    expect(decide({ harassment: 0.99 })).toEqual({ ok: true });
    expect(decide({})).toEqual({ ok: true });
  });
});

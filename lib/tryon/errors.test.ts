import { describe, expect, it } from "vitest";
import { USER_MESSAGES, classifyError } from "./errors";

describe("classifyError", () => {
  it("maps FASHN errors to the five user messages", () => {
    expect(classifyError("PoseError")).toBe("photo_unusable");
    expect(classifyError("PoseError:garment")).toBe("garment_unusable");
    expect(classifyError("ImageLoadError:garment")).toBe("garment_unusable");
    expect(classifyError("ContentModerationError")).toBe("safety_blocked");
    expect(classifyError("UnavailableError")).toBe("busy");
    expect(classifyError("OutOfCredits")).toBe("busy");
  });

  it("maps our own codes", () => {
    expect(classifyError("timeout")).toBe("busy");
    expect(classifyError("output_blocked")).toBe("safety_blocked");
  });

  it("falls back to unknown", () => {
    expect(classifyError("ImageLoadError")).toBe("unknown");
    expect(classifyError("something new")).toBe("unknown");
    expect(classifyError(null)).toBe("unknown");
    expect(classifyError("toString")).toBe("unknown");
  });

  it("has a message for every kind", () => {
    for (const kind of ["photo_unusable", "garment_unusable", "safety_blocked", "busy", "unknown"] as const) {
      expect(USER_MESSAGES[kind].title).toBeTruthy();
    }
  });
});

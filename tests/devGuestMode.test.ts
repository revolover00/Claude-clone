import { describe, expect, it } from "vitest";
import { isDevGuestEnabled } from "../src/utils/devGuestMode";

describe("development-only guest gate", () => {
  it("requires both a Vite dev build and the explicit local-mode flag", () => {
    expect(isDevGuestEnabled({ DEV: true, VITE_ALLOW_LOCAL_MODE: "true" })).toBe(true);
    expect(isDevGuestEnabled({ DEV: false, VITE_ALLOW_LOCAL_MODE: "true" })).toBe(false);
    expect(isDevGuestEnabled({ DEV: true, VITE_ALLOW_LOCAL_MODE: "false" })).toBe(false);
    expect(isDevGuestEnabled({ DEV: true })).toBe(false);
  });
});

export interface DevGuestEnvironment {
  DEV?: unknown;
  VITE_ALLOW_LOCAL_MODE?: unknown;
}

/** Explicit opt-in only; Vite replaces DEV with false in production builds. */
export function isDevGuestEnabled(env: DevGuestEnvironment): boolean {
  return env.DEV === true && env.VITE_ALLOW_LOCAL_MODE === "true";
}

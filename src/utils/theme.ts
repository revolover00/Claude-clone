export type ColorMode = "system" | "light" | "dark";
export type ResolvedColorMode = Exclude<ColorMode, "system">;

export function resolveColorMode(mode: ColorMode, prefersLight: boolean): ResolvedColorMode {
  if (mode === "system") return prefersLight ? "light" : "dark";
  return mode;
}

export function isColorMode(value: unknown): value is ColorMode {
  return value === "system" || value === "light" || value === "dark";
}

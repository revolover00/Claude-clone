/**
 * Detects if a text starts with Arabic characters (or right-to-left scripts).
 */
export function isArabicText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  const firstLetter = trimmed.match(/[\p{L}]/u)?.[0];
  if (!firstLetter) return false;
  // Arabic Unicode ranges including basic, supplement, presentation forms
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(firstLetter);
}

/**
 * Returns time-based greeting according to local user time.
 * "Morning," | "Afternoon," | "Evening," | "Late night,"
 */
export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "Morning,";
  }
  if (hour >= 12 && hour < 17) {
    return "Afternoon,";
  }
  if (hour >= 17 && hour < 22) {
    return "Evening,";
  }
  return "Late night,";
}

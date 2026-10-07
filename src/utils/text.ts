/**
 * Detects if a text contains Arabic or RTL scripts (Arabic, Hebrew, Persian, Urdu).
 */
export function isArabicText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Match RTL characters (Arabic, Hebrew, Syriac, Thaana, NKo, Samaritan, etc.)
  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  // Test first 100 characters to determine primary direction
  const sample = trimmed.slice(0, 120);
  return rtlRegex.test(sample);
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

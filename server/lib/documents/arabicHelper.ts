export function isArabicText(text: string): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/.test(text);
}

// Arabic character joining tables for OpenType/PDF shaping
const ARABIC_FORMS: Record<string, [number, number, number, number]> = {
  "\u0621": [0xFE80, 0xFE80, 0xFE80, 0xFE80], // Hamza
  "\u0622": [0xFE81, 0xFE82, 0xFE81, 0xFE82], // Alef with madda
  "\u0623": [0xFE83, 0xFE84, 0xFE83, 0xFE84], // Alef with hamza above
  "\u0624": [0xFE85, 0xFE86, 0xFE85, 0xFE86], // Waw with hamza
  "\u0625": [0xFE87, 0xFE88, 0xFE87, 0xFE88], // Alef with hamza below
  "\u0626": [0xFE89, 0xFE8A, 0xFE8B, 0xFE8C], // Yeh with hamza
  "\u0627": [0xFE8D, 0xFE8E, 0xFE8D, 0xFE8E], // Alef
  "\u0628": [0xFE8F, 0xFE90, 0xFE91, 0xFE92], // Beh
  "\u0629": [0xFE93, 0xFE94, 0xFE93, 0xFE94], // Teh marbuta
  "\u062A": [0xFE95, 0xFE96, 0xFE97, 0xFE98], // Teh
  "\u062B": [0xFE99, 0xFE9A, 0xFE9B, 0xFE9C], // Theh
  "\u062C": [0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0], // Jeem
  "\u062D": [0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4], // Hah
  "\u062E": [0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8], // Khah
  "\u062F": [0xFEA9, 0xFEAA, 0xFEA9, 0xFEAA], // Dal
  "\u0630": [0xFEAB, 0xFEAC, 0xFEAB, 0xFEAC], // Thal
  "\u0631": [0xFEAD, 0xFEAE, 0xFEAD, 0xFEAE], // Reh
  "\u0632": [0xFEAF, 0xFEB0, 0xFEAF, 0xFEB0], // Zain
  "\u0633": [0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4], // Seen
  "\u0634": [0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8], // Sheen
  "\u0635": [0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC], // Sad
  "\u0636": [0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0], // Dad
  "\u0637": [0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4], // Tah
  "\u0638": [0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8], // Zah
  "\u0639": [0xFEC9, 0xFECA, 0xFECB, 0xFECC], // Ain
  "\u063A": [0xFECD, 0xFECE, 0xFECF, 0xFED0], // Ghain
  "\u0641": [0xFED1, 0xFED2, 0xFED3, 0xFED4], // Feh
  "\u0642": [0xFED5, 0xFED6, 0xFED7, 0xFED8], // Qaf
  "\u0643": [0xFED9, 0xFEDA, 0xFEDB, 0xFEDC], // Kaf
  "\u0644": [0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0], // Lam
  "\u0645": [0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4], // Meem
  "\u0646": [0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8], // Noon
  "\u0647": [0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC], // Heh
  "\u0648": [0xFEED, 0xFEEE, 0xFEED, 0xFEEE], // Waw
  "\u0649": [0xFEEF, 0xFEF0, 0xFBE8, 0xFBE9], // Alef maksura
  "\u064A": [0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4], // Yeh
};

// Non-connecting following letters: Alef, Dal, Thal, Reh, Zain, Waw, etc.
const RIGHT_CONNECTING_ONLY = new Set([
  "\u0622", "\u0623", "\u0624", "\u0625", "\u0627", "\u062F", "\u0630",
  "\u0631", "\u0632", "\u0648", "\u0649", "\u0629"
]);

export function shapeArabicWord(word: string): string {
  if (!isArabicText(word)) return word;

  const chars = Array.from(word);
  const shaped: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const forms = ARABIC_FORMS[ch];
    if (!forms) {
      shaped.push(ch);
      continue;
    }

    const prev = i > 0 ? chars[i - 1] : null;
    const next = i < chars.length - 1 ? chars[i + 1] : null;

    const connectsPrev = prev && ARABIC_FORMS[prev] && !RIGHT_CONNECTING_ONLY.has(prev);
    const connectsNext = next && ARABIC_FORMS[next];

    let formIndex = 0; // Isolated
    if (connectsPrev && connectsNext) {
      formIndex = 2; // Medial
    } else if (connectsPrev) {
      formIndex = 1; // Final
    } else if (connectsNext) {
      formIndex = 3; // Initial
    }

    shaped.push(String.fromCharCode(forms[formIndex]));
  }

  return shaped.join("");
}

export function shapeAndReverseArabic(text: string): string {
  if (!isArabicText(text)) return text;

  // Split into tokens (words and punctuation/numbers)
  const tokens = text.split(/(\s+|[0-9]+|[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC\w]+)/);
  const shapedTokens = tokens.map((token) => {
    if (isArabicText(token)) {
      return shapeArabicWord(token).split("").reverse().join("");
    }
    return token;
  });

  // Reverse words overall for RTL visual reading order in left-to-right renderers
  return shapedTokens.reverse().join("");
}

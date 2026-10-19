import { describe, it, expect } from "vitest";
import { isArabicText, getTimeGreeting, formatGreeting } from "../src/utils/text";

describe("text utils", () => {
  describe("isArabicText", () => {
    it("returns true for pure Arabic text", () => {
      expect(isArabicText("مرحبا كيف حالك؟")).toBe(true);
      expect(isArabicText("السلام عليكم ورحمة الله")).toBe(true);
      expect(isArabicText("كيف يمكنني مساعدتك اليوم؟")).toBe(true);
    });

    it("returns true for mixed Arabic and English text starting with Arabic", () => {
      expect(isArabicText("مرحبا React و TypeScript")).toBe(true);
    });

    it("returns true for Hebrew text", () => {
      expect(isArabicText("שלום עולם")).toBe(true);
    });

    it("returns false for English and Latin text", () => {
      expect(isArabicText("Hello, how are you?")).toBe(false);
      expect(isArabicText("1234567890")).toBe(false);
      expect(isArabicText("const x = 'hello';")).toBe(false);
    });

    it("returns false for empty or whitespace text", () => {
      expect(isArabicText("")).toBe(false);
      expect(isArabicText("   \n\t  ")).toBe(false);
    });
  });

  describe("getTimeGreeting", () => {
    it("returns a valid greeting ending with comma", () => {
      const greeting = getTimeGreeting();
      expect(["Morning,", "Afternoon,", "Evening,", "Late night,"]).toContain(greeting);
    });
  });

  describe("formatGreeting", () => {
    it("formats known name with a single comma and no double commas", () => {
      expect(formatGreeting("Morning,", "Alice")).toBe("Morning, Alice");
      expect(formatGreeting("Afternoon,", "Bob")).toBe("Afternoon, Bob");
      expect(formatGreeting("Evening,", "Carol")).toBe("Evening, Carol");
      expect(formatGreeting("Late night,", "Dave")).toBe("Late night, Dave");
      expect(formatGreeting("Morning", "Alice")).toBe("Morning, Alice");
    });

    it("formats unknown or default name without double commas", () => {
      expect(formatGreeting("Morning,", "")).toBe("Morning, how are things?");
      expect(formatGreeting("Morning,", "   ")).toBe("Morning, how are things?");
      expect(formatGreeting("Morning,", "You")).toBe("Morning, how are things?");
      expect(formatGreeting("Morning,", null)).toBe("Morning, how are things?");
      expect(formatGreeting("Morning,", undefined)).toBe("Morning, how are things?");
      expect(formatGreeting("Evening", "")).toBe("Evening, how are things?");
    });
  });
});

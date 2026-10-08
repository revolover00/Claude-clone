import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAdaptiveDrainRate,
  isInsideSurrogatePair,
  adjustDrainBoundary,
  autoCloseMarkdown,
  isCompleteOrNonTable,
  formatThinkingDuration,
} from "../src/utils/streamSmoothing";
import { SmoothStreamer } from "../src/utils/smoothStreamer";

describe("Stream Smoothing Utilities", () => {
  describe("getAdaptiveDrainRate", () => {
    it("returns 0 for empty queue", () => {
      expect(getAdaptiveDrainRate(0)).toBe(0);
      expect(getAdaptiveDrainRate(-5)).toBe(0);
    });

    it("returns minimum 1 for small queue (steady typing)", () => {
      expect(getAdaptiveDrainRate(1)).toBe(1);
      expect(getAdaptiveDrainRate(5)).toBe(1);
      expect(getAdaptiveDrainRate(10)).toBe(1);
    });

    it("returns adaptive rate for medium queue", () => {
      expect(getAdaptiveDrainRate(25)).toBe(3); // ceil(2.5) = 3
      expect(getAdaptiveDrainRate(50)).toBe(5);
      expect(getAdaptiveDrainRate(150)).toBe(15);
      expect(getAdaptiveDrainRate(300)).toBe(30);
    });

    it("clamps at maximum 60 chars per frame", () => {
      expect(getAdaptiveDrainRate(600)).toBe(60);
      expect(getAdaptiveDrainRate(2000)).toBe(60);
    });
  });

  describe("adjustDrainBoundary & surrogate pairs", () => {
    it("never cuts inside a surrogate pair (e.g. emoji 🤖)", () => {
      // 🤖 is "\uD83E\uDD16" (2 code units, length 2)
      const text = "Hello 🤖 world";
      // "Hello " is length 6, high surrogate is at index 6, low surrogate is at index 7
      expect(isInsideSurrogatePair(text, 7)).toBe(true);

      // Raw cut at 7 falls between \uD83E and \uDD16
      const adjusted = adjustDrainBoundary(text, 7);
      expect(adjusted).toBe(8); // Advances past the low surrogate
      expect(text.slice(0, adjusted)).toBe("Hello 🤖");
    });

    it("does not split delimiter tokens like ``` or **", () => {
      const text = "Here is ```javascript";
      // "Here is " is length 8, first ` is index 8, second is 9, third is 10
      const cutAtFirstBacktick = adjustDrainBoundary(text, 9);
      expect(cutAtFirstBacktick).toBe(11); // Advances past the whole ```
      expect(text.slice(0, cutAtFirstBacktick)).toBe("Here is ```");
    });

    it("does not split bold ** markers", () => {
      const text = "This is **bold text";
      const cut = adjustDrainBoundary(text, 9); // between first and second *
      expect(cut).toBe(10);
      expect(text.slice(0, cut)).toBe("This is **");
    });
  });

  describe("autoCloseMarkdown", () => {
    it("auto closes unclosed code fences ```", () => {
      const input = "Here is code:\n```typescript\nconst x = 10;";
      const closed = autoCloseMarkdown(input);
      expect(closed.endsWith("```")).toBe(true);
      expect(closed).toBe("Here is code:\n```typescript\nconst x = 10;\n```");
    });

    it("leaves already closed ``` code fences alone", () => {
      const input = "```js\nconsole.log(1);\n```";
      expect(autoCloseMarkdown(input)).toBe(input);
    });

    it("auto closes unclosed inline code `", () => {
      const input = "Use the function `foo(bar)";
      expect(autoCloseMarkdown(input)).toBe("Use the function `foo(bar)`");
    });

    it("auto closes unclosed bold **", () => {
      const input = "This is **very important";
      expect(autoCloseMarkdown(input)).toBe("This is **very important**");
    });

    it("auto closes unclosed italic *", () => {
      const input = "This is *italicized text";
      expect(autoCloseMarkdown(input)).toBe("This is *italicized text*");
    });
  });

  describe("isCompleteOrNonTable", () => {
    it("returns true for regular text", () => {
      expect(isCompleteOrNonTable("Regular paragraph")).toBe(true);
    });

    it("returns false for partial table with only header row", () => {
      const partial = "| Column 1 | Column 2 |";
      expect(isCompleteOrNonTable(partial)).toBe(false);
    });

    it("returns true once header and separator rows exist", () => {
      const table = "| Col 1 | Col 2 |\n| --- | --- |\n| A | B |";
      expect(isCompleteOrNonTable(table)).toBe(true);
    });
  });

  describe("formatThinkingDuration", () => {
    it("formats sub-minute times accurately", () => {
      expect(formatThinkingDuration(8400)).toBe("8s");
      expect(formatThinkingDuration(12000)).toBe("12s");
      expect(formatThinkingDuration(42300)).toBe("42s");
    });

    it("formats minute + second times accurately", () => {
      expect(formatThinkingDuration(65000)).toBe("1m 5s");
      expect(formatThinkingDuration(120000)).toBe("2m");
    });
  });

  describe("SmoothStreamer (drain queue & flush)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("pushes tokens and flushes immediately on flushImmediate", () => {
      let latestText = "";
      let isDone = false;
      const streamer = new SmoothStreamer({
        onUpdate: (text, done) => {
          latestText = text;
          isDone = done;
        },
      });

      streamer.start();
      streamer.push("Hello ");
      streamer.push("World! 🤖");
      streamer.flushImmediate();

      expect(latestText).toBe("Hello World! 🤖");
      expect(isDone).toBe(true);
      expect(streamer.getDisplayedText()).toBe("Hello World! 🤖");
    });

    it("flushes remaining text within 400ms when markDone is called", () => {
      let latestText = "";
      let isDone = false;
      const streamer = new SmoothStreamer({
        onUpdate: (text, done) => {
          latestText = text;
          isDone = done;
        },
      });

      streamer.start();
      streamer.push("A".repeat(100));
      streamer.markDone();

      // Advance timers by 400ms
      vi.advanceTimersByTime(450);

      expect(latestText.length).toBe(100);
      expect(isDone).toBe(true);
    });
  });
});

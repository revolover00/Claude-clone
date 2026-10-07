import { describe, it, expect } from "vitest";
import {
  detectArtifact,
  extractArtifactTitle,
  getArtifactType,
  isArtifactCandidate,
} from "../src/utils/artifactDetector";

describe("artifactDetector", () => {
  describe("getArtifactType", () => {
    it("identifies HTML type correctly", () => {
      expect(getArtifactType("html", "<div>Hello</div>")).toBe("HTML");
      expect(getArtifactType("xml", "<root></root>")).toBe("HTML");
    });

    it("identifies SVG type correctly", () => {
      expect(getArtifactType("svg", "<svg></svg>")).toBe("SVG");
      expect(getArtifactType("xml", '<svg viewBox="0 0 100 100"></svg>')).toBe("SVG");
    });

    it("identifies React type correctly", () => {
      expect(getArtifactType("tsx", "export default function App() {}")).toBe("React");
      expect(getArtifactType("jsx", "const Comp = () => <div/>")).toBe("React");
      expect(getArtifactType("react", "function Component() {}")).toBe("React");
    });

    it("identifies Markdown type correctly", () => {
      expect(getArtifactType("markdown", "# Title")).toBe("Markdown");
      expect(getArtifactType("md", "# Subtitle")).toBe("Markdown");
    });
  });

  describe("extractArtifactTitle", () => {
    it("extracts from <title> tag", () => {
      const code = "<html><head><title>My Dashboard</title></head></html>";
      expect(extractArtifactTitle(code, "HTML")).toBe("My Dashboard");
    });

    it("extracts from <h1> tag", () => {
      const code = "<div><h1>Sales Report</h1></div>";
      expect(extractArtifactTitle(code, "HTML")).toBe("Sales Report");
    });

    it("extracts from markdown header", () => {
      const code = "# Project Roadmap\n\nSome text...";
      expect(extractArtifactTitle(code, "Markdown")).toBe("Project Roadmap");
    });

    it("extracts from code comments", () => {
      const code = "// Title: Interactive Chart\nconst a = 1;";
      expect(extractArtifactTitle(code, "React")).toBe("Interactive Chart");
    });

    it("extracts React component name", () => {
      const code = "export const PricingCard = () => { return <div />; }";
      expect(extractArtifactTitle(code, "React")).toBe("PricingCard Component");
    });

    it("falls back to Untitled when no title indicators exist", () => {
      const code = "const x = 42;";
      expect(extractArtifactTitle(code, "Code")).toBe("Untitled");
    });
  });

  describe("isArtifactCandidate", () => {
    it("accepts long code blocks", () => {
      const longCode = Array(20).fill("const line = true;").join("\n");
      expect(isArtifactCandidate("tsx", longCode)).toBe(true);
    });

    it("accepts short code blocks when creation intent is in user prompt", () => {
      const shortCode = "<div>\n  <button>Click</button>\n</div>";
      expect(isArtifactCandidate("html", shortCode, "Please create a button")).toBe(true);
      expect(isArtifactCandidate("html", shortCode, "build me a button")).toBe(true);
      expect(isArtifactCandidate("html", shortCode, "صمم لي زر")).toBe(true);
    });

    it("rejects non-artifact languages", () => {
      const code = "SELECT * FROM users;\n".repeat(20);
      expect(isArtifactCandidate("sql", code)).toBe(false);
    });
  });

  describe("detectArtifact", () => {
    it("detects and parses a full HTML artifact", () => {
      const content = `Here is your page:
\`\`\`html
<!DOCTYPE html>
<html>
  <head>
    <title>Landing Page</title>
  </head>
  <body>
    <h1>Welcome</h1>
  </body>
</html>
\`\`\``;
      const artifact = detectArtifact(content, "create a landing page");
      expect(artifact).not.toBeNull();
      expect(artifact?.title).toBe("Landing Page");
      expect(artifact?.type).toBe("HTML");
      expect(artifact?.language).toBe("html");
    });

    it("returns null when no matching code block exists", () => {
      expect(detectArtifact("Just plain text without code blocks.")).toBeNull();
      expect(detectArtifact("")).toBeNull();
    });
  });
});

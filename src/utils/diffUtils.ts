import hljs from "./hljs";

export interface DiffLine {
  type: "added" | "removed" | "normal";
  content: string;
}

export function computeLineDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const diff: DiffLine[] = [];

  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        diff.push({ type: "normal", content: newLines[j] });
        i++;
        j++;
      } else {
        // Look ahead 5 lines to detect structural insertions / deletions
        let foundMatch = false;
        for (let k = 1; k <= 5; k++) {
          if (i + k < oldLines.length && oldLines[i + k] === newLines[j]) {
            for (let m = 0; m < k; m++) {
              diff.push({ type: "removed", content: oldLines[i + m] });
            }
            i += k;
            foundMatch = true;
            break;
          }
          if (j + k < newLines.length && oldLines[i] === newLines[j + k]) {
            for (let m = 0; m < k; m++) {
              diff.push({ type: "added", content: newLines[j + m] });
            }
            j += k;
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) {
          diff.push({ type: "removed", content: oldLines[i] });
          diff.push({ type: "added", content: newLines[j] });
          i++;
          j++;
        }
      }
    } else if (i < oldLines.length) {
      diff.push({ type: "removed", content: oldLines[i] });
      i++;
    } else if (j < newLines.length) {
      diff.push({ type: "added", content: newLines[j] });
      j++;
    }
  }
  return diff;
}

export function computeHighlightedDiffLines(
  previousCode: string,
  currentCode: string,
  lang: string,
  highlightedLines: string[]
): Array<{ type: "added" | "removed" | "normal"; html: string }> {
  const diff = computeLineDiff(previousCode, currentCode);
  const oldLines = previousCode.split("\n");
  let oldHighlighted: string[];
  try {
    if (lang && hljs.getLanguage(lang)) {
      oldHighlighted = hljs.highlight(previousCode, { language: lang }).value.split("\n");
    } else {
      oldHighlighted = hljs.highlightAuto(previousCode).value.split("\n");
    }
  } catch {
    oldHighlighted = oldLines.map((l) =>
      l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    );
  }

  const res: Array<{ type: "added" | "removed" | "normal"; html: string }> = [];
  let oldIdx = 0;
  let newIdx = 0;

  for (const line of diff) {
    if (line.type === "normal") {
      res.push({ type: "normal", html: highlightedLines[newIdx] || "" });
      oldIdx++;
      newIdx++;
    } else if (line.type === "added") {
      res.push({ type: "added", html: highlightedLines[newIdx] || "" });
      newIdx++;
    } else if (line.type === "removed") {
      res.push({ type: "removed", html: oldHighlighted[oldIdx] || "" });
      oldIdx++;
    }
  }
  return res;
}

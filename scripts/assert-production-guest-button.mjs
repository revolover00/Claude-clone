import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const marker = "Continue as guest (dev only)";

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  }));
  return nested.flat();
}

const files = await filesUnder(root);
const offenders = [];
for (const file of files.filter((name) => /\.(html|js)$/.test(name))) {
  if ((await readFile(file, "utf8")).includes(marker)) offenders.push(path.relative(root, file));
}
if (offenders.length) throw new Error(`Production guest button leaked into: ${offenders.join(", ")}`);
console.log("Production guest-button check passed.");

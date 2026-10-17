#!/usr/bin/env node
/**
 * Model health & pricing checks.
 *
 * Run LOCALLY (needs provider network access — not available in sandboxes):
 *
 *   GROQ_API_KEY=gsk_... node scripts/check-models.mjs
 *       Compares the live Groq /models list against the bundled catalog:
 *       flags bundled models Groq no longer serves (drop via catalog:sync)
 *       and live models the bundle is missing (refresh with catalog:sync).
 *
 *   GROQ_API_KEY=gsk_... node scripts/check-models.mjs --chat
 *       additionally sends a 1-word probe to EVERY live model and reports
 *       PASS / FAIL / rate-limited per model.
 *
 *   node scripts/check-models.mjs --free-audit
 *       offline: prints how every bundled model is labelled (Free /
 *       Free tier / paid) and flags anything that claims Free while its
 *       price row is non-zero.
 */
import fs from "node:fs";

const CHAT = process.argv.includes("--chat");
const FREE_AUDIT = process.argv.includes("--free-audit");
const KEY = process.env.GROQ_API_KEY;
const GROQ = "https://api.groq.com/openai/v1";

function bundledGroqIds() {
  const src = fs.readFileSync("src/shared/catalog/providers/groq.ts", "utf8");
  return [...src.matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]);
}

function freeAudit() {
  const providers = ["gemini", "groq", "openai", "xai", "mistral", "deepseek", "cerebras", "togetherai", "fireworks", "nvidia", "qwen", "moonshotai", "zai", "perplexity"];
  const freeTier = new Set(["gemini", "groq"]); // src/shared/catalog/freeTier.ts
  let problems = 0;
  for (const p of providers) {
    const file = `src/shared/catalog/providers/${p}.ts`;
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    const rows = [...src.matchAll(/\{ id: "([^"]+)"[^\n]*?price: \[([^\]]*)\]/g)];
    let free = 0, paid = 0, unpriced = 0;
    for (const [, id, priceRaw] of rows) {
      const prices = priceRaw.split(",").map((s) => Number(s.trim()));
      if (prices.length === 0 || priceRaw === "") unpriced++;
      else if (prices.every((v) => v === 0)) free++;
      else {
        paid++;
        if (id.toLowerCase().includes("free") && !priceRaw.split(",").every((v) => Number(v.trim()) === 0)) {
          console.log(`  ⚠ "${id}" looks free by name but costs ${priceRaw} — badge will show the price, not Free.`);
          problems++;
        }
      }
    }
    const chip = freeTier.has(p) ? " [Free tier provider]" : "";
    console.log(`${p.padEnd(11)} free=${String(free).padStart(3)} paid=${String(paid).padStart(3)} unpriced=${String(unpriced).padStart(3)}${chip}`);
  }
  console.log(problems ? `\n${problems} suspicious free-labelled models (see above).` : "\nNo free-labelled model has a non-zero price — labels are honest.");
}

async function main() {
  if (FREE_AUDIT) {
    freeAudit();
    return;
  }
  if (!KEY) {
    console.error("Set GROQ_API_KEY first:  GROQ_API_KEY=... node scripts/check-models.mjs [--chat]");
    process.exit(1);
  }

  const liveRes = await fetch(`${GROQ}/models`, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!liveRes.ok) {
    console.error(`Groq /models failed: HTTP ${liveRes.status} ${await liveRes.text()}`);
    process.exit(1);
  }
  const live = (await liveRes.json()).data.map((m) => m.id).sort();
  const bundled = bundledGroqIds();

  const dead = bundled.filter((id) => !live.includes(id));
  const missing = live.filter((id) => !bundled.includes(id));
  console.log(`Bundled: ${bundled.length} · Live on Groq: ${live.length}`);
  if (dead.length) {
    console.log(`\n✗ In catalog but NOT served by Groq (will 404 — remove via catalog:sync):`);
    dead.forEach((id) => console.log(`   - ${id}`));
  }
  if (missing.length) {
    console.log(`\n+ Live on Groq but missing from the catalog (refresh: npm run catalog:sync):`);
    missing.forEach((id) => console.log(`   + ${id}`));
  }
  if (!dead.length && !missing.length) console.log("✓ Catalog and Groq's live list match exactly.");

  if (!CHAT) return;

  console.log("\nProbing every live model with a 1-word chat…");
  let pass = 0, fail = 0, limited = 0;
  for (const id of live) {
    try {
      const res = await fetch(`${GROQ}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: id, messages: [{ role: "user", content: "Reply with the single word OK." }], stream: false }),
      });
      if (res.status === 429) {
        limited++;
        console.log(`  ~ ${id}  RATE-LIMITED (rerun later)`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      const body = await res.json().catch(() => ({}));
      const text = body?.choices?.[0]?.message?.content;
      if (res.ok && text) {
        pass++;
        console.log(`  ✓ ${id}`);
      } else {
        fail++;
        console.log(`  ✗ ${id}  HTTP ${res.status} ${(body?.error?.message || "").slice(0, 120)}`);
      }
    } catch (err) {
      fail++;
      console.log(`  ✗ ${id}  ${String(err).slice(0, 120)}`);
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log(`\nPASS=${pass} FAIL=${fail} RATE-LIMITED=${limited}`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

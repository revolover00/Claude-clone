/**
 * Captures the README screenshots from the running dev server.
 *
 *   npm run dev -- --port 3000   (in another shell)
 *   node scripts/screenshot-readme.mjs
 *
 * Requires a headless Chromium. In sandboxes without system Chrome use:
 *   npm install --no-save puppeteer-core @sparticuz/chromium
 * and extract the bundled libs once (brotli tarball):
 *   node -e "const z=require('zlib'),fs=require('fs');fs.writeFileSync('/tmp/al2023.tar',z.brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')))" && mkdir -p /tmp/al2023x && tar -xf /tmp/al2023.tar -C /tmp/al2023x
 * then run with LD_LIBRARY_PATH=/tmp/al2023x/lib:/tmp (handled below).
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const BASE = process.env.SHOT_BASE_URL || "http://localhost:3000";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

/** Fake /api/chat SSE reply so screenshots work without provider keys. */
const REPLY =
  "Absolutely — here's the short version:\n\n" +
  "1. The client streams over the shared `/api/chat` SSE contract\n" +
  "2. Every provider in the catalog is addressable as `provider:model`\n" +
  "3. Keys stay on your side — the server ships with none\n\n" +
  "```ts\nconst answer = 42; // artifacts render inline, too\n```\n\n" +
  "That's it!";

const SSE_BODY =
  REPLY.match(/[\s\S]{1,12}/g)
    .map((chunk) => `data: ${JSON.stringify({ token: chunk })}\n\n`)
    .join("") + "data: [DONE]\n\n";

const clickByText = (page, sel, text) =>
  page.evaluate(
    ({ sel, text }) => {
      const el = [...document.querySelectorAll(sel)].find((e) =>
        (e.textContent || "").includes(text)
      );
      if (el) el.click();
      return Boolean(el);
    },
    { sel, text }
  );

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: "/tmp/al2023x/lib:/tmp" },
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/chat") && req.method() === "POST") {
      req.respond({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
        body: SSE_BODY,
      });
      return;
    }
    req.continue();
  });

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, name), type: "jpeg", quality: 82 });
    console.log("captured", name);
  };

  // 1. Clean home / greeting
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 45000 });
  await settle(1500);
  await clickByText(page, "button", "Not now");
  await settle(500);
  await shot("home.jpg");

  // 2. A conversation in the main chat (mocked stream)
  await page.click('textarea[aria-label="Message Claude"]');
  await page.type('textarea[aria-label="Message Claude"]', "Give me the short version");
  await page.keyboard.press("Enter");
  await page
    .waitForFunction(() => document.body.innerText.includes("That's it!"), { timeout: 30000 })
    .catch(() => console.warn("warn: reply marker not seen (smooth streamer slow)"));
  await settle(2500);
  await shot("chat.jpg");

  // 3. Model picker / catalog menu
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 45000 });
  await settle(1200);
  await clickByText(page, "button", "Not now");
  await page.click('button[aria-label="Model options"]').catch(async () => {
    await clickByText(page, "button", "Model options");
  });
  await settle(900);
  await shot("models.jpg");
  await page.keyboard.press("Escape");

  // 4. Settings > Providers
  await clickByText(page, "button", "Guest User");
  await settle(500);
  await clickByText(page, "button", "Settings");
  await settle(900);
  await clickByText(page, "button", "Providers");
  await page
    .waitForFunction(() => !document.body.innerText.includes("Loading providers"), {
      timeout: 15000,
    })
    .catch(() => console.warn("warn: providers list still loading"));
  await settle(600);
  await shot("providers.jpg");
  await page.keyboard.press("Escape");
  await settle(400);

  // 5. assistant-ui thread at /assistant (mocked stream)
  await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle2", timeout: 45000 });
  await settle(1500);
  const box = await page.$("textarea");
  if (box) {
    await box.click();
    await page.keyboard.type("What can this thread do?");
    await page.click('button[aria-label="Send message"]');
    await page
      .waitForFunction(() => document.body.innerText.includes("That's it!"), { timeout: 30000 })
      .catch(() => console.warn("warn: assistant reply marker not seen"));
    await settle(1500);
  }
  await shot("assistant-ui.jpg");

  await browser.close();
  console.log("done ->", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

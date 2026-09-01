import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SVG = readFileSync("/workspace/.grok/favicon.svg", "utf8");
const PAPER = "#F7F1E8";
const executablePath =
  "/opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell";

function pageHtml({ size, bg, glyphRatio }) {
  const glyph = Math.round(size * glyphRatio);
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; background: ${bg}; }
  .wrap { width: ${size}px; height: ${size}px; display: grid; place-items: center; }
  svg { width: ${glyph}px; height: ${glyph}px; display: block; }
</style></head>
<body><div class="wrap">${SVG}</div></body></html>`;
}

const jobs = [
  { file: "/workspace/.grok/icon-preview/favicon-16.png", size: 16, bg: "transparent", glyphRatio: 1, omitBg: true },
  { file: "/workspace/.grok/icon-preview/favicon-16-paper.png", size: 16, bg: PAPER, glyphRatio: 1, omitBg: false },
  { file: "/workspace/.grok/icon-preview/favicon-32.png", size: 32, bg: "transparent", glyphRatio: 1, omitBg: true },
  { file: "/workspace/.grok/icon-preview/favicon-32-paper.png", size: 32, bg: PAPER, glyphRatio: 1, omitBg: false },
  { file: "/workspace/.grok/icon-preview/favicon-64.png", size: 64, bg: PAPER, glyphRatio: 1, omitBg: false },
  { file: "/workspace/.grok/icon-192.png.tmp.png", size: 192, bg: PAPER, glyphRatio: 0.8, omitBg: false },
  { file: "/workspace/.grok/icon-512.png.tmp.png", size: 512, bg: PAPER, glyphRatio: 0.8, omitBg: false },
  { file: "/workspace/.grok/apple-touch-icon.png.tmp.png", size: 180, bg: PAPER, glyphRatio: 0.8, omitBg: false },
];

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--disable-gpu"],
  headless: true,
});

for (const job of jobs) {
  const page = await browser.newPage({
    viewport: { width: job.size, height: job.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(pageHtml(job), { waitUntil: "load" });
  mkdirSync(dirname(job.file), { recursive: true });
  await page.screenshot({
    path: job.file,
    omitBackground: job.omitBg,
    type: "png",
  });
  await page.close();
  console.log("wrote", job.file);
}

await browser.close();

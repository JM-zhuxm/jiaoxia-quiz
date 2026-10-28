#!/usr/bin/env node
/**
 * Regenerate the five flat-cartoon illustrations used by the game.
 *
 * The illustrations are produced by the configured Agnes image provider
 * (openai-images compatible endpoint). The endpoint rejects the optional
 * `quality` / `output_format` fields, so this script sends the minimal
 * payload only.
 *
 * Usage:
 *   AGNES_API_KEY=sk-... node scripts/gen-art.mjs
 *
 * Outputs PNG + WebP into public/art/.
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "..", "public", "art");
const API_KEY = process.env.AGNES_API_KEY;
const BASE_URL = process.env.AGNES_BASE_URL ?? "https://apihub.agnes-ai.com/v1";
const MODEL = process.env.AGNES_IMAGE_MODEL ?? "agnes-image-2.1-flash";
const SIZE = "1024x1024";

const STYLE = [
  "flat vector cartoon illustration for a Chinese driving-school quiz game",
  "clean geometric shapes, soft pastel palette, very light cream background",
  "gentle soft shading, friendly and modern, centered composition with generous margin",
  "no text, no letters, no numbers, no watermark, no photorealism",
].join(", ");

const ASSETS = [
  {
    file: "art-1-cover",
    prompt: [
      "A young Chinese driving-school student sitting in the passenger seat of a small blue learner car, leaning forward and looking attentively at the road ahead, both hands on the steering wheel, wearing a white shirt",
      "view from inside the car through the windshield, dashboard and rear-view mirror visible, warm sunlight and a soft orange-cream sky outside, a gentle road curve",
      STYLE,
    ].join(", "),
  },
  {
    file: "art-2-seatbelt",
    prompt: [
      "Upper body of a smiling adult person wearing a blue shirt, seated in a car seat, wearing the seat belt correctly",
      "the dark blue diagonal strap runs from the left shoulder across the chest to the right hip and the lap belt crosses the hips, buckle visible at the side",
      STYLE,
    ].join(", "),
  },
  {
    file: "art-3-sign",
    prompt: [
      "A single round Chinese traffic sign: a bold red ring around a plain white centre, mounted on a slim grey metal pole, seen straight on",
      "simple clean geometry, soft drop shadow, no pictogram inside the circle",
      STYLE,
    ].join(", "),
  },
  {
    file: "art-4-crossing",
    prompt: [
      "A wide city crossroads seen from a slightly elevated angle: asphalt road with white zebra crossing stripes and lane markings, a traffic light on a pole, a small blue car and a white bus on the road, two simple pedestrians on the sidewalk, low simple buildings and a couple of green trees behind, bright clear day",
      STYLE,
    ].join(", "),
  },
  {
    file: "art-5-car",
    prompt: [
      "A cute small blue compact car seen from the front, rounded friendly shapes, two round headlights, a simple smiling grille, chunky little tyres, soft drop shadow",
      "centred and symmetrical, icon style",
      STYLE,
    ].join(", "),
  },
];

async function generate(asset) {
  const response = await fetch(`${BASE_URL}/images/generations`, {
    method: "POST",
    headers: { authorization: `Bearer ${API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: asset.prompt, size: SIZE }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${asset.file}: ${response.status} ${JSON.stringify(body).slice(0, 300)}`);
  }
  const result = body?.data?.[0];
  const url = result?.url;
  if (!url) throw new Error(`${asset.file}: provider returned no image url`);
  const image = await fetch(url);
  if (!image.ok) throw new Error(`${asset.file}: download failed (${image.status})`);
  return Buffer.from(await image.arrayBuffer());
}

async function toWebP(pngPath, webpPath) {
  execFileSync("python3", [
    "-c",
    [
      "import sys",
      "from PIL import Image",
      "im = Image.open(sys.argv[1]).convert('RGB')",
      "im.save(sys.argv[2], 'WEBP', quality=88, method=6)",
    ].join("\n"),
    pngPath,
    webpPath,
  ]);
}

async function main() {
  if (!API_KEY) {
    console.error("AGNES_API_KEY is not set.");
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });
  for (const asset of ASSETS) {
    process.stdout.write(`generating ${asset.file} … `);
    const png = await generate(asset);
    const pngPath = path.join(OUT_DIR, `${asset.file}.png`);
    const webpPath = path.join(OUT_DIR, `${asset.file}.webp`);
    await writeFile(pngPath, png);
    await toWebP(pngPath, webpPath);
    await rm(pngPath);
    const { size } = await import("node:fs/promises").then((fs) => fs.stat(webpPath));
    console.log(`${(size / 1024).toFixed(0)} kB → ${path.relative(process.cwd(), webpPath)}`);
  }
}

main().catch((error) => {
  console.error(String(error?.message ?? error));
  process.exit(1);
});

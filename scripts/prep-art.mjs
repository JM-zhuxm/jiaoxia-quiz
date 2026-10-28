/**
 * 把生成的 PNG 素材裁剪成游戏用图并转成 WebP。
 * 用法：node scripts/prep-art.mjs
 * 依赖：python3 + Pillow（脚本内部调用 python3 完成裁剪/转码）
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const GEN = join(ROOT, 'assets/generated');
const OUT = join(ROOT, 'public/art');

/** 源图 → 裁剪区域（源图坐标系）与输出文件 */
const PLAN = [
  {
    out: 'art-1-cover.webp',
    src: 'image-22b8711b-061a-4289-817a-10f97e49d475.png',
    crop: [380, 150, 868, 530],
  },
  {
    out: 'art-2-seatbelt.webp',
    src: 'image-e70ee265-447a-4978-91b6-042dd03597d0.png',
    crop: [60, 150, 1690, 1690],
  },
  {
    out: 'art-3-sign.webp',
    src: 'image-25b2546d-5dfb-452f-87f1-2426eb87575b.png',
    crop: [541, 348, 968, 968],
  },
  {
    out: 'art-4-crossing.webp',
    src: 'image-1572c2da-8605-4c23-a36b-825eb668a52d.png',
    crop: [0, 0, 1248, 832],
  },
  {
    out: 'art-5-car.webp',
    src: 'image-e49c26a1-3274-4841-a37e-37da71edf707.png',
    crop: [584, 580, 878, 878],
  },
];

mkdirSync(OUT, { recursive: true });

const py = `
import json, sys
from PIL import Image
plan = json.loads(sys.argv[1])
root = sys.argv[2]
outdir = sys.argv[3]
for item in plan:
    src = Image.open(root + '/' + item['src']).convert('RGB')
    x, y, w, h = item['crop']
    src = src.crop((x, y, x + w, y + h))
    dst = outdir + '/' + item['out']
    src.save(dst, 'WEBP', quality=88, method=6)
    print(item['out'], src.size)
`;

execFileSync('python3', ['-c', py, JSON.stringify(PLAN), GEN, OUT], { stdio: 'inherit' });

writeFileSync(
  join(OUT, 'README.txt'),
  [
    '本目录为生图素材（flat cartoon 风、浅色背景、无文字）。',
    '来源：assets/generated/ 下由 generate_image 生成的 PNG，经 scripts/prep-art.mjs 裁剪并转为 WebP。',
    '重新生成：先用 generate_image 出图到 assets/generated/，再运行 node scripts/prep-art.mjs。',
    '',
  ].join('\n'),
  'utf8',
);

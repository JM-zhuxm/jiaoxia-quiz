/**
 * 生成的插画素材清单。
 *
 * 图片由生图 provider 生成（扁平卡通风、浅色背景、无文字），
 * 原始 PNG 落在 assets/generated/，经 scripts/prep-art.mjs 裁剪并转成 WebP 放进 public/art/。
 * 运行时按相对路径加载。
 */
import type { QuestionArt } from '../core/quiz';
import Phaser from 'phaser';

export interface ArtAsset {
  /** Phaser 纹理 key */
  key: string;
  /** public 目录下的相对路径 */
  url: string;
  /** 游戏内显示尺寸（与图片宽高比一致） */
  display: { width: number; height: number };
}

export const ART: Record<QuestionArt, ArtAsset> = {
  /** 封面：学员在教练车里认真看路 */
  cover: {
    key: 'art-cover',
    url: 'art/art-1-cover.webp',
    display: { width: 648, height: 396 },
  },
  /** 安全带正确佩戴示意图 */
  seatbelt: {
    key: 'art-seatbelt',
    url: 'art/art-2-seatbelt.webp',
    display: { width: 240, height: 240 },
  },
  /** 禁止通行标志 */
  sign: {
    key: 'art-sign',
    url: 'art/art-3-sign.webp',
    display: { width: 200, height: 200 },
  },
  /** 城市十字路口 */
  crossing: {
    key: 'art-crossing',
    url: 'art/art-4-crossing.webp',
    display: { width: 318, height: 212 },
  },
  /** 正面视角小车（成绩页徽章） */
  car: {
    key: 'art-car',
    url: 'art/art-5-car.webp',
    display: { width: 96, height: 96 },
  },
};

/**
 * 创建一张插画。资源缺失时返回 null（而不是让整页崩溃）。
 */
export function createArtImage(
  scene: Phaser.Scene,
  key: QuestionArt,
  x: number,
  y: number,
  width?: number,
  height?: number,
): Phaser.GameObjects.Image | null {
  const asset = ART[key];
  if (!scene.textures.exists(asset.key)) return null;
  const image = scene.add.image(x, y, asset.key);
  image.setDisplaySize(width ?? asset.display.width, height ?? asset.display.height);
  return image;
}

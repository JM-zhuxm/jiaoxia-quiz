import Phaser from 'phaser';
import { COLORS } from '../theme';

/**
 * 代码绘制的界面图形：成绩页徽章与小图标。
 * 主插画（封面 / 安全带 / 标志 / 路口 / 车辆）改用生成的图片资源，见 src/ui/art-assets.ts。
 */

/** 星星多边形（Phaser Graphics 没有 fillStar，手动生成顶点）。 */
function starPoints(
  cx: number,
  cy: number,
  spikes: number,
  outer: number,
  inner: number,
): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + i * step;
    points.push(new Phaser.Geom.Point(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius));
  }
  return points;
}

/** 成绩页徽章：金牌 + 飘带。以原点为中心绘制，便于整体缩放。牌内小车用生成的图片叠加。 */
export function drawLicenseBadge(g: Phaser.GameObjects.Graphics, r: number): void {
  g.clear();
  const cx = 0;
  const cy = 0;

  // 飘带
  g.fillStyle(COLORS.danger, 1);
  g.fillPoints(
    [
      new Phaser.Geom.Point(cx - r * 0.42, cy + r * 0.62),
      new Phaser.Geom.Point(cx - r * 0.02, cy + r * 0.62),
      new Phaser.Geom.Point(cx - r * 0.2, cy + r * 1.42),
      new Phaser.Geom.Point(cx - r * 0.62, cy + r * 1.26),
    ],
    true,
  );
  g.fillPoints(
    [
      new Phaser.Geom.Point(cx + r * 0.02, cy + r * 0.62),
      new Phaser.Geom.Point(cx + r * 0.42, cy + r * 0.62),
      new Phaser.Geom.Point(cx + r * 0.62, cy + r * 1.26),
      new Phaser.Geom.Point(cx + r * 0.2, cy + r * 1.42),
    ],
    true,
  );

  // 牌面
  g.fillStyle(COLORS.gold, 1);
  g.fillCircle(cx, cy, r);
  g.fillStyle(COLORS.goldDark, 1);
  g.fillCircle(cx, cy, r * 0.9);
  g.fillStyle(0xfff3e9, 1);
  g.fillCircle(cx, cy, r * 0.82);

  // 星
  g.fillStyle(COLORS.gold, 1);
  g.fillPoints(starPoints(cx, cy - r * 0.56, 5, r * 0.15, r * 0.07), true);
}

/** 小闹钟图标。 */
export function drawClockIcon(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
): void {
  g.fillStyle(color, 1);
  g.fillCircle(cx, cy, r);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx, cy, r * 0.72);
  g.lineStyle(Math.max(3, r * 0.14), color, 1);
  g.beginPath();
  g.arc(cx, cy, r * 0.5, 0, Math.PI * 2, false);
  g.strokePath();
  g.lineStyle(Math.max(2, r * 0.1), color, 1);
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx, cy - r * 0.32);
  g.moveTo(cx, cy);
  g.lineTo(cx + r * 0.26, cy + r * 0.12);
  g.strokePath();
}

/** 外链箭头（↗）。 */
export function drawArrowOut(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
): void {
  g.lineStyle(Math.max(3, size * 0.16), color, 1);
  g.beginPath();
  g.moveTo(x - size / 2, y + size / 2);
  g.lineTo(x + size / 2, y - size / 2);
  g.strokePath();
  g.fillStyle(color, 1);
  g.fillTriangle(
    x + size / 2,
    y - size / 2,
    x + size / 2 - size * 0.36,
    y - size / 2,
    x + size / 2,
    y - size / 2 + size * 0.36,
  );
}

/** 小星星。 */
export function drawStar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  color: number,
): void {
  g.fillStyle(color, 1);
  g.fillPoints(starPoints(x, y, 5, r, r * 0.45), true);
}

/** 对勾。 */
export function drawCheck(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
): void {
  g.fillStyle(color, 1);
  g.fillCircle(cx, cy, r);
  g.lineStyle(Math.max(2.5, r * 0.22), 0xffffff, 1);
  g.beginPath();
  g.moveTo(cx - r * 0.42, cy);
  g.lineTo(cx - r * 0.12, cy + r * 0.32);
  g.lineTo(cx + r * 0.45, cy - r * 0.3);
  g.strokePath();
}

/** 叉号。 */
export function drawCross(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
): void {
  g.fillStyle(color, 1);
  g.fillCircle(cx, cy, r);
  g.lineStyle(Math.max(2.5, r * 0.22), 0xffffff, 1);
  g.beginPath();
  g.moveTo(cx - r * 0.36, cy - r * 0.36);
  g.lineTo(cx + r * 0.36, cy + r * 0.36);
  g.moveTo(cx + r * 0.36, cy - r * 0.36);
  g.lineTo(cx - r * 0.36, cy + r * 0.36);
  g.strokePath();
}

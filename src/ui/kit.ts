import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../theme';

/**
 * 生成可点击 Container 的 hitArea。
 *
 * Phaser 的 `pointWithinHitArea` 会把 `displayOrigin`（Container 恒等于
 * `width*0.5` / `height*0.5`）加进局部坐标，再交给 hitAreaCallback：
 *
 *   args = entry + (w/2, h/2)
 *
 * 而 `entry` 是以容器中心为原点的局部坐标，范围 ±w/2。所以图形实际占据的
 * args 区间是 [0, w] —— hitArea 必须写成 `Rectangle(0, 0, w, h)`。
 *
 * 但这样写会**把可点区边界与图形边界压成同一条线**：entry 恰好等于 (w/2, h/2)
 * （点在容器正中）时 args 恰好等于 (w, h)，正好压在边界上。此时任何亚像素级
 * 误差（FIT 缩放系数、hover 缩放、浏览器取整）都会让判定越界——实测在
 * 375×667 视口下 args_y = 92.0000117 > 92，按钮直接点不动。
 *
 * 因此这里给 hitArea 留 1px 余量，让判定不再贴着边界。
 */
export function makeHitArea(w: number, h: number): Phaser.Geom.Rectangle {
  const PAD = 1;
  return new Phaser.Geom.Rectangle(-PAD, -PAD, w + PAD * 2, h + PAD * 2);
}

/** 统一的文本样式工厂。 */
export interface TextOptions {
  size?: number;
  color?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  lineSpacing?: number;
  origin?: [number, number];
  alpha?: number;
}

export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  const {
    size = 28,
    color = COLORS.text,
    bold = false,
    align = 'left',
    wrap,
    lineSpacing = 0,
    origin = [0, 0],
    alpha = 1,
  } = options;
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    color: Phaser.Display.Color.IntegerToColor(color).rgba,
    fontStyle: bold ? 'bold' : 'normal',
    align,
  };
  if (wrap) style.wordWrap = { width: wrap, useAdvancedWrap: true };
  if (lineSpacing) style.lineSpacing = lineSpacing;
  const text = scene.add.text(x, y, content, style);
  text.setOrigin(origin[0], origin[1]);
  text.setAlpha(alpha);
  return text;
}

/** 白底圆角卡片 + 柔和阴影（用叠加半透明圆角矩形模拟）。 */
export function drawCard(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: number,
  shadow = true,
): void {
  if (shadow) {
    g.fillStyle(COLORS.shadow, 0.05);
    g.fillRoundedRect(x - 3, y + 9, w + 6, h, radius + 3);
    g.fillStyle(COLORS.shadow, 0.05);
    g.fillRoundedRect(x - 2, y + 5, w + 4, h, radius + 2);
    g.fillStyle(COLORS.shadow, 0.06);
    g.fillRoundedRect(x - 1, y + 2, w + 2, h, radius + 1);
  }
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, radius);
}

/** 带描边的卡片（用于选项卡等需要边框的控件）。 */
export function drawOutlinedCard(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: number,
  line: number,
  lineWidth = 2,
): void {
  drawCard(g, x, y, w, h, radius, fill);
  g.lineStyle(lineWidth, line, 1);
  g.strokeRoundedRect(x + lineWidth / 2, y + lineWidth / 2, w - lineWidth, h - lineWidth, radius);
}

export interface ButtonOptions {
  size?: number;
  fill?: number;
  fillPressed?: number;
  textColor?: number;
  radius?: number;
  sub?: string;
  onClick: () => void;
}

/** 通用按钮：带按压与悬停反馈。 */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  options: ButtonOptions,
): Phaser.GameObjects.Container {
  const {
    size = 32,
    fill = COLORS.primary,
    fillPressed = COLORS.primaryDark,
    textColor = 0xffffff,
    radius = h / 2,
    sub,
    onClick,
  } = options;

  const container = scene.add.container(x, y);
  const g = scene.add.graphics();
  const paint = (color: number) => {
    g.clear();
    drawCard(g, -w / 2, -h / 2, w, h, radius, color);
  };
  paint(fill);
  container.add(g);

  const text = makeText(scene, 0, sub ? -10 : 0, label, {
    size,
    color: textColor,
    bold: true,
    origin: [0.5, 0.5],
    align: 'center',
    wrap: w - 48,
  });
  container.add(text);

  if (sub) {
    container.add(
      makeText(scene, 0, size * 0.72, sub, {
        size: Math.round(size * 0.52),
        color: textColor,
        origin: [0.5, 0.5],
        alpha: 0.85,
      }),
    );
  }

  container.setSize(w, h);
  // hitArea 由 makeHitArea 统一生成：左上原点 + 1px 余量，
  // 避免判定压在边界线上被浮点误差顶出去（详见 makeHitArea 注释）。
  container.setInteractive(makeHitArea(w, h), Phaser.Geom.Rectangle.Contains);
  container.on('pointerover', () => {
    scene.tweens.add({ targets: container, scale: 1.02, duration: 120, ease: 'Sine.easeOut' });
  });
  container.on('pointerout', () => {
    scene.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.easeOut' });
  });
  container.on('pointerdown', () => {
    paint(fillPressed);
    scene.tweens.add({ targets: container, scale: 0.97, duration: 70, ease: 'Sine.easeOut' });
  });
  container.on('pointerup', () => {
    paint(fill);
    scene.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.easeOut' });
    onClick();
  });
  return container;
}

export interface PillOptions {
  size?: number;
  fill?: number;
  textColor?: number;
  radius?: number;
  bold?: boolean;
  border?: number;
}

/** 静态胶囊标签。 */
export function createPill(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  options: PillOptions = {},
): Phaser.GameObjects.Container {
  const {
    size = 26,
    fill = COLORS.primarySoft,
    textColor = COLORS.primary,
    radius = h / 2,
    bold = true,
    border,
  } = options;
  const container = scene.add.container(x, y);
  const g = scene.add.graphics();
  if (border) {
    drawOutlinedCard(g, -w / 2, -h / 2, w, h, radius, fill, border);
  } else {
    drawCard(g, -w / 2, -h / 2, w, h, radius, fill, false);
  }
  container.add(g);
  container.add(
    makeText(scene, 0, 0, label, { size, color: textColor, bold, origin: [0.5, 0.5], align: 'center', wrap: w - 24 }),
  );
  container.setSize(w, h);
  return container;
}

/** 打开外部链接（用于底部 CTA）。 */
export function openExternal(url: string): void {
  try {
    const opened = globalThis.open?.(url, '_blank', 'noopener,noreferrer');
    if (opened) return;
  } catch {
    /* 某些沙箱会拦截弹窗，走下面的兜底 */
  }
  try {
    globalThis.location.href = url;
  } catch {
    /* 忽略 */
  }
}

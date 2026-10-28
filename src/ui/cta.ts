import Phaser from 'phaser';
import { COLORS, CONTENT_WIDTH, CTA_H, CTA_LABEL, CTA_URL, CTA_Y, GAME_WIDTH } from '../theme';
import { createButton, makeHitArea, makeText, openExternal } from './kit';
import { drawArrowOut } from './art';

/** CTA 按钮在游戏坐标中的位置（测试桥与自动化使用）。 */
export const CTA_RECT = {
  x: GAME_WIDTH / 2,
  y: CTA_Y + CTA_H / 2,
  w: CONTENT_WIDTH,
  h: CTA_H,
};

/**
 * 底部常驻 CTA：「长盛驾校·从化学车」，点击跳转 https://cargo20.com/
 */
export function createCtaBar(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);

  const back = scene.add.graphics();
  back.fillStyle(COLORS.surface, 0.96);
  back.fillRect(0, CTA_Y - 26, GAME_WIDTH, 26 + CTA_H + 40);
  back.fillStyle(COLORS.line, 1);
  back.fillRect(0, CTA_Y - 26, GAME_WIDTH, 2);
  root.add(back);

  const button = scene.add.container(GAME_WIDTH / 2, CTA_Y + CTA_H / 2);
  const g = scene.add.graphics();
  const paint = (fill: number) => {
    g.clear();
    g.fillStyle(COLORS.shadow, 0.08);
    g.fillRoundedRect(-CONTENT_WIDTH / 2, -CTA_H / 2 + 6, CONTENT_WIDTH, CTA_H, CTA_H / 2);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-CONTENT_WIDTH / 2, -CTA_H / 2, CONTENT_WIDTH, CTA_H, CTA_H / 2);
  };
  paint(COLORS.cta);
  button.add(g);

  const label = makeText(scene, -14, 0, CTA_LABEL, {
    size: 30,
    color: 0xffffff,
    bold: true,
    origin: [0.5, 0.5],
  });
  button.add(label);

  const arrow = scene.add.graphics();
  drawArrowOut(arrow, CONTENT_WIDTH / 2 - 46, 0, 22, 0xffffff);
  button.add(arrow);

  button.setSize(CONTENT_WIDTH, CTA_H);
  // 统一走 makeHitArea：左上原点 + 1px 余量（详见 kit.ts makeHitArea 注释）
  button.setInteractive(makeHitArea(CONTENT_WIDTH, CTA_H), Phaser.Geom.Rectangle.Contains);
  button.on('pointerover', () => scene.tweens.add({ targets: button, scale: 1.015, duration: 120 }));
  button.on('pointerout', () => scene.tweens.add({ targets: button, scale: 1, duration: 120 }));
  button.on('pointerdown', () => {
    paint(COLORS.ctaDark);
    scene.tweens.add({ targets: button, scale: 0.98, duration: 70 });
  });
  button.on('pointerup', () => {
    paint(COLORS.cta);
    scene.tweens.add({ targets: button, scale: 1, duration: 120 });
    openExternal(CTA_URL);
  });
  root.add(button);

  root.setDepth(100);
  return root;
}

/** 带副标题的主按钮（开始闯关等）。 */
export function createPrimaryAction(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  sub: string,
  onClick: () => void,
): Phaser.GameObjects.Container {
  return createButton(scene, x, y, w, h, label, {
    sub,
    size: 36,
    radius: 28,
    fill: COLORS.primary,
    fillPressed: COLORS.primaryDark,
    onClick,
  });
}

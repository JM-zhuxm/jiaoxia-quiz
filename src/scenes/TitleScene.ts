import Phaser from 'phaser';
import { COLORS, CONTENT_WIDTH, GAME_WIDTH, MARGIN } from '../theme';
import { createPill, drawCard, makeText } from '../ui/kit';
import { ART, createArtImage } from '../ui/art-assets';
import { createCtaBar, createPrimaryAction, CTA_RECT } from '../ui/cta';
import { QUESTIONS_PER_ROUND } from '../core/quiz';
import { startRound } from '../core/round';
import { gameState } from '../core/state';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  /** 预载生成的插画素材（封面 / 安全带 / 标志 / 路口 / 车辆）。 */
  preload(): void {
    Object.values(ART).forEach((asset) => {
      this.load.image(asset.key, asset.url);
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    const root = this.add.container(0, 0);

    // 背景装饰
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0xdfe9ff, 0.75);
    backdrop.fillCircle(672, 40, 190);
    backdrop.fillStyle(0xe6f4ec, 0.8);
    backdrop.fillCircle(30, 1218, 160);
    backdrop.fillStyle(0xfff0dc, 0.9);
    backdrop.fillCircle(640, 1206, 74);
    root.add(backdrop);

    // 品牌条
    root.add(
      createPill(this, GAME_WIDTH / 2, 92, 208, 56, '长盛驾校', {
        size: 26,
        fill: COLORS.ctaSoft,
        textColor: COLORS.ctaDark,
      }),
    );

    // 主标题
    root.add(
      makeText(this, GAME_WIDTH / 2, 142, '科目一闯关', {
        size: 76,
        color: COLORS.text,
        bold: true,
        origin: [0.5, 0],
      }),
    );
    const underline = this.add.graphics();
    underline.fillStyle(COLORS.primary, 1);
    underline.fillRoundedRect(GAME_WIDTH / 2 - 76, 250, 152, 8, 4);
    root.add(underline);

    root.add(
      makeText(this, GAME_WIDTH / 2, 272, '真实题库 · 20 秒一题 · 90 分合格', {
        size: 26,
        color: COLORS.textMuted,
        origin: [0.5, 0],
      }),
    );

    // 主插画：生成的封面图（学员在教练车里认真看路）
    const HERO = { x: MARGIN, y: 322, w: CONTENT_WIDTH, h: 396 };
    const panel = this.add.graphics();
    drawCard(panel, HERO.x, HERO.y, HERO.w, HERO.h, 28, 0xffffff);
    root.add(panel);

    const hero = createArtImage(this, 'cover', HERO.x + HERO.w / 2, HERO.y + HERO.h / 2);
    if (hero) {
      const heroMask = this.make.graphics({ x: 0, y: 0 }, false);
      heroMask.fillStyle(0xffffff, 1);
      heroMask.fillRoundedRect(HERO.x, HERO.y, HERO.w, HERO.h, 28);
      hero.setMask(heroMask.createGeometryMask());
      root.add(hero);
      // 轻微浮动，遮罩同步移动
      this.tweens.add({
        targets: [hero, heroMask],
        y: '-=10',
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // 规则卡
    const rules: Array<[string, string, number]> = [
      ['20秒', '每题限时', COLORS.warn],
      ['+10', '答对得分', COLORS.success],
      ['-10', '答错扣分', COLORS.danger],
    ];
    const cardW = (CONTENT_WIDTH - 36) / 3;
    rules.forEach(([value, label, color], index) => {
      const x = MARGIN + cardW / 2 + index * (cardW + 18);
      const y = 748;
      const g = this.add.graphics();
      drawCard(g, x - cardW / 2, y, cardW, 100, 22, COLORS.surface);
      root.add(g);
      root.add(
        makeText(this, x, y + 16, value, {
          size: 36,
          color,
          bold: true,
          origin: [0.5, 0],
        }),
      );
      root.add(
        makeText(this, x, y + 64, label, {
          size: 22,
          color: COLORS.textMuted,
          origin: [0.5, 0],
        }),
      );
    });

    // 历史成绩
    const { bestScore, levels } = gameState.progress;
    root.add(
      makeText(
        this,
        GAME_WIDTH / 2,
        876,
        bestScore > 0 ? `历史最好 ${bestScore} 分 · 已闯 ${levels} 关` : '还没有成绩，从第一关开始吧',
        { size: 26, color: COLORS.textMuted, origin: [0.5, 0] },
      ),
    );

    // 开始按钮
    root.add(
      createPrimaryAction(
        this,
        GAME_WIDTH / 2,
        1016,
        CONTENT_WIDTH,
        110,
        '开始闯关',
        `第 ${gameState.level} 关 · ${QUESTIONS_PER_ROUND} 道题`,
        () => this.startRound(),
      ),
    );

    createCtaBar(this);

    // 入场
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 420, ease: 'Sine.easeOut' });

    this.game.registry.set('__snapshot__', () => ({
      scene: 'Title',
      level: gameState.level,
      best: gameState.progress.bestScore,
      levels: gameState.progress.levels,
      startButton: { x: GAME_WIDTH / 2, y: 1016, w: CONTENT_WIDTH, h: 110 },
      cta: CTA_RECT,
      artTextures: Object.keys(this.textures.list).filter((key) => key.startsWith('art-')).sort(),
    }));
    this.game.registry.set('__reset__', () => this.scene.start('Title'));
    this.game.registry.set('__scope__', () => null);
  }

  private startRound(): void {
    startRound(this);
  }
}

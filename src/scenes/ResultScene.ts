import Phaser from 'phaser';
import { COLORS, CONTENT_WIDTH, GAME_WIDTH, MARGIN } from '../theme';
import { createButton, createPill, drawCard, makeText } from '../ui/kit';
import { createCtaBar, CTA_RECT } from '../ui/cta';
import { drawLicenseBadge } from '../ui/art';
import { createArtImage } from '../ui/art-assets';
import { recordRound } from '../core/progress';
import { startRound } from '../core/round';
import { gameState } from '../core/state';
import type { Grade } from '../core/quiz';

interface MistakeEntry {
  number: number;
  text: string;
  answer: string;
  explanation: string;
}

export interface ResultSummary {
  level: number;
  score: number;
  grade: Grade;
  correct: number;
  wrong: number;
  timeout: number;
  elapsed: number;
  mistakes: MistakeEntry[];
}

function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${String(Math.floor(seconds % 60)).padStart(2, '0')} 秒`;
}

export class ResultScene extends Phaser.Scene {
  private summary!: ResultSummary;

  constructor() {
    super('Result');
  }

  init(data: ResultSummary): void {
    this.summary = data;
  }

  create(): void {
    const { level, score, grade, correct, wrong, timeout, elapsed, mistakes } = this.summary;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    gameState.progress = recordRound(score, gameState.progress);
    gameState.level = level + 1;

    const root = this.add.container(0, 0);

    // 背景装饰
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0xe6efff, 0.8);
    backdrop.fillCircle(660, 60, 170);
    backdrop.fillStyle(0xfff1dd, 0.9);
    backdrop.fillCircle(46, 980, 140);
    root.add(backdrop);

    root.add(
      createPill(this, GAME_WIDTH / 2, 82, 196, 54, `第 ${level} 关`, {
        size: 26,
        fill: COLORS.primarySoft,
        textColor: COLORS.primary,
      }),
    );

    // 徽章：代码绘制的金牌 + 生成的车辆插画
    const badgeGroup = this.add.container(GAME_WIDTH / 2, 186);
    const badge = this.add.graphics();
    drawLicenseBadge(badge, 74);
    badgeGroup.add(badge);

    const car = createArtImage(this, 'car', 0, 8);
    const pulseTargets: Phaser.GameObjects.GameObject[] = [badgeGroup];
    if (car) {
      const carMask = this.make.graphics({ x: GAME_WIDTH / 2, y: 194 }, false);
      carMask.fillStyle(0xffffff, 1);
      carMask.fillRoundedRect(-48, -48, 96, 96, 18);
      car.setMask(carMask.createGeometryMask());
      badgeGroup.add(car);
      pulseTargets.push(carMask);
    }
    root.add(badgeGroup);
    this.tweens.add({
      targets: pulseTargets,
      scale: 1.06,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 分数
    root.add(
      makeText(this, GAME_WIDTH / 2, 288, '本关得分', {
        size: 24,
        color: COLORS.textMuted,
        origin: [0.5, 0],
      }),
    );
    root.add(
      createPill(
        this,
        GAME_WIDTH / 2 + 128,
        296,
        120,
        44,
        grade.passed ? '合格' : '未合格',
        {
          size: 24,
          fill: grade.passed ? COLORS.successSoft : COLORS.dangerSoft,
          textColor: grade.passed ? COLORS.success : COLORS.danger,
        },
      ),
    );
    root.add(
      makeText(this, GAME_WIDTH / 2, 318, String(score), {
        size: 84,
        color: COLORS.primary,
        bold: true,
        origin: [0.5, 0],
      }),
    );
    root.add(
      makeText(this, GAME_WIDTH / 2 + 72, 352, '分', {
        size: 30,
        color: COLORS.textMuted,
        bold: true,
        origin: [0.5, 0],
      }),
    );

    // 等级
    const gradeColor =
      grade.letter === 'S' ? COLORS.goldDark : grade.letter === 'A' ? COLORS.warn : grade.letter === 'B' ? COLORS.primary : COLORS.danger;
    const gradeFill =
      grade.letter === 'S' ? COLORS.ctaSoft : grade.letter === 'A' ? COLORS.warnSoft : grade.letter === 'B' ? COLORS.primarySoft : COLORS.dangerSoft;
    root.add(
      createPill(this, GAME_WIDTH / 2, 452, 268, 64, `${grade.letter} 级 · ${grade.title}`, {
        size: 30,
        fill: gradeFill,
        textColor: gradeColor,
      }),
    );
    root.add(
      makeText(this, GAME_WIDTH / 2, 534, grade.comment, {
        size: 26,
        color: COLORS.textMuted,
        origin: [0.5, 0],
        align: 'center',
        wrap: 560,
      }),
    );

    // 本关统计
    root.add(this.statCard(596, 152, [
      { value: String(correct), label: '答对', color: COLORS.success },
      { value: String(wrong), label: '答错', color: COLORS.danger },
      { value: String(timeout), label: '超时', color: COLORS.warn },
      { value: formatDuration(elapsed), label: '总用时', color: COLORS.primary },
    ]));

    // 累计数据
    const { totalScore, bestScore, levels } = gameState.progress;
    root.add(
      this.statCard(768, 112, [
        { value: String(score), label: '本关得分', color: COLORS.primary },
        { value: String(totalScore), label: '累计得分', color: COLORS.ctaDark },
        { value: String(bestScore), label: '历史最好', color: COLORS.goldDark },
        { value: String(levels), label: '已闯关数', color: COLORS.success },
      ]),
    );

    // 错题提示
    const mistakeText =
      mistakes.length === 0
        ? '全部答对，零失误！可以去约考了'
        : `本关错题 ${mistakes.length} 道：第 ${mistakes.map((item) => item.number).join('、')} 题`;
    const card = this.add.graphics();
    drawCard(card, MARGIN, 900, CONTENT_WIDTH, 92, 22, mistakes.length === 0 ? COLORS.successSoft : COLORS.surface);
    root.add(card);
    root.add(
      makeText(this, GAME_WIDTH / 2, 930, mistakeText, {
        size: 26,
        color: mistakes.length === 0 ? COLORS.success : COLORS.text,
        bold: true,
        origin: [0.5, 0],
        align: 'center',
        wrap: CONTENT_WIDTH - 48,
      }),
    );

    // 操作
    root.add(
      createButton(this, MARGIN + 210, 1060, 420, 96, '再闯一关', {
        size: 32,
        radius: 28,
        fill: COLORS.primary,
        fillPressed: COLORS.primaryDark,
        onClick: () => startRound(this),
      }),
    );
    root.add(
      createButton(this, GAME_WIDTH - MARGIN - 104, 1060, 208, 96, '返回首页', {
        size: 28,
        radius: 28,
        fill: COLORS.surface,
        fillPressed: COLORS.primarySoft,
        textColor: COLORS.primary,
        onClick: () => this.scene.start('Title'),
      }),
    );

    createCtaBar(this);

    this.game.registry.set('__snapshot__', () => ({
      scene: 'Result',
      score: this.summary.score,
      grade: this.summary.grade.letter,
      passed: this.summary.grade.passed,
      mistakes: this.summary.mistakes.length,
      homeButton: { x: GAME_WIDTH - MARGIN - 104, y: 1060, w: 208, h: 96 },
      nextButton: { x: MARGIN + 210, y: 1060, w: 420, h: 96 },
      cta: CTA_RECT,
    }));
    this.game.registry.set('__reset__', () => this.scene.start('Title'));
    this.game.registry.set('__scope__', () => null);

    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 420, ease: 'Sine.easeOut' });
  }

  /** 统计卡片：value + label 的网格。 */
  private statCard(
    y: number,
    height: number,
    cells: Array<{ value: string; label: string; color: number }>,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const g = this.add.graphics();
    drawCard(g, MARGIN, y, CONTENT_WIDTH, height, 24, COLORS.surface);
    container.add(g);

    const cellWidth = CONTENT_WIDTH / cells.length;
    cells.forEach((cell, index) => {
      const cx = MARGIN + cellWidth / 2 + index * cellWidth;
      container.add(
        makeText(this, cx, y + 22, cell.value, {
          size: index === 3 ? 32 : 38,
          color: cell.color,
          bold: true,
          origin: [0.5, 0],
        }),
      );
      container.add(
        makeText(this, cx, y + height - 40, cell.label, {
          size: 22,
          color: COLORS.textMuted,
          origin: [0.5, 0],
        }),
      );
      if (index > 0) {
        const divider = this.add.graphics();
        divider.fillStyle(COLORS.line, 1);
        divider.fillRect(MARGIN + index * cellWidth - 1, y + 22, 2, height - 44);
        container.add(divider);
      }
    });
    return container;
  }
}

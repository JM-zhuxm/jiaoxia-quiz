import Phaser from 'phaser';
import {
  COLORS,
  CONTENT_WIDTH,
  CTA_Y,
  GAME_WIDTH,
  MARGIN,
  OPTION_LETTERS,
} from '../theme';
import { createButton, createPill, drawCard, drawOutlinedCard, makeHitArea, makeText } from '../ui/kit';
import { createCtaBar, CTA_RECT } from '../ui/cta';
import { drawCheck, drawCross } from '../ui/art';
import { ART, createArtImage } from '../ui/art-assets';
import { QuizSession, TIME_LIMIT_MS, type AnswerRecord, type QuizQuestion } from '../core/quiz';

const HUD_TOP = 28;
const PILL_H = 64;
const RING_CX = GAME_WIDTH / 2;
const RING_CY = 60;
const RING_R = 36;
const COUNT_Y = 112;
const SEG_Y = 156;
const SEG_H = 8;
const CARD_TOP = 188;
const OPTION_GAP = 14;
const OPTION_MIN_H = 92;
const OPTION_PADDING = 22;
const LETTER_R = 23;
const LETTER_X = 46;
const OPTION_TEXT_SIZE = 30;
const OPTION_TEXT_X = 86;
const OPTION_TEXT_WRAP = CONTENT_WIDTH - OPTION_TEXT_X - 46;
const CONTENT_BOTTOM = CTA_Y - 26;
const ART_PAD = 20;
const ART_GAP = 14;

interface OptionView {
  container: Phaser.GameObjects.Container;
  paint: (state: 'idle' | 'hover' | 'correct' | 'wrong') => void;
}

export class QuizScene extends Phaser.Scene {
  private session!: QuizSession;
  private level = 1;
  private timeLeft = TIME_LIMIT_MS;
  private state: 'question' | 'explaining' = 'question';

  private questionLayer?: Phaser.GameObjects.Container;
  private options: OptionView[] = [];
  private timerRing!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private scoreLabel!: Phaser.GameObjects.Text;
  private countLabel!: Phaser.GameObjects.Text;
  private segments!: Phaser.GameObjects.Graphics;
  private pulse?: Phaser.Tweens.Tween;
  private sheet?: Phaser.GameObjects.Container;
  private optionRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  private artRect: { x: number; y: number; w: number; h: number } | null = null;
  private nextButtonRect = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    super('Quiz');
  }

  init(data: { questions: QuizQuestion[]; level: number }): void {
    this.session = new QuizSession(data.questions);
    this.level = data.level ?? 1;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.buildHud();
    createCtaBar(this);
    this.bindKeyboard();
    this.showQuestion();

    this.game.registry.set('__snapshot__', () => ({
      scene: 'Quiz',
      level: this.level,
      index: this.session.index,
      total: this.session.questions.length,
      score: this.session.score,
      timeLeft: Math.round(this.timeLeft),
      state: this.state,
      correctIndex: this.session.current ? this.session.current.answer : -1,
      options: this.optionRects,
      art: this.artRect,
      nextButton: this.nextButtonRect,
      cta: CTA_RECT,
    }));
    this.game.registry.set('__reset__', () => this.scene.start('Title'));
    this.game.registry.set('__step__', (ms: number) => {
      this.timeLeft = Math.max(0, this.timeLeft - ms);
    });
    // 解析面板升起时，体检只针对面板本身
    this.game.registry.set('__scope__', () => (this.sheet ?? null));
  }

  // ---------------------------------------------------------------- HUD

  private buildHud(): void {
    createPill(this, MARGIN + 76, HUD_TOP + PILL_H / 2, 152, PILL_H, `第 ${this.level} 关`, {
      size: 26,
      fill: COLORS.primarySoft,
      textColor: COLORS.primary,
    });

    this.timerRing = this.add.graphics();
    this.timerRing.setPosition(RING_CX, RING_CY);
    this.timerText = makeText(this, RING_CX, RING_CY, '20', {
      size: 30,
      color: COLORS.success,
      bold: true,
      origin: [0.5, 0.5],
    });

    const scorePill = createPill(this, GAME_WIDTH - MARGIN - 76, HUD_TOP + PILL_H / 2, 152, PILL_H, '', {
      size: 26,
      fill: COLORS.ctaSoft,
      textColor: COLORS.ctaDark,
    });
    this.scoreLabel = makeText(this, 0, 0, '0 分', {
      size: 28,
      color: COLORS.ctaDark,
      bold: true,
      origin: [0.5, 0.5],
    });
    scorePill.add(this.scoreLabel);

    this.countLabel = makeText(this, GAME_WIDTH / 2, COUNT_Y, '', {
      size: 26,
      color: COLORS.textMuted,
      origin: [0.5, 0],
    });

    this.segments = this.add.graphics();
    this.drawSegments();
  }

  private drawSegments(): void {
    const g = this.segments;
    g.clear();
    const gap = 6;
    const width = (CONTENT_WIDTH - gap * (this.session.questions.length - 1)) / this.session.questions.length;
    this.session.questions.forEach((_, index) => {
      const x = MARGIN + index * (width + gap);
      const answered = index < this.session.records.length;
      const current = index === this.session.index;
      g.fillStyle(current ? COLORS.primary : answered ? COLORS.primarySoft : 0xdee6f5, 1);
      g.fillRoundedRect(x, SEG_Y, width, SEG_H, SEG_H / 2);
    });
  }

  // ------------------------------------------------------------ 题目区域

  private showQuestion(): void {
    this.questionLayer?.destroy(true);
    this.sheet?.destroy(true);
    this.sheet = undefined;
    this.options = [];
    this.state = 'question';
    this.artRect = null;
    this.timeLeft = TIME_LIMIT_MS;
    this.pulse?.stop();
    this.pulse = undefined;

    const question = this.session.current;
    const layer = this.add.container(0, 0);
    this.questionLayer = layer;

    // 选项高度
    const optionTexts = question.options.map((option) =>
      makeText(this, 0, 0, option, {
        size: OPTION_TEXT_SIZE,
        wrap: OPTION_TEXT_WRAP,
        lineSpacing: 4,
      }),
    );
    const heights = optionTexts.map((text) =>
      Math.max(OPTION_MIN_H, text.height + OPTION_PADDING * 2),
    );
    const totalHeight = heights.reduce((sum, h) => sum + h, 0) + OPTION_GAP * (heights.length - 1);
    const optionsTop = CONTENT_BOTTOM - totalHeight;

    // 题干卡片（部分题目带配图）
    const questionText = makeText(this, MARGIN + 32, 0, question.text, {
      size: 34,
      color: COLORS.text,
      bold: true,
      wrap: CONTENT_WIDTH - 64,
      lineSpacing: 10,
    });
    const artKey = question.art;
    const art = artKey ? ART[artKey] : undefined;
    let artW = art ? art.display.width : 0;
    let artH = art ? art.display.height : 0;
    const plainCard = Math.max(220, questionText.height + 76);
    let cardHeight = artH > 0 ? ART_PAD + artH + ART_GAP + questionText.height + ART_PAD : plainCard;
    const available = optionsTop - 26 - CARD_TOP;
    if (cardHeight > available) {
      // 空间不够时先缩配图，仍然不够就压缩卡片
      const keep = Math.max(0, artH + ART_GAP - (cardHeight - available));
      if (keep < artH) {
        const ratio = keep / artH;
        artH = keep;
        artW = artW * ratio;
      }
      cardHeight = artH > 0 ? ART_PAD + artH + ART_GAP + questionText.height + ART_PAD : plainCard;
      cardHeight = Math.min(cardHeight, available);
    }
    const cardY = CARD_TOP + Math.max(0, (available - cardHeight) / 2);
    const card = this.add.graphics();
    drawCard(card, MARGIN, cardY, CONTENT_WIDTH, cardHeight, 28, COLORS.surface);
    layer.add(card);

    if (artKey && art && artH > 4) {
      const frame = this.add.graphics();
      frame.fillStyle(0xfff4ea, 1);
      frame.fillRoundedRect(
        GAME_WIDTH / 2 - artW / 2 - 10,
        cardY + ART_PAD - 6,
        artW + 20,
        artH + 12,
        18,
      );
      layer.add(frame);
      const image = createArtImage(
        this,
        artKey,
        GAME_WIDTH / 2,
        cardY + ART_PAD + artH / 2,
        artW,
        artH,
      );
      if (image) layer.add(image);
      this.artRect = { x: GAME_WIDTH / 2 - artW / 2, y: cardY + ART_PAD, w: artW, h: artH };
      questionText.setPosition(MARGIN + 32, cardY + ART_PAD + artH + ART_GAP);
    } else {
      questionText.setPosition(MARGIN + 32, cardY + (cardHeight - questionText.height) / 2);
    }
    layer.add(questionText);

    // 选项
    let y = optionsTop;
    this.optionRects = [];
    question.options.forEach((_option, index) => {
      const height = heights[index];
      const view = this.createOption(index, optionTexts[index], height);
      view.container.setPosition(MARGIN, y);
      layer.add(view.container);
      this.options.push(view);
      this.optionRects.push({ x: MARGIN, y, w: CONTENT_WIDTH, h: height });
      y += height + OPTION_GAP;
    });

    this.countLabel.setText(`第 ${this.session.index + 1} / ${this.session.questions.length} 题`);
    this.drawSegments();
    this.drawTimer();
  }

  private createOption(
    index: number,
    label: Phaser.GameObjects.Text,
    height: number,
  ): OptionView {
    const container = this.add.container(MARGIN, 0);
    const g = this.add.graphics();
    const badge = this.add.graphics();
    const mark = this.add.graphics();

    const letter = OPTION_LETTERS[index] ?? String(index + 1);
    const badgeText = makeText(this, LETTER_X, 0, letter, {
      size: 26,
      color: COLORS.primary,
      bold: true,
      origin: [0.5, 0.5],
    });

    const paint = (state: 'idle' | 'hover' | 'correct' | 'wrong') => {
      g.clear();
      badge.clear();
      mark.clear();

      const border =
        state === 'correct' ? COLORS.success : state === 'wrong' ? COLORS.danger : state === 'hover' ? COLORS.primary : COLORS.line;
      const fill = state === 'correct' ? COLORS.successSoft : state === 'wrong' ? COLORS.dangerSoft : 0xffffff;
      drawOutlinedCard(g, 0, 0, CONTENT_WIDTH, height, 22, fill, border, state === 'idle' ? 2 : 3);

      badge.fillStyle(
        state === 'correct' ? COLORS.success : state === 'wrong' ? COLORS.danger : state === 'hover' ? COLORS.primary : COLORS.primarySoft,
        1,
      );
      badge.fillCircle(LETTER_X, height / 2, LETTER_R);
      badgeText.setColor(
        Phaser.Display.Color.IntegerToColor(
          state === 'idle' ? COLORS.primary : 0xffffff,
        ).rgba,
      );

      if (state === 'correct') drawCheck(mark, CONTENT_WIDTH - 38, height / 2, 19, COLORS.success);
      if (state === 'wrong') drawCross(mark, CONTENT_WIDTH - 38, height / 2, 19, COLORS.danger);
    };

    paint('idle');

    label.setPosition(OPTION_TEXT_X, 0);
    label.setY((height - label.height) / 2);
    label.setColor(Phaser.Display.Color.IntegerToColor(COLORS.text).rgba);

    container.add([g, badge, badgeText, label, mark]);
    container.setSize(CONTENT_WIDTH, height);
    // 统一走 makeHitArea：左上原点 + 1px 余量（详见 kit.ts makeHitArea 注释）
    container.setInteractive(makeHitArea(CONTENT_WIDTH, height), Phaser.Geom.Rectangle.Contains);
    container.on('pointerover', () => {
      if (this.state !== 'question') return;
      paint('hover');
      this.tweens.add({ targets: container, scale: 1.012, duration: 110 });
    });
    container.on('pointerout', () => {
      if (this.state !== 'question') return;
      paint('idle');
      this.tweens.add({ targets: container, scale: 1, duration: 110 });
    });
    container.on('pointerup', () => this.answer(index));

    return { container, paint };
  }

  // -------------------------------------------------------------- 作答

  private answer(chosen: number | null): void {
    if (this.state !== 'question') return;
    this.state = 'explaining';
    this.pulse?.stop();
    this.pulse = undefined;

    const elapsed = TIME_LIMIT_MS - this.timeLeft;
    const record = this.session.answer(chosen, elapsed);
    if (!record) return;

    // 选项反馈
    this.options.forEach((option, index) => {
      const correct = index === record.question.answer;
      const picked = index === chosen;
      if (correct) option.paint('correct');
      else if (picked) option.paint('wrong');
      option.container.disableInteractive();
    });
    if (chosen !== null && chosen !== record.question.answer) {
      const target = this.options[chosen];
      if (target) {
        this.tweens.add({
          targets: target.container,
          x: target.container.x + 10,
          duration: 55,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
        });
      }
    }

    this.updateScore();
    this.drawSegments();
    this.showExplanation(record);
  }

  private updateScore(): void {
    const score = this.session.score;
    this.tweens.add({
      targets: this.scoreLabel,
      scale: 1.18,
      duration: 140,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
    this.scoreLabel.setText(`${score} 分`);
  }

  // ------------------------------------------------------------ 解析面板

  private showExplanation(record: AnswerRecord): void {
    const sheet = this.add.container(0, 0);
    sheet.setDepth(50);
    this.sheet = sheet;

    const dim = this.add.graphics();
    dim.fillStyle(0x16233a, 0.32);
    dim.fillRect(0, 0, GAME_WIDTH, CONTENT_BOTTOM);
    dim.setAlpha(0);
    sheet.add(dim);

    const cardY = 536;
    const cardH = CONTENT_BOTTOM - cardY;
    const card = this.add.graphics();
    drawCard(card, 0, cardY, GAME_WIDTH, cardH, 34, COLORS.surface);
    sheet.add(card);

    const handle = this.add.graphics();
    handle.fillStyle(0xd9e2f2, 1);
    handle.fillRoundedRect(GAME_WIDTH / 2 - 40, cardY + 20, 80, 8, 4);
    sheet.add(handle);

    // 判定 + 下一题
    const correct = record.outcome === 'correct';
    const verdict = correct ? '回答正确  +10 分' : record.outcome === 'timeout' ? '超时未答  -10 分' : '回答错误  -10 分';
    const verdictColor = correct ? COLORS.success : COLORS.danger;
    const verdictFill = correct ? COLORS.successSoft : COLORS.dangerSoft;
    const verdictPill = createPill(this, MARGIN + 145, cardY + 84, 290, 64, verdict, {
      size: 26,
      fill: verdictFill,
      textColor: verdictColor,
    });
    sheet.add(verdictPill);

    const last = this.session.finished;
    const nextButton = createButton(this, GAME_WIDTH - MARGIN - 112, cardY + 84, 224, 64, last ? '看成绩 ›' : '下一题 ›', {
      size: 28,
      radius: 32,
      fill: COLORS.primary,
      fillPressed: COLORS.primaryDark,
      onClick: () => this.next(),
    });
    sheet.add(nextButton);
    this.nextButtonRect = { x: GAME_WIDTH - MARGIN - 112, y: cardY + 84, w: 224, h: 64 };

    let y = cardY + 132;

    sheet.add(
      makeText(this, MARGIN + 30, y, '正确答案', {
        size: 24,
        color: COLORS.textMuted,
      }),
    );
    y += 34;
    const answerIcon = this.add.graphics();
    drawCheck(answerIcon, MARGIN + 46, y + 19, 18, COLORS.success);
    sheet.add(answerIcon);
    const answerText = makeText(
      this,
      MARGIN + 78,
      y,
      `${OPTION_LETTERS[record.question.answer]}. ${record.question.options[record.question.answer]}`,
      { size: 29, color: COLORS.success, bold: true, wrap: CONTENT_WIDTH - 108, lineSpacing: 4 },
    );
    sheet.add(answerText);
    y += answerText.height + 12;

    if (record.chosen !== null && !correct) {
      const chosenIcon = this.add.graphics();
      drawCross(chosenIcon, MARGIN + 46, y + 18, 17, COLORS.danger);
      sheet.add(chosenIcon);
      const chosenText = makeText(
        this,
        MARGIN + 78,
        y,
        `你的选择：${OPTION_LETTERS[record.chosen]}. ${record.question.options[record.chosen]}`,
        { size: 26, color: COLORS.danger, wrap: CONTENT_WIDTH - 108, lineSpacing: 4 },
      );
      sheet.add(chosenText);
      y += chosenText.height + 16;
    }

    sheet.add(
      makeText(this, MARGIN + 30, y, '解析', {
        size: 24,
        color: COLORS.textMuted,
      }),
    );
    y += 34;
    sheet.add(
      makeText(this, MARGIN + 30, y, record.question.explanation, {
        size: 26,
        color: COLORS.text,
        wrap: CONTENT_WIDTH - 60,
        lineSpacing: 4,
      }),
    );

    sheet.setY(620);
    this.tweens.add({ targets: sheet, y: 0, duration: 300, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: dim, alpha: 1, duration: 260 });
  }

  private next(): void {
    if (this.state !== 'explaining') return;
    if (this.session.finished) {
      this.scene.start('Result', this.buildSummary());
      return;
    }
    this.showQuestion();
  }

  private buildSummary() {
    const session = this.session;
    return {
      level: this.level,
      score: session.score,
      grade: session.grade,
      correct: session.correctCount,
      wrong: session.wrongCount,
      timeout: session.timeoutCount,
      elapsed: session.elapsedMs,
      mistakes: session.records
        .map((record, index) => ({ record, number: index + 1 }))
        .filter((entry) => entry.record.outcome !== 'correct')
        .map((entry) => ({
          number: entry.number,
          text: entry.record.question.text,
          answer: entry.record.question.options[entry.record.question.answer],
          explanation: entry.record.question.explanation,
        })),
    };
  }

  // -------------------------------------------------------------- 计时

  override update(_time: number, delta: number): void {
    if (this.state !== 'question') return;
    this.timeLeft -= delta;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.drawTimer();
      this.answer(null);
      return;
    }
    this.drawTimer();
    if (this.timeLeft <= 5000 && !this.pulse) {
      this.pulse = this.tweens.add({
        targets: this.timerRing,
        scale: 1.1,
        duration: 380,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private drawTimer(): void {
    const g = this.timerRing;
    const fraction = Math.max(0, Math.min(1, this.timeLeft / TIME_LIMIT_MS));
    const active = this.state === 'question';
    const color = !active
      ? COLORS.line
      : fraction > 0.5
        ? COLORS.success
        : fraction > 0.2
          ? COLORS.warn
          : COLORS.danger;

    g.clear();
    g.lineStyle(8, 0xdfe7f6, 1);
    g.beginPath();
    g.arc(0, 0, RING_R, 0, Math.PI * 2, false);
    g.strokePath();
    if (fraction > 0) {
      g.lineStyle(8, color, 1);
      g.beginPath();
      g.arc(0, 0, RING_R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction, false);
      g.strokePath();
    }
    this.timerText.setText(String(Math.ceil(this.timeLeft / 1000)));
    this.timerText.setColor(Phaser.Display.Color.IntegerToColor(color).rgba);
  }

  // -------------------------------------------------------------- 键盘

  private bindKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const keys = ['A', 'B', 'C', 'D', 'ONE', 'TWO', 'THREE', 'FOUR'];
    keys.forEach((key, index) => {
      const option = index % 4;
      keyboard.on(`keydown-${key}`, () => this.answer(option));
    });
    keyboard.on('keydown-SPACE', () => this.next());
    keyboard.on('keydown-ENTER', () => this.next());
  }
}

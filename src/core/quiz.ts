/**
 * 纯逻辑层：题目、计分、等级、闯关进度。与 Phaser 无关，便于单独验证。
 */

/** 题目可用的插画素材（见 src/ui/art-assets.ts）。 */
export type QuestionArt = 'cover' | 'seatbelt' | 'sign' | 'crossing' | 'car';

export interface QuizQuestion {
  id: string;
  /** 题干 */
  text: string;
  /** 四个选项 */
  options: string[];
  /** 正确选项下标 */
  answer: number;
  /** 解析 */
  explanation: string;
  /** 配图（可选，答题页卡片内展示） */
  art?: QuestionArt;
}

export const POINTS_CORRECT = 10;
export const POINTS_WRONG = -10;
export const TIME_LIMIT_MS = 20_000;
export const QUESTIONS_PER_ROUND = 10;
export const PASS_SCORE = 90;

export type AnswerOutcome = 'correct' | 'wrong' | 'timeout';

export interface AnswerRecord {
  question: QuizQuestion;
  /** 超时为 null */
  chosen: number | null;
  outcome: AnswerOutcome;
  delta: number;
  /** 本题用时（毫秒） */
  elapsed: number;
}

export interface Grade {
  letter: 'S' | 'A' | 'B' | 'C' | 'D';
  title: string;
  comment: string;
  passed: boolean;
}

export const GRADES: readonly Grade[] = [
  { letter: 'S', title: '一次过', comment: '稳得像老司机，科目一稳过。', passed: true },
  { letter: 'A', title: '高分学员', comment: '底子扎实，把错题再啃一遍就满分。', passed: false },
  { letter: 'B', title: '稳步前进', comment: '离合格线一步之遥，上考场别紧张。', passed: false },
  { letter: 'C', title: '需要加练', comment: '错题多在法规和标志，回炉重刷一次。', passed: false },
  { letter: 'D', title: '建议重修', comment: '别急着约考，先把题库刷两遍。', passed: false },
];

/** 依据单关得分给出等级：90 分及格，与真实科目一一致。 */
export function gradeFor(score: number): Grade {
  if (score >= 90) return GRADES[0];
  if (score >= 80) return GRADES[1];
  if (score >= 70) return GRADES[2];
  if (score >= 60) return GRADES[3];
  return GRADES[4];
}

/** Fisher–Yates 洗牌。 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * 从题库中随机抽取一轮题目，尽量不与已用题目重复；题库不足时循环复用。
 */
export function pickRound(
  bank: readonly QuizQuestion[],
  count: number,
  used: ReadonlySet<string>,
  random: () => number = Math.random,
): { questions: QuizQuestion[]; used: Set<string> } {
  const nextUsed = new Set(used);
  let pool = shuffle(bank.filter((question) => !nextUsed.has(question.id)), random);
  if (pool.length < count) {
    const reused = shuffle(bank.filter((question) => nextUsed.has(question.id)), random);
    pool = pool.concat(reused.slice(0, count - pool.length));
  }
  const questions = pool.slice(0, count);
  for (const question of questions) nextUsed.add(question.id);
  return { questions, used: nextUsed };
}

/** 一轮闯关的状态机。 */
export class QuizSession {
  readonly questions: QuizQuestion[];
  readonly records: AnswerRecord[] = [];
  index = 0;

  constructor(questions: QuizQuestion[]) {
    this.questions = questions;
  }

  get current(): QuizQuestion {
    return this.questions[this.index];
  }

  get finished(): boolean {
    return this.index >= this.questions.length;
  }

  get score(): number {
    return this.records.reduce((sum, record) => sum + record.delta, 0);
  }

  get correctCount(): number {
    return this.records.filter((record) => record.outcome === 'correct').length;
  }

  get wrongCount(): number {
    return this.records.filter((record) => record.outcome === 'wrong').length;
  }

  get timeoutCount(): number {
    return this.records.filter((record) => record.outcome === 'timeout').length;
  }

  get elapsedMs(): number {
    return this.records.reduce((sum, record) => sum + record.elapsed, 0);
  }

  get grade(): Grade {
    return gradeFor(this.score);
  }

  /**
   * 记录一次作答。chosen 为 null 表示超时，按答错处理。
   * 返回本次作答记录，重复作答同一题会被忽略。
   */
  answer(chosen: number | null, elapsed: number): AnswerRecord | null {
    if (this.finished) return null;
    const question = this.current;
    const correct = chosen !== null && chosen === question.answer;
    const outcome: AnswerOutcome = chosen === null ? 'timeout' : correct ? 'correct' : 'wrong';
    const record: AnswerRecord = {
      question,
      chosen,
      outcome,
      delta: outcome === 'correct' ? POINTS_CORRECT : POINTS_WRONG,
      elapsed: Math.min(elapsed, TIME_LIMIT_MS),
    };
    this.records.push(record);
    this.index += 1;
    return record;
  }
}

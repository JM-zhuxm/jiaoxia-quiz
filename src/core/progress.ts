/**
 * 跨局进度：累计得分、最好成绩、已闯关数。localStorage 不可用时静默降级。
 */
export interface Progress {
  totalScore: number;
  bestScore: number;
  levels: number;
}

const STORAGE_KEY = 'jiaoxia-quiz-progress';

const EMPTY: Progress = { totalScore: 0, bestScore: 0, levels: 0 };

export function loadProgress(): Progress {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      totalScore: Number(parsed.totalScore) || 0,
      bestScore: Number(parsed.bestScore) || 0,
      levels: Number(parsed.levels) || 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveProgress(progress: Progress): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* 隐私模式或存储被禁用时忽略 */
  }
}

/** 记录一关成绩，返回更新后的进度。 */
export function recordRound(score: number, previous: Progress = loadProgress()): Progress {
  const next: Progress = {
    totalScore: previous.totalScore + score,
    bestScore: Math.max(previous.bestScore, score),
    levels: previous.levels + 1,
  };
  saveProgress(next);
  return next;
}

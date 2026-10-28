import { loadProgress, type Progress } from './progress';

/** 跨场景共享的闯关状态。 */
export const gameState: {
  /** 当前关卡序号，从 1 开始 */
  level: number;
  /** 本次会话已经出过的题目，避免同一关重复 */
  used: Set<string>;
  /** 历史进度 */
  progress: Progress;
} = {
  level: 1,
  used: new Set<string>(),
  progress: loadProgress(),
};

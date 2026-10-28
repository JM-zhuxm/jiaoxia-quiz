import type Phaser from 'phaser';
import { QUESTIONS } from '../data/questions';
import { QUESTIONS_PER_ROUND, pickRound } from './quiz';
import { gameState } from './state';

/**
 * 开始新的一关：从未出过的题目中抽题，并进入答题场景。
 * 标题页与成绩页共用，保证「再闯一关」和「开始闯关」规则一致。
 */
export function startRound(scene: Phaser.Scene): void {
  const { questions, used } = pickRound(QUESTIONS, QUESTIONS_PER_ROUND, gameState.used);
  gameState.used = used;
  scene.scene.start('Quiz', { questions, level: gameState.level });
}

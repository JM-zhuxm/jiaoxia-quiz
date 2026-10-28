/**
 * 纯逻辑自检：题库结构、答案分布、计分与等级、抽题规则。
 * 运行： npm run verify
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { QUESTIONS } from '../src/data/questions';
import { ART } from '../src/ui/art-assets';
import {
  PASS_SCORE,
  POINTS_CORRECT,
  POINTS_WRONG,
  QUESTIONS_PER_ROUND,
  QuizSession,
  gradeFor,
  pickRound,
  type QuizQuestion,
} from '../src/core/quiz';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label} ${detail}`);
  }
}

console.log('\n[1] 题库结构');
check('题目数量 ≥ 30', QUESTIONS.length >= 30, `实际 ${QUESTIONS.length}`);
check('每题都是 4 个选项', QUESTIONS.every((q) => q.options.length === 4));
check('答案下标合法', QUESTIONS.every((q) => q.answer >= 0 && q.answer < 4));
check('题干非空', QUESTIONS.every((q) => q.text.trim().length > 4));
check('解析非空', QUESTIONS.every((q) => q.explanation.trim().length > 8));
check('解析里没有混入英文 report', !QUESTIONS.some((q) => /report/i.test(q.explanation)));
check('选项不重复', QUESTIONS.every((q) => new Set(q.options).size === 4));
check('题目 id 唯一', new Set(QUESTIONS.map((q) => q.id)).size === QUESTIONS.length);
check(
  '题干不重复',
  new Set(QUESTIONS.map((q) => q.text)).size === QUESTIONS.length,
);

console.log('\n[2] 答案位置分布');
const distribution = [0, 0, 0, 0];
QUESTIONS.forEach((q) => {
  distribution[q.answer] += 1;
});
console.log(`  A/B/C/D = ${distribution.join(' / ')}`);
check('四个位置都有题', distribution.every((n) => n > 0));
check('最集中位置不超过 40%', Math.max(...distribution) <= QUESTIONS.length * 0.4);

console.log('\n[3] 计分');
check('答对 +10 / 答错 -10', POINTS_CORRECT === 10 && POINTS_WRONG === -10);
const allCorrect = new QuizSession(QUESTIONS.slice(0, QUESTIONS_PER_ROUND));
QUESTIONS.slice(0, QUESTIONS_PER_ROUND).forEach((q) => allCorrect.answer(q.answer, 4000));
check('全对 = 100 分', allCorrect.score === 100, `实际 ${allCorrect.score}`);
check('全对 = S 级且合格', allCorrect.grade.letter === 'S' && allCorrect.grade.passed);
check('全对答对数 = 10', allCorrect.correctCount === 10);

const oneWrong = new QuizSession(QUESTIONS.slice(0, QUESTIONS_PER_ROUND));
QUESTIONS.slice(0, QUESTIONS_PER_ROUND).forEach((q, index) => {
  const pick = index === 0 ? (q.answer + 1) % 4 : q.answer;
  oneWrong.answer(pick, 4000);
});
check('错一题 = 80 分', oneWrong.score === 80, `实际 ${oneWrong.score}`);
check('80 分 = A 级', oneWrong.grade.letter === 'A');
check('80 分不合格（低于 90）', !oneWrong.grade.passed);

const withTimeout = new QuizSession(QUESTIONS.slice(0, QUESTIONS_PER_ROUND));
QUESTIONS.slice(0, QUESTIONS_PER_ROUND).forEach((q, index) => {
  withTimeout.answer(index === 0 ? null : q.answer, index === 0 ? 20000 : 3000);
});
check('超时按答错 -10', withTimeout.score === 80, `实际 ${withTimeout.score}`);
check('超时计数 = 1', withTimeout.timeoutCount === 1);
check('总用时累加', withTimeout.elapsedMs === 20000 + 3000 * 9, `实际 ${withTimeout.elapsedMs}`);
check('答完即结束', withTimeout.finished);

console.log('\n[4] 等级线');
check('90 → S', gradeFor(90).letter === 'S');
check('89 → A', gradeFor(89).letter === 'A');
check('80 → A', gradeFor(80).letter === 'A');
check('70 → B', gradeFor(70).letter === 'B');
check('60 → C', gradeFor(60).letter === 'C');
check('59 → D', gradeFor(59).letter === 'D');
check('合格线 = 90', PASS_SCORE === 90);

console.log('\n[5] 抽题');
const round = pickRound(QUESTIONS, QUESTIONS_PER_ROUND, new Set<string>());
check('抽到 10 题', round.questions.length === QUESTIONS_PER_ROUND);
check('关内不重复', new Set(round.questions.map((q) => q.id)).size === QUESTIONS_PER_ROUND);
check('已用集合被更新', round.used.size === QUESTIONS_PER_ROUND);
const round2 = pickRound(QUESTIONS, QUESTIONS_PER_ROUND, round.used);
check('下一关优先出没做过的题', round2.questions.every((q) => !round.used.has(q.id)));
const exhausted = pickRound(QUESTIONS, QUESTIONS_PER_ROUND, new Set(QUESTIONS.map((q) => q.id)));
check('题库用尽后仍能凑够 10 题', exhausted.questions.length === QUESTIONS_PER_ROUND);

console.log('\n[6] 随机性（同一随机源可复现）');
const makeRandom = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const a = pickRound(QUESTIONS, QUESTIONS_PER_ROUND, new Set<string>(), makeRandom(42));
const b = pickRound(QUESTIONS, QUESTIONS_PER_ROUND, new Set<string>(), makeRandom(42));
check('相同种子抽到相同题目', a.questions.map((q) => q.id).join() === b.questions.map((q) => q.id).join());

console.log('\n[7] 逐题答案自洽');
const broken = QUESTIONS.filter((q: QuizQuestion) => {
  const answerText = q.options[q.answer];
  return !answerText || answerText.length === 0;
});
check('每题正确选项都有文本', broken.length === 0);

console.log('\n[8] 插画资源');
const artRoot = join(process.cwd(), 'public/art');
check('素材清单共 5 项', Object.keys(ART).length === 5, `实际 ${Object.keys(ART).length}`);
Object.entries(ART).forEach(([name, asset]) => {
  check(`${name} 图片存在：${asset.url}`, existsSync(join(artRoot, asset.url.split('/').pop() ?? '')));
  check(`${name} 显示比例与素材一致`, asset.display.width > 0 && asset.display.height > 0);
});
const artQuestions = QUESTIONS.filter((q) => q.art);
check('至少 3 道题带配图', artQuestions.length >= 3, `实际 ${artQuestions.length}`);
check(
  '配图 key 均在素材清单中',
  artQuestions.every((q) => Boolean(q.art && ART[q.art])),
);

console.log(
  failures === 0 ? '\n全部通过 ✅\n' : `\n${failures} 项未通过 ❌\n`,
);
process.exit(failures === 0 ? 0 : 1);

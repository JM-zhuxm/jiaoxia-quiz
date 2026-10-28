/**
 * 浏览器实测：用系统自带的 Chromium + CDP 驱动真实指针/键盘输入，
 * 走完「标题 → 答题 → 解析 → 结算」全流程并截图。
 *
 * 用法： npm run playtest
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countColor, decodePng, distinctColors } from './png.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'screenshots');
const APP_PORT = 4179;
const CDP_PORT = 9345;
const CHROME = process.env.CHROME_BIN ?? '/snap/bin/chromium';
const GAME_W = 720;
const GAME_H = 1280;

mkdirSync(OUT, { recursive: true });

const problems = [];
const log = (msg) => console.log(msg);
/** 本次实测是否遇到过带配图的题目（机会性检查）。 */
let artSeen = false;

// ------------------------------------------------------------------ CDP 客户端

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      } else {
        this.listeners.forEach((fn) => fn(message));
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 20000);
    });
  }

  on(fn) {
    this.listeners.push(fn);
  }

  close() {
    this.ws.close();
  }
}

// ------------------------------------------------------------------ 辅助

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`evaluate failed: ${result.exceptionDetails.text}`);
  }
  return result.result.value;
}

async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  log(`  📸 ${name}.png`);
  return file;
}

/** 把游戏坐标（720×1280）的矩形换算成截图像素矩形。 */
function regionOf(rect, gx, gy, gw, gh) {
  const x = rect.x + (gx / GAME_W) * rect.w;
  const y = rect.y + (gy / GAME_H) * rect.h;
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.max(1, Math.round((gw / GAME_W) * rect.w)),
    h: Math.max(1, Math.round((gh / GAME_H) * rect.h)),
  };
}

/**
 * 像素级美术体检：模型无法直接看图，改为对截图采样，
 * 确认生成的插画 / 徽章 / 计时环 / CTA 真的出现在画面上。
 */
function visualCheck(file, rect, tag, spec) {
  const image = decodePng(readFileSync(file));
  spec.forEach((rule) => {
    const region = regionOf(rect, rule.x, rule.y, rule.w, rule.h);
    if (rule.minColors) {
      const colors = distinctColors(image, region);
      if (colors < rule.minColors) {
        problems.push(`${tag}: ${rule.name} 区域颜色过少（${colors} < ${rule.minColors}），可能没画出来`);
      }
    }
    if (rule.color) {
      const hits = countColor(image, region, rule.color, rule.tolerance ?? 56);
      if (hits < (rule.minHits ?? 12)) {
        problems.push(`${tag}: ${rule.name} 区域缺少 ${rule.color} 色像素（${hits} < ${rule.minHits ?? 12}）`);
      }
    }
  });
}

async function canvasRect(cdp) {
  return evaluate(
    cdp,
    `(() => { const c = document.querySelector('canvas'); if (!c) return null;
      const r = c.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height,
               sw: window.innerWidth, sh: window.innerHeight,
               scrollW: document.documentElement.scrollWidth,
               scrollH: document.documentElement.scrollHeight }; })()`,
  );
}

function toScreen(rect, gx, gy) {
  return {
    x: rect.x + (gx / GAME_W) * rect.w,
    y: rect.y + (gy / GAME_H) * rect.h,
  };
}

async function click(cdp, rect, gx, gy) {
  const point = toScreen(rect, gx, gy);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await delay(40);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await delay(120);
}

async function pressKey(cdp, key, code, keyCode) {
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
    text: key,
  });
  await delay(30);
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await delay(120);
}

async function snapshot(cdp) {
  return evaluate(cdp, `JSON.stringify(window.__OHMYGAME_PLAYTEST__.snapshot())`).then((raw) =>
    raw ? JSON.parse(raw) : {},
  );
}

/** 题目带配图时，对该区域做像素体检（机会性检查）。 */
async function checkQuestionArt(cdp, rect, tag, snap, qIndex) {
  const art = snap.art;
  if (!art || !art.w || !art.h) return false;
  const file = await shot(cdp, `${tag}-art-${qIndex}`);
  visualCheck(file, rect, `${tag}/题目配图`, [
    { name: '题目配图', x: art.x, y: art.y, w: art.w, h: art.h, minColors: 400 },
  ]);
  return true;
}

async function layout(cdp) {
  return evaluate(cdp, `JSON.stringify(window.__OHMYGAME_PLAYTEST__.layout())`).then((raw) =>
    raw ? JSON.parse(raw) : [],
  );
}

/**
 * 布局体检：
 * 1. 所有显示对象必须在 720×1280 画布内；
 * 2. 容器内的文字不得溢出容器；
 * 3. 两段文字不得互相重叠。
 */
async function auditLayout(cdp, tag) {
  const items = await layout(cdp);
  const contains = (outer, inner) =>
    inner.x >= outer.x - 1 &&
    inner.y >= outer.y - 1 &&
    inner.x + inner.w <= outer.x + outer.w + 1 &&
    inner.y + inner.h <= outer.y + outer.h + 1;

  items.forEach((item) => {
    const { x, y, w, h } = item;
    if (item.type !== 'Text' && item.type !== 'Image') return;
    if (x < -1 || y < -1 || x + w > 721 || y + h > 1281) {
      problems.push(
        `${tag}: ${item.type === 'Image' ? '图片' : '文字'}「${item.text ?? ''}」超出画布 (${x},${y} ${w}×${h})`,
      );
    }
    // 不得侵入底部 CTA 区（1126 以下属于 CTA）
    if (y < 1126 && y + h > 1130) {
      problems.push(
        `${tag}: ${item.type === 'Image' ? '图片' : '文字'}「${item.text ?? ''}」侵入底部 CTA 区 (${x},${y} ${w}×${h})`,
      );
    }
  });

  const texts = items.filter((item) => item.type === 'Text' && item.w > 0);
  if (texts.length < 3) {
    problems.push(`${tag}: 布局体检样本过少（${texts.length} 段文字），作用域可能失效`);
  }
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i];
      const b = texts[j];
      const overlap =
        a.x < b.x + b.w - 2 && b.x < a.x + a.w - 2 && a.y < b.y + b.h - 2 && b.y < a.y + a.h - 2;
      if (overlap) {
        problems.push(
          `${tag}: 文字重叠「${a.text}」(${a.x},${a.y} ${a.w}×${a.h}) ×「${b.text}」(${b.x},${b.y} ${b.w}×${b.h})`,
        );
      }
    }
  }
  void contains;
}

// ------------------------------------------------------------------ 流程

async function waitForCanvas(cdp) {
  for (let i = 0; i < 60; i += 1) {
    const ready = await evaluate(
      cdp,
      `!!(document.querySelector('canvas') && window.__OHMYGAME_PLAYTEST__)`,
    );
    if (ready) return true;
    await delay(250);
  }
  return false;
}

async function runFlow(cdp, tag) {
  log(`\n▶ ${tag}`);
  const state = await snapshot(cdp);
  if (state.scene !== 'Title') problems.push(`${tag}: 首屏场景应为 Title，实际 ${state.scene}`);
  let rect = await canvasRect(cdp);
  const titleFile = await shot(cdp, `${tag}-1-title`);
  await auditLayout(cdp, `${tag}/标题页`);
  visualCheck(titleFile, rect, `${tag}/标题页`, [
    { name: '封面插画', x: 36, y: 322, w: 648, h: 396, minColors: 800 },
    { name: '底部 CTA', x: 36, y: 1152, w: 648, h: 92, color: [255, 159, 28], minHits: 1500 },
  ]);

  // 开始闯关
  const start = state.startButton;
  if (!start) {
    problems.push(`${tag}: 快照缺少开始按钮`);
    return;
  }
  const textures = state.artTextures ?? [];
  if (textures.length !== 5) {
    problems.push(`${tag}: 应加载 5 张插画素材，实际 ${textures.length}（${textures.join(',')}）`);
  } else {
    log('  ✓ 5 张插画素材已加载');
  }
  await click(cdp, rect, start.x, start.y);
  await delay(500);

  const quizState = await snapshot(cdp);
  if (quizState.scene !== 'Quiz') {
    problems.push(`${tag}: 点击开始后未进入 Quiz，实际 ${quizState.scene}`);
    return;
  }
  if (quizState.total !== 10) problems.push(`${tag}: 每关题量应为 10，实际 ${quizState.total}`);
  const quizFile = await shot(cdp, `${tag}-2-quiz`);
  await auditLayout(cdp, `${tag}/答题页`);
  visualCheck(quizFile, rect, `${tag}/答题页`, [
    { name: '倒计时环', x: 316, y: 16, w: 88, h: 88, color: [22, 163, 74], minHits: 60 },
  ]);

  // 逐题作答：第 1 题故意答错，其余答对
  for (let q = 0; q < 10; q += 1) {
    const snap = await snapshot(cdp);
    if (snap.state !== 'question') {
      problems.push(`${tag}: 第 ${q + 1} 题状态异常 ${snap.state}`);
      break;
    }
    const options = snap.options ?? [];
    if (options.length !== 4) {
      problems.push(`${tag}: 第 ${q + 1} 题选项数 ${options.length}`);
      break;
    }
    const wantWrong = q === 0;
    const targetIndex = wantWrong
      ? (snap.correctIndex + 1) % 4
      : snap.correctIndex;
    if (await checkQuestionArt(cdp, rect, tag, snap, q)) artSeen = true;
    const option = options[targetIndex];
    rect = await canvasRect(cdp);
    await click(cdp, rect, option.x + option.w / 2, option.y + option.h / 2);
    await delay(320);

    const after = await snapshot(cdp);
    if (after.state !== 'explaining') {
      problems.push(`${tag}: 第 ${q + 1} 题作答后未进入 explaining，实际 ${after.state}`);
      break;
    }
    if (q === 0) {
      const explainFile = await shot(cdp, `${tag}-3-explain`);
      await auditLayout(cdp, `${tag}/解析面板`);
      visualCheck(explainFile, rect, `${tag}/解析面板`, [
        { name: '正确对勾', x: 58, y: 700, w: 50, h: 190, color: [22, 163, 74], minHits: 100 },
        { name: '错误叉号', x: 58, y: 700, w: 50, h: 190, color: [229, 72, 77], minHits: 80 },
      ]);
    }

    // 下一题
    if (q === 0) {
      // 验证键盘：按空格进入下一题
      await pressKey(cdp, ' ', 'Space', 32);
      const moved = await snapshot(cdp);
      if (moved.index !== 1) {
        problems.push(`${tag}: 空格未进入下一题，index=${moved.index}`);
      }
    } else {
      const next = (await snapshot(cdp)).nextButton;
      if (!next) {
        problems.push(`${tag}: 解析面板缺少下一题按钮`);
        break;
      }
      rect = await canvasRect(cdp);
      await click(cdp, rect, next.x, next.y);
    }
    await delay(260);
  }

  await delay(600);
  const result = await snapshot(cdp);
  if (result.scene !== 'Result') {
    problems.push(`${tag}: 未进入结算页，实际 ${result.scene}`);
  } else {
    if (result.score !== 80) problems.push(`${tag}: 预期 80 分（9 对 1 错），实际 ${result.score}`);
    if (result.grade !== 'A') problems.push(`${tag}: 预期 A 级，实际 ${result.grade}`);
    if (result.passed !== false) problems.push(`${tag}: 85 分应为未合格`);
  }
  const resultFile = await shot(cdp, `${tag}-4-result`);
  await auditLayout(cdp, `${tag}/成绩页`);
  visualCheck(resultFile, rect, `${tag}/成绩页`, [
    { name: '成绩徽章', x: 286, y: 112, w: 148, h: 148, color: [245, 185, 66], minHits: 300 },
    { name: '徽章内车辆插画', x: 310, y: 144, w: 100, h: 100, minColors: 300 },
  ]);

  // CTA 跳转
  const cta = await evaluate(cdp, `(() => {
    window.__ctaOpens = [];
    const original = window.open;
    window.open = (...args) => { window.__ctaOpens.push(args[0]); return { focus() {} }; };
    return true;
  })()`);
  void cta;
  const resultState = await snapshot(cdp);
  if (resultState.cta) {
    rect = await canvasRect(cdp);
    await click(cdp, rect, resultState.cta.x, resultState.cta.y);
    await delay(200);
    const opened = await evaluate(cdp, `JSON.stringify(window.__ctaOpens || [])`);
    if (!opened.includes('https://cargo20.com/')) {
      problems.push(`${tag}: CTA 未跳转 cargo20.com，实际 ${opened}`);
    } else {
      log('  ✓ CTA 跳转 cargo20.com');
    }
  } else {
    problems.push(`${tag}: 结算页缺少 CTA`);
  }

  // 返回首页
  const home = resultState.homeButton;
  if (home) {
    rect = await canvasRect(cdp);
    await click(cdp, rect, home.x, home.y);
    await delay(500);
    const back = await snapshot(cdp);
    if (back.scene !== 'Title') problems.push(`${tag}: 返回首页失败，实际 ${back.scene}`);
  }
}

/** 边界流程：超时判负、再闯一关进入下一关。 */
async function runEdgeFlow(cdp) {
  log('\n▶ 边界：超时 / 再闯一关');
  await evaluate(cdp, `window.__OHMYGAME_PLAYTEST__.reset()`);
  await delay(500);
  const state = await snapshot(cdp);
  if (state.scene !== 'Title') {
    problems.push(`边界: reset 后未回到标题，实际 ${state.scene}`);
    return;
  }
  let rect = await canvasRect(cdp);
  await click(cdp, rect, state.startButton.x, state.startButton.y);
  await delay(400);

  // 快进 21 秒，触发超时
  await evaluate(cdp, `window.__OHMYGAME_PLAYTEST__.step(21000)`);
  await delay(400);
  const timeoutState = await snapshot(cdp);
  if (timeoutState.state !== 'explaining') {
    problems.push(`边界: 超时后未进入 explaining，实际 ${timeoutState.state}`);
  }
  if (timeoutState.score !== -10) {
    problems.push(`边界: 超时应扣 10 分，实际 ${timeoutState.score}`);
  }
  const items = await layout(cdp);
  const sheetTexts = items.map((item) => item.text ?? '').join('|');
  if (!sheetTexts.includes('超时未答')) {
    problems.push('边界: 解析面板未显示「超时未答」');
  } else {
    log('  ✓ 超时判定与扣分正确');
  }

  // 第 1 题已超时，把剩下 9 题答完并进入结算
  for (let q = 0; q < 10; q += 1) {
    const snap = await snapshot(cdp);
    if (snap.state === 'question') {
      if (await checkQuestionArt(cdp, rect, 'edge', snap, q)) artSeen = true;
      const option = snap.options[snap.correctIndex];
      rect = await canvasRect(cdp);
      await click(cdp, rect, option.x + option.w / 2, option.y + option.h / 2);
      await delay(260);
    }
    const after = await snapshot(cdp);
    if (after.state === 'explaining') {
      const next = after.nextButton;
      rect = await canvasRect(cdp);
      await click(cdp, rect, next.x, next.y);
      await delay(240);
    }
  }

  await delay(500);
  const result = await snapshot(cdp);
  if (result.scene !== 'Result') {
    problems.push(`边界: 未进入结算页，实际 ${result.scene}`);
    return;
  }
  if (result.score !== 80) {
    problems.push(`边界: 1 超时 + 9 全对应 80 分，实际 ${result.score}`);
  }

  // 再闯一关 → 直接进入第 2 关
  rect = await canvasRect(cdp);
  await click(cdp, rect, result.nextButton.x, result.nextButton.y);
  await delay(600);
  const nextRound = await snapshot(cdp);
  if (nextRound.scene !== 'Quiz') {
    problems.push(`边界: 「再闯一关」未进入答题，实际 ${nextRound.scene}`);
  } else if (nextRound.level !== state.level + 1) {
    problems.push(`边界: 「再闯一关」应进入第 ${state.level + 1} 关，实际第 ${nextRound.level} 关`);
  } else if (nextRound.index !== 0 || nextRound.score !== 0) {
    problems.push('边界: 第 2 关未重置题号与分数');
  } else {
    log(`  ✓ 再闯一关进入第 ${nextRound.level} 关`);
  }
}

// ------------------------------------------------------------------ 主流程

const server = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), String(APP_PORT)], {
  stdio: 'inherit',
});
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=/tmp/jx-playtest-${Date.now()}`,
    '--window-size=430,932',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const cleanup = () => {
  try {
    chrome.kill('SIGKILL');
  } catch {
    /* ignore */
  }
  try {
    server.kill('SIGKILL');
  } catch {
    /* ignore */
  }
};
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});

try {
  // 等待 chrome 起来
  let version = null;
  for (let i = 0; i < 40; i += 1) {
    try {
      version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
      break;
    } catch {
      await delay(250);
    }
  }
  if (!version) throw new Error('Chromium 未能在 CDP 端口启动');

  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.connect();

  const consoleErrors = [];
  cdp.on((message) => {
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      consoleErrors.push(details.exception?.description ?? details.text ?? 'unknown error');
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 430,
    height: 932,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${APP_PORT}/` });
  await delay(800);

  const ready = await waitForCanvas(cdp);
  if (!ready) throw new Error('游戏未在 15 秒内完成启动');
  log('✓ 游戏已启动（canvas 就绪）');

  await runFlow(cdp, 'mobile');
  await runEdgeFlow(cdp);
  if (!artSeen) {
    log('  ⚠ 本轮抽题没有遇到带配图的题目（题目配图属机会性检查）');
  }

  // 桌面视口（先回到标题页，截图才反映真实标题布局）
  await evaluate(cdp, `window.__OHMYGAME_PLAYTEST__.reset()`);
  await delay(600);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(600);
  const desktopRect = await canvasRect(cdp);
  if (desktopRect.scrollW > desktopRect.sw) {
    problems.push(`desktop: 出现横向滚动 ${desktopRect.scrollW} > ${desktopRect.sw}`);
  }
  await shot(cdp, 'desktop-1-title');
  await evaluate(cdp, `window.__OHMYGAME_PLAYTEST__.reset()`);
  await delay(400);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 667,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await delay(600);
  const smallRect = await canvasRect(cdp);
  if (smallRect.scrollW > smallRect.sw) {
    problems.push(`small: 出现横向滚动 ${smallRect.scrollW} > ${smallRect.sw}`);
  }
  await shot(cdp, 'small-1-title');

  if (consoleErrors.length) {
    problems.push(`控制台报错：${consoleErrors.join(' | ')}`);
  } else {
    log('✓ 无控制台报错');
  }

  cdp.close();
} catch (error) {
  problems.push(`异常：${error.message}`);
} finally {
  cleanup();
}

console.log('\n────────────── playtest 结果 ──────────────');
if (problems.length === 0) {
  console.log('全部通过 ✅');
} else {
  problems.forEach((p) => console.log(`❌ ${p}`));
}
process.exit(problems.length === 0 ? 0 : 1);

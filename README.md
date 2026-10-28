# 科目一闯关 · 长盛驾校

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Phaser](https://img.shields.io/badge/Phaser-3-990000?logo=phaser&logoColor=white)](https://phaser.io/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

移动端竖屏（9:16）H5 小游戏：真实科目一题库、每题 20 秒倒计时、90 分合格线，底部常驻「长盛驾校·从化学车」CTA。

技术栈：Vite 5 + TypeScript 5 + Phaser 3（WebGL/Canvas 自适应渲染），无后端、无网络请求。主视觉与教学配图使用**生图模型产出的 5 张扁平卡通插画**（随包发布的本地 WebP），界面卡片、徽章与图标用 Phaser Graphics 代码绘制。

在线试玩：<https://cargo20.com/games/jiaoxia-quiz/>

## 快速开始

```bash
npm install
npm run dev          # 本地开发
npm run build        # 产物在 dist/（base: './'，可托管到任意子目录）
npm run preview      # 预览生产构建
```

`dist/` 是纯静态产物，无后端依赖，直接丢到任意静态服务器即可。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发服务器（Vite） |
| `npm run build` | 类型检查 + 生产构建，产物在 `dist/`（`base: './'`，可任意目录托管，`public/art/` 随包复制到 `dist/art/`） |
| `npm run preview` | 预览生产构建 |
| `npm run verify` | 题库/计分/等级/抽题逻辑自测 + 插画素材自检（esbuild 打包后用 Node 跑） |
| `npm run playtest` | 构建后用系统 Chromium + CDP 跑真实输入的端到端实测，并输出截图到 `screenshots/` |
| `node scripts/gen-art.mjs` | 重新调用图像服务生成 5 张插画原图（需 `AGNES_API_KEY`） |
| `node scripts/prep-art.mjs` | 把原图裁剪成 `public/art/*.webp` 生产素材 |

## 玩法规则

- 每关 10 题，来自 39 道真实科目一单选题（答案位置 A/B/C/D 轮转，分布均衡）。
- 每题 20 秒：答对 **+10**，答错或超时 **-10**，超时按答错处理并显示正确答案与解析。
- 等级：S 90~100（**合格**）、A 80~89、B 70~79、C 60~69、D 0~59；A 级仍记「未合格」。
- 结算页给出分数、等级评语、答对/答错/超时/用时统计、累计数据与错题回顾；「再闯一关」直接进入下一关。
- 累计总分、最好成绩、已闯关数写入 `localStorage`（键 `jiaoxia-quiz-progress`）。
- 操作：点按选项卡作答；键盘 `A/B/C/D` 或 `1-4` 选择，`Space/Enter` 进入下一题。

## 插画素材

| 文件 | 用途 |
| --- | --- |
| `public/art/art-1-cover.webp` | 标题页主视觉（学员在教练车内看路） |
| `public/art/art-2-seatbelt.webp` | 安全带题配图 |
| `public/art/art-3-sign.webp` | 交通标志识别题配图 |
| `public/art/art-4-crossing.webp` | 路口让行题配图 |
| `public/art/art-5-car.webp` | 成绩页金牌徽章中央的车辆插画 |

`src/ui/art-assets.ts` 是唯一入口，统一登记纹理 key、`public` 相对路径、裁剪区域与显示尺寸；`TitleScene.preload()` 预载全部 5 张，答题页按题目标记取图，成绩页取车辆插画。原始生图输出保留在 `assets/generated/`，`scripts/prep-art.mjs` 负责裁剪与转码。

## 目录

```
src/core/      纯逻辑：题库规则、计分等级、抽题、进度持久化、跨场景状态
src/data/      39 道单选题与解析
src/ui/        绘制工具（卡片/胶囊/按钮）、代码绘制美术、插画素材清单、底部 CTA
src/scenes/    TitleScene / QuizScene / ResultScene
public/art/    5 张生产插画（WebP）
scripts/       verify.ts（逻辑自测）、playtest.mjs（CDP 端到端实测）、png.mjs（截图像素检查）、
               gen-art.mjs（调用图像服务）、prep-art.mjs（裁剪转码）
canvas/        设计画板：主设计文档、实现截图、资产清单
```

## 验证

`npm run playtest` 覆盖：标题 → 答题 → 解析 → 结算全流程（真实鼠标/键盘输入）、空格键跳题、CTA 跳转 `https://cargo20.com/`、20 秒超时判负、「再闯一关」进入下一关、430×932 / 375×667 / 1280×800 多视口无横向滚动、布局包围盒审计（无文字/图片重叠、出血或侵入 CTA 区）、启动快照确认 5 张插画纹理已加载、截图像素采样确认封面插画、徽章车辆与题图真实上屏、无控制台报错。

## 触屏点击：hitArea 的两层陷阱

Phaser Container 的可点区域**必须**用左上原点 + 1px 余量生成，否则手机上点不动。

**第一层 —— 原点用错会让可点区整体偏移。**
`pointWithinHitArea` 会把 `displayOrigin`（Container 恒等于 `width*0.5`）加进局部坐标：

```
args = entry + (w/2, h/2)
```

`entry` 是以容器中心为原点的局部坐标（范围 ±w/2），所以图形实际占据的 `args` 区间是 `[0, w]`。
若 hitArea 写成中心原点 `Rectangle(-w/2, -h/2, w, h)`，可点区会整体偏移半个身位——
按钮正中点不中，鼠标因亚像素偏移偶尔能点中，触屏整数坐标则稳定失败。

**第二层 —— 左上原点仍不够，边界会压线。**
`Rectangle(0, 0, w, h)` 虽然原点对了，但它让**可点区边界与图形边界重合**。
点在容器正中时 `args` 恰好等于 `(w, h)`，正好卡在边界上，任何亚像素误差都判定失败。

实测：`Scale.FIT` 下 375×667 视口 `args_y = 92.0000117 > 92` → 选项卡完全点不动；
而 390×844 能点中纯属侥幸——hover 缩放 1.012 把 `entry` 推到 45.45，落到了内侧。

**做法**：统一走 `src/ui/kit.ts` 的 `makeHitArea(w, h)`，外扩 1px 留安全余量：

```ts
export function makeHitArea(w: number, h: number): Phaser.Geom.Rectangle {
  const PAD = 1;
  return new Phaser.Geom.Rectangle(-PAD, -PAD, w + PAD * 2, h + PAD * 2);
}
```

`src/ui/kit.ts`、`src/ui/cta.ts`、`src/scenes/QuizScene.ts` 三处 `setInteractive` 全部走它。

**检查工具**：

```bash
node ~/.hermes/skills/ohmygame-game-dev-deploy/scripts/check-hitarea.mjs .
```

退出码 0 = 原点约定一致（能识别 `makeHitArea` 这类辅助函数写法）。

**验收注意**：`Scale.FIT` 下同一点击在不同视口会产生不同的浮点误差，
所以必须覆盖多个视口（320 / 360 / 375 / 390 / 414 宽 + 1280 桌面），且触屏与鼠标各测一遍；
页面内 `dispatchEvent` 合成的 untrusted `PointerEvent` 不能作为结论。

## 素材与许可

- **代码**：MIT（见 [LICENSE](LICENSE)）。
- **5 张插画**（`public/art/*.webp`）由图像生成模型产出，已裁剪转为 WebP 随包发布；
  原始 PNG 不入库（`assets/generated/` 已在 `.gitignore` 中）。
- **题库**：`src/data/questions.ts` 中 39 道科目一单选题与解析为原创编写，
  依据公开的机动车驾驶考试科目一考试大纲整理，非官方题库原文转载。
- **商标**：不包含任何第三方商标；长盛驾校为示例文案，商用前请替换为实际主体名称。

## 致谢

- [Phaser 3](https://phaser.io/) — 游戏框架（MIT）
- [Vite](https://vitejs.dev/) — 构建工具（MIT）


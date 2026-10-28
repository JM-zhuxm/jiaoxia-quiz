/**
 * 全局主题：调色板、字体、画布尺寸与关键布局常量。
 * 浅色背景 + 交警蓝主色 + 答对绿 / 答错红 / 倒计时琥珀。
 */
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const MARGIN = 36;
export const CONTENT_WIDTH = GAME_WIDTH - MARGIN * 2;

export const COLORS = {
  bg: 0xeef3fb,
  surface: 0xffffff,
  surfaceSoft: 0xf4f8ff,
  primary: 0x2f6bff,
  primaryDark: 0x1b4fd8,
  primarySoft: 0xe4ecff,
  success: 0x16a34a,
  successSoft: 0xe2f6e8,
  danger: 0xe5484d,
  dangerSoft: 0xfdecec,
  warn: 0xf59e0b,
  warnSoft: 0xfdf1da,
  cta: 0xff9f1c,
  ctaDark: 0xf07c00,
  ctaSoft: 0xfff0dc,
  gold: 0xf5b942,
  goldDark: 0xdd9a1b,
  text: 0x16233a,
  textMuted: 0x6b7a90,
  line: 0xe2e9f5,
  shadow: 0xa9bcd8,
} as const;

export const FONT_FAMILY =
  '"PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "Hiragino Sans GB", system-ui, -apple-system, "Segoe UI", sans-serif';

/** 底部 CTA 常驻区域。 */
export const CTA_Y = 1152;
export const CTA_H = 92;

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const CTA_LABEL = '长盛驾校·从化学车';
export const CTA_URL = 'https://cargo20.com/';

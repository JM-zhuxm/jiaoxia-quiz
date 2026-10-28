import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './theme';
import { TitleScene } from './scenes/TitleScene';
import { QuizScene } from './scenes/QuizScene';
import { ResultScene } from './scenes/ResultScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 10,
  },
  scene: [TitleScene, QuizScene, ResultScene],
};

const game = new Phaser.Game(config);

// 仅供自动化测试使用的最小桥接，不参与正常游戏逻辑。
const bridge = {
  snapshot(): Record<string, unknown> {
    const provider = game.registry.get('__snapshot__');
    return typeof provider === 'function' ? (provider as () => Record<string, unknown>)() : {};
  },
  reset(): void {
    const reset = game.registry.get('__reset__');
    if (typeof reset === 'function') (reset as () => void)();
  },
  step(milliseconds: number): void {
    const step = game.registry.get('__step__');
    if (typeof step === 'function') (step as (stepMs: number) => void)(milliseconds);
  },
  /** 当前场景的显示对象包围盒（全局坐标），用于布局体检。 */
  layout(): Array<Record<string, unknown>> {
    const scene = game.scene.getScenes(true)[0];
    if (!scene) return [];
    const items: Array<Record<string, unknown>> = [];

    /** 对象在父级坐标系中的矩形。 */
    const localRect = (obj: Phaser.GameObjects.GameObject): { x: number; y: number; w: number; h: number } | null => {
      if (obj.type === 'Text') {
        const text = obj as Phaser.GameObjects.Text;
        return {
          x: text.x - text.originX * text.width,
          y: text.y - text.originY * text.height,
          w: text.width,
          h: text.height,
        };
      }
      if (obj.type === 'Image') {
        const image = obj as Phaser.GameObjects.Image;
        return {
          x: image.x - image.originX * image.displayWidth,
          y: image.y - image.originY * image.displayHeight,
          w: image.displayWidth,
          h: image.displayHeight,
        };
      }
      if (obj.type === 'Container') {
        const container = obj as Phaser.GameObjects.Container;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        container.list.forEach((child) => {
          const rect = localRect(child);
          if (!rect) return;
          minX = Math.min(minX, rect.x);
          minY = Math.min(minY, rect.y);
          maxX = Math.max(maxX, rect.x + rect.w);
          maxY = Math.max(maxY, rect.y + rect.h);
        });
        if (minX === Infinity) return null;
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
      return null;
    };

    const scopeProvider = game.registry.get('__scope__');
    const scope = typeof scopeProvider === 'function' ? scopeProvider() : null;
    const list: Phaser.GameObjects.GameObject[] = scope ? [scope] : scene.children.list;
    const offsetX = scope ? scope.x : 0;
    const offsetY = scope ? scope.y : 0;

    const walk = (
      items2: Phaser.GameObjects.GameObject[],
      parentIndex: number,
      offX: number,
      offY: number,
      depth: number,
    ) => {
      items2.forEach((obj) => {
        const ownDepth = (obj as unknown as { depth?: number }).depth ?? 0;
        const rect = localRect(obj);
        const index = items.length;
        items.push({
          type: obj.type,
          text: obj.type === 'Text' ? String((obj as Phaser.GameObjects.Text).text ?? '').slice(0, 30) : undefined,
          x: rect ? Math.round(rect.x + offX) : 0,
          y: rect ? Math.round(rect.y + offY) : 0,
          w: rect ? Math.round(rect.w) : 0,
          h: rect ? Math.round(rect.h) : 0,
          depth: depth + ownDepth,
          parent: parentIndex,
        });
        const container = obj as Phaser.GameObjects.Container;
        if (Array.isArray(container.list)) {
          walk(container.list, index, offX + container.x, offY + container.y, depth + ownDepth);
        }
      });
    };
    walk(list, -1, offsetX, offsetY, 0);
    return items;
  },
};

(globalThis as unknown as { __OHMYGAME_PLAYTEST__?: typeof bridge }).__OHMYGAME_PLAYTEST__ = bridge;

/**
 * @description 看板领域常量：卡片状态、种类、颜色、尺寸
 * @module features/kanban/constants
 * @prd docs/prds/claude-workflow-kanban.md#终端卡片
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T013
 * @rules
 *   - 主泳道宽度 360px, helper 泳道宽度 320px
 *   - 卡片左侧 3px 彩色条颜色严格按 kind: main 绿 / sub 紫 / skill teal / hook amber
 *   - Board 区域高度 100vh - 84px - 28px
 */

// Matches CardStatus from @/types/ipc
export const CARD_STATE = {
  IDLE:    'idle',
  RUNNING: 'run',
  OK:      'ok',
  ERROR:   'err',
} as const;
export type CardState = typeof CARD_STATE[keyof typeof CARD_STATE];

export const CARD_STATE_COLOR: Record<CardState, string> = {
  idle: 'var(--text-3)',
  run:  'var(--green)',
  ok:   'var(--teal)',
  err:  'var(--red)',
};

export const CARD_KIND = {
  MAIN:  'main',
  SUB:   'sub',
  SKILL: 'skill',
  HOOK:  'hook',
} as const;
export type CardKind = typeof CARD_KIND[keyof typeof CARD_KIND];

export const CARD_KIND_COLOR: Record<CardKind, string> = {
  main:  'var(--green)',
  sub:   'var(--purple)',
  skill: 'var(--teal)',
  hook:  'var(--amber)',
};

export const LANE_WIDTH = 360;
export const HELPER_LANE_WIDTH = 320;
export const CONNECTOR_WIDTH = 52;
export const TOPBAR_HEIGHT = 46;
export const PIPELINE_HEIGHT = 38;
export const RETRO_HEIGHT = 28;
export const SHELL_HEIGHT = 240;
// Board 区域高度 = 100vh - TOPBAR_HEIGHT - RETRO_HEIGHT
export const BOARD_HEIGHT_OFFSET = TOPBAR_HEIGHT + RETRO_HEIGHT; // 74px

export const CARD_HEIGHT = {
  compact:  120,
  normal:   200,
  expanded: 320,
} as const;
export type CardHeightMode = keyof typeof CARD_HEIGHT;

export const MAX_RECENT_WORKSPACES = 5;

/**
 * @description Design Token, 与设计稿 :root CSS 变量一一对应
 * @module src/styles
 * @prd docs/prds/claude-workflow-kanban.md#看板与泳道
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (顶部 :root 变量)
 */
export const tokens = {
  bg: 'var(--bg)',
  panel: 'var(--panel)',
  text: 'var(--text)',
  textMute: 'var(--text-mute)',
  green: 'var(--green)',
  teal: 'var(--teal)',
  yellow: 'var(--yellow)',
  red: 'var(--red)',
  gray: 'var(--gray)',
  fontSm: 'var(--font-sm)',
  fontMd: 'var(--font-md)',
  // 数值型 (不通过 CSS 变量, 直接 JS 用)
  laneWidth: 360,
  topbarHeight: 46,
  pipelineHeight: 38,
  connectorWidth: 52,
} as const;

export type Tokens = typeof tokens;

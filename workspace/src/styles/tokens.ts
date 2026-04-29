/**
 * @description Design Token — 与设计稿 docs/designs/claude-workflow-kanban/Workflow Kanban.html :root CSS 变量一一对应
 * @module src/styles
 * @prd docs/prds/claude-workflow-kanban.md#顶栏
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T002
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (:root 段)
 * @rules
 *   - 一切可变值通过 Design Token 引入，严禁写死颜色/字号/间距
 */

// ─── CSS 变量引用 (与 global.css :root 保持一一对应) ────────────────────────

export const tokens = {
  // 背景层次
  bg:   'var(--bg)',
  bg1:  'var(--bg-1)',
  bg2:  'var(--bg-2)',
  bg3:  'var(--bg-3)',
  bg4:  'var(--bg-4)',

  // 分割线
  line:  'var(--line)',
  line2: 'var(--line-2)',

  // 文字层次
  text:  'var(--text)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',

  // 色彩 (对应 acceptanceCriteria 导出名)
  colorGreen:  'var(--green)',
  colorTeal:   'var(--teal)',
  colorAmber:  'var(--amber)',
  colorRed:    'var(--red)',
  colorBlue:   'var(--blue)',
  colorPurple: 'var(--purple)',
  colorPink:   'var(--pink)',

  // 字体族
  fontMono: 'var(--mono)',
  fontSans: 'var(--sans)',

  // 字号 (数值, 供需要 px 数字的场景)
  fontSm: 11,   // 小标签 / 徽章
  fontMd: 13,   // 正文基准

  // 布局尺寸 (数值, 供 JS 计算)
  topbarHeight:     46,
  pipelineHeight:   38,
  retroHeight:      28,
  laneWidth:        360,
  helperLaneWidth:  320,
  connectorWidth:   52,
} as const;

export type Tokens = typeof tokens;

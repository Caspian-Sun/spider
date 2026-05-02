/**
 * @description Activity Bar 视图枚举及导航项配置
 * @module features/activity-bar
 * @prd docs/prds/claude-workflow-kanban.md#Activity-Bar
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T001
 * @rules
 *   - 顶部显示 λ logo（绿色，18px mono 字体，32×32px 区域），logo 下方依次排列 6 个导航按钮：看板（board）/ 需求（prd）/ 任务（tasks）/ 缺陷（bugs）/ 文档（docs）/ 设置（settings）
 *   - 工作区未加载（empty / invalid 状态）时，除 settings 外其他按钮禁用，徽章不显示
 */

export const ACTIVITY_VIEWS = ['board', 'prd', 'tasks', 'bugs', 'docs', 'settings'] as const;
export type ActivityView = typeof ACTIVITY_VIEWS[number];

export interface ActivityNavItem {
  id: ActivityView;
  label: string;
  /** icon unicode or text glyph */
  icon: string;
  /** 工作区未加载时是否禁用 */
  disableWhenNoWorkspace: boolean;
}

export const ACTIVITY_NAV_ITEMS: ActivityNavItem[] = [
  { id: 'board',    label: '看板',   icon: '⊞',  disableWhenNoWorkspace: true  },
  { id: 'prd',      label: '需求',   icon: '📄', disableWhenNoWorkspace: true  },
  { id: 'tasks',    label: '任务',   icon: '✓',  disableWhenNoWorkspace: true  },
  { id: 'bugs',     label: '缺陷',   icon: '⚠',  disableWhenNoWorkspace: true  },
  { id: 'docs',     label: '文档',   icon: '📚', disableWhenNoWorkspace: true  },
  { id: 'settings', label: '设置',   icon: '⚙',  disableWhenNoWorkspace: false },
] as const;

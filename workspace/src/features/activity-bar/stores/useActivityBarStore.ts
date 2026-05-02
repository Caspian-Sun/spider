/**
 * @description 管理 Activity Bar 当前激活视图（activeView），提供 setView action
 * @module features/activity-bar/stores
 * @dependencies zustand, @/features/activity-bar/constants
 * @prd docs/prds/claude-workflow-kanban.md#Activity-Bar
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T002
 * @rules
 *   - 切换 activeView 时，主内容区域整体替换，TopBar / PipelineStrip / RetroTimeline 保持挂载不重渲
 *   - 工作区未加载（empty / invalid 状态）时，除 settings 外其他按钮禁用，徽章不显示
 */

import { create } from 'zustand';
import type { ActivityView } from '../constants';

interface ActivityBarState {
  activeView: ActivityView;
}

interface ActivityBarActions {
  setView: (view: ActivityView) => void;
}

export const useActivityBarStore = create<ActivityBarState & ActivityBarActions>((set) => ({
  activeView: 'board',
  setView: (view) => set({ activeView: view }),
}));

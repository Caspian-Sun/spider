/**
 * @description 管理全局 Shell Panel 的开关状态、tab 列表和当前激活 tab
 * @module features/shell/stores
 * @dependencies zustand
 * @prd docs/prds/claude-workflow-kanban.md#全局-Shell-面板
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T003
 * @rules
 *   - 默认隐藏（transform: translateY(100%)），⌘`（反引号）切换显示/隐藏，TopBar >_Shell 按钮同等效果
 *   - Tab 栏高 32px，活跃 Tab 黑色背景 + 边框，Tab 有 × 关闭按钮
 *   - + 按钮新建 tab，自动 spawn 新 PTY 会话（默认 shell，cwd = workspace rootPath）
 *   - Shell Panel 打开时，Board bottom 从 28px 增加到 268px，防止内容被遮挡
 *   - close 等同 ⌘`（关闭面板，不销毁 PTY）；maximize 将面板高度扩展至覆盖 Board
 */

import { create } from 'zustand';

export interface ShellTab {
  id: string;
  ptyId: string | null;
  title: string;
}

interface ShellState {
  isOpen: boolean;
  isMaximized: boolean;
  tabs: ShellTab[];
  activeTabId: string | null;
}

interface ShellActions {
  toggle: () => void;
  open: () => void;
  close: () => void;
  toggleMaximize: () => void;
  addTab: (tab: ShellTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabPtyId: (id: string, ptyId: string) => void;
}

let _tabSeq = 0;

export const useShellStore = create<ShellState & ShellActions>((set, get) => ({
  isOpen: false,
  isMaximized: false,
  tabs: [],
  activeTabId: null,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),

  toggleMaximize: () => set((s) => ({ isMaximized: !s.isMaximized })),

  addTab: (tab) =>
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    })),

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const remaining = tabs.filter((t) => t.id !== id);
    const newActive =
      activeTabId === id
        ? remaining.length > 0 ? remaining[remaining.length - 1].id : null
        : activeTabId;
    set({ tabs: remaining, activeTabId: newActive });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTabPtyId: (id, ptyId) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ptyId } : t)),
    })),
}));

export function makeShellTabId(): string {
  return `shell-tab-${++_tabSeq}`;
}

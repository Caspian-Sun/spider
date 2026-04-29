/**
 * @description 工作区全局状态机 store，管理 phase / workspace / recentWorkspaces
 * @module stores/useWorkspaceStore
 * @dependencies zustand, @/types/ipc
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T010
 * @rules
 *   - 应用启动后, 若 get_recent_workspaces 返回空数组, 进入 empty 状态并显示欢迎页
 *   - 应用启动后, 若有最近工作区记录, 默认打开最近一个并自动进入 scanning 状态
 *   - scan 完成后自动进入 ready 状态, 并把 rootPath 写入 recentWorkspaces 头部
 */

import { create } from 'zustand';
import type { Workspace } from '@/types/ipc';

export type WorkspacePhase = 'empty' | 'scanning' | 'invalid' | 'ready' | 'error';

interface WorkspaceState {
  phase: WorkspacePhase;
  workspace: Workspace | null;
  recentWorkspaces: string[];
  activePrdId: string | null;
  scanError: string | null;
}

interface WorkspaceActions {
  setPhase: (phase: WorkspacePhase) => void;
  setWorkspace: (workspace: Workspace) => void;
  setActivePrd: (prdId: string | null) => void;
  addRecent: (path: string) => void;
  removeRecent: (path: string) => void;
  setScanError: (error: string | null) => void;
  reset: () => void;
}

const initialState: WorkspaceState = {
  phase: 'empty',
  workspace: null,
  recentWorkspaces: [],
  activePrdId: null,
  scanError: null,
};

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),

  // setting workspace automatically transitions to ready
  setWorkspace: (workspace) => set({ workspace, phase: 'ready', scanError: null }),

  setActivePrd: (activePrdId) => set({ activePrdId }),

  addRecent: (path) =>
    set((state) => {
      const filtered = state.recentWorkspaces.filter((p) => p !== path);
      return { recentWorkspaces: [path, ...filtered].slice(0, 5) };
    }),

  removeRecent: (path) =>
    set((state) => ({
      recentWorkspaces: state.recentWorkspaces.filter((p) => p !== path),
    })),

  setScanError: (scanError) => set({ scanError }),

  reset: () => set(initialState),
}));

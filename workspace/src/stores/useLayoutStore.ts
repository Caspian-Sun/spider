/**
 * @description 布局 / 面板 / Toast 全局状态存储
 * @module stores/useLayoutStore
 * @dependencies zustand, @/types/ipc, @/ipc/contract
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T015
 * @rules
 *   - Layout Toggle 选择持久化到 Rust 端 app_state.json (键 layout), 不写入 localStorage
 *   - 所有面板改动都写入 Rust 端 app_state.json (键 tweaks.<field>), 下次启动保留; 不写 localStorage
 */

import { create } from 'zustand';
import type { AppPersistentState } from '@/types/ipc';

type AppTweaks = AppPersistentState['tweaks'];

// ── Layout Store ─────────────────────────────────────────────────────────────

export type LayoutMode = 'workflow' | 'generic';

interface LayoutState {
  layout: LayoutMode;
  tweaks: AppTweaks;
}

interface LayoutActions {
  setLayout: (layout: LayoutMode) => void;
  setTweaks: (tweaks: Partial<AppTweaks>) => void;
}

const defaultTweaks: AppTweaks = {
  density: 'compact',
  showHelperLanes: true,
  showDescriptions: true,
  columnWidth: 'standard',
  theme: 'dark',
  accent: 'green',
};

export const useLayoutStore = create<LayoutState & LayoutActions>((set) => ({
  layout: 'workflow',
  tweaks: defaultTweaks,

  setLayout: (layout) => set({ layout }),

  setTweaks: (partial) =>
    set((state) => ({ tweaks: { ...state.tweaks, ...partial } })),
}));

// ── Drawer Store ─────────────────────────────────────────────────────────────

export type DrawerKind = 'rules' | 'docs' | 'prd' | null;

interface DrawerState {
  open: DrawerKind;
  drawerPayload: string | null;
}

interface DrawerActions {
  openDrawer: (kind: DrawerKind, payload?: string | null) => void;
  closeDrawer: () => void;
}

export const useDrawerStore = create<DrawerState & DrawerActions>((set) => ({
  open: null,
  drawerPayload: null,

  openDrawer: (kind, payload) => set({ open: kind, drawerPayload: payload ?? null }),
  closeDrawer: () => set({ open: null, drawerPayload: null }),
}));

// ── Toast Store ──────────────────────────────────────────────────────────────

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
}

interface ToastActions {
  addToast: (message: string, kind?: ToastKind) => void;
  removeToast: (id: string) => void;
}

let _toastSeq = 0;

export const useToastStore = create<ToastState & ToastActions>((set) => ({
  toasts: [],

  addToast: (message, kind = 'info') => {
    const id = `toast-${++_toastSeq}`;
    set((state) => ({ toasts: [...state.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

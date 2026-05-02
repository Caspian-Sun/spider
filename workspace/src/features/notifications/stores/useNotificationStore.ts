/**
 * @description 管理全局通知列表（ok/err/warn/info 类型）和未读计数
 * @module features/notifications/stores
 * @dependencies zustand
 * @prd docs/prds/claude-workflow-kanban.md#通知抽屉
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T004
 * @rules
 *   - 通知类型：ok=绿色圆点 / err=红色圆点 / warn=琥珀色圆点 / info=灰色圆点
 *   - 顶部有「Mark all as read」按钮，点击清空所有未读标记，铃铛徽章归零
 *   - 无通知时显示空状态「No notifications」
 *   - 点击通知项跳转到对应泳道并高亮相关卡片
 */

import { create } from 'zustand';

export type NotificationType = 'ok' | 'err' | 'warn' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  meta: string;
  read: boolean;
  /** 关联泳道 id，点击时跳转 */
  laneId?: string;
}

interface NotificationState {
  notifications: Notification[];
  isDrawerOpen: boolean;
}

interface NotificationActions {
  addNotification: (n: Omit<Notification, 'id' | 'read'>) => void;
  markAllRead: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

let _seq = 0;

export const useNotificationStore = create<NotificationState & NotificationActions>((set) => ({
  notifications: [],
  isDrawerOpen: false,

  addNotification: (n) =>
    set((s) => ({
      notifications: [
        { ...n, id: `notif-${++_seq}`, read: false },
        ...s.notifications,
      ],
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  openDrawer:   () => set({ isDrawerOpen: true }),
  closeDrawer:  () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set((s) => ({ isDrawerOpen: !s.isDrawerOpen })),
}));

/** 派生选择器：未读计数 */
export function selectUnreadCount(s: NotificationState): number {
  return s.notifications.filter((n) => !n.read).length;
}

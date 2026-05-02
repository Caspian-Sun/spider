/**
 * @description 通知抽屉：类型圆点 + 未读高亮 + Mark all as read + 空状态 + 点击跳转泳道
 * @module features/notifications/components/NotificationDrawer
 * @dependencies useNotificationStore, useKanbanStore
 * @prd docs/prds/claude-workflow-kanban.md#通知抽屉
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T007
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.notif-drawer .notif-item .notif-dot)
 * @rules
 *   - 通知抽屉由 TopBar 铃铛按钮触发，position: fixed; top: 50px; right: 12px; width: 360px，最大高度 calc(100vh - 80px)
 *   - 通知类型：ok=绿色圆点 / err=红色圆点 / warn=琥珀色圆点 / info=灰色圆点
 *   - 未读通知背景 rgba(110,231,127,0.04)，已读无特殊背景
 *   - 每条通知：类型圆点 + 标题（11.5px）+ meta 信息（时间/来源，10.5px 灰色）
 *   - 顶部有「Mark all as read」按钮，点击清空所有未读标记，铃铛徽章归零
 *   - 无通知时显示空状态「No notifications」
 *   - 点击通知项跳转到对应泳道并高亮相关卡片
 *   - 点击抽屉外侧区域关闭抽屉
 */

import styles from './NotificationDrawer.module.css';
import { useNotificationStore } from '../stores/useNotificationStore';
import { useKanbanStore } from '@/stores/useKanbanStore';
import type { NotificationType } from '../stores/useNotificationStore';

const DOT_CLASS: Record<NotificationType, string> = {
  ok:   styles.ok,
  err:  styles.err,
  warn: styles.warn,
  info: styles.info,
};

export function NotificationDrawer() {
  const { notifications, isDrawerOpen, markAllRead, closeDrawer } = useNotificationStore();
  const { selectLane } = useKanbanStore();

  if (!isDrawerOpen) return null;

  function handleItemClick(laneId?: string) {
    if (laneId) selectLane(laneId);
    closeDrawer();
  }

  return (
    <>
      {/* veil captures outside clicks */}
      <div className={styles.veil} onClick={closeDrawer} />

      <div className={styles.drawer} role="dialog" aria-label="通知">
        <div className={styles.header}>
          <span className={styles.title}>Notifications</span>
          <button className={styles.markAllBtn} onClick={markAllRead}>
            Mark all as read
          </button>
        </div>

        <div className={styles.list}>
          {notifications.length === 0 ? (
            <div className={styles.empty}>No notifications</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`${styles.item} ${!n.read ? styles.unread : ''}`}
                onClick={() => handleItemClick(n.laneId)}
              >
                <span className={`${styles.dot} ${DOT_CLASS[n.type]}`} />
                <div className={styles.content}>
                  <div className={styles.itemTitle}>{n.title}</div>
                  <div className={styles.itemMeta}>{n.meta}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

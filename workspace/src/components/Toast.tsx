/**
 * @description Toast 通知组件，从 useToastStore 读取队列，auto-dismiss 3s
 * @module components/Toast
 * @dependencies useToastStore
 * @prd docs/prds/claude-workflow-kanban.md#文件系统集成
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T055
 * @rules
 *   - Watcher 启动失败时, 顶栏显示红色徽章「Watch offline」
 *   - 前端连续 IPC 失败 > 3 次弹系统级 banner「Backend unresponsive, restart suggested」
 */

import { useToastStore, type ToastKind } from '@/stores/useLayoutStore';
import styles from './Toast.module.css';

const KIND_CLASS: Record<ToastKind, string> = {
  info:    styles.info,
  success: styles.success,
  warning: styles.warning,
  error:   styles.error,
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${styles.toast} ${KIND_CLASS[toast.kind]}`}
          role="alert"
        >
          <span className={styles.message}>{toast.message}</span>
          <button className={styles.dismiss} onClick={() => removeToast(toast.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

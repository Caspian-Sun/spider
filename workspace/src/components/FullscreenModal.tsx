/**
 * @description 通用全屏模态 (focus-veil + focus-box)
 * @module components/FullscreenModal
 * @prd docs/prds/claude-workflow-kanban.md#终端卡片
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T042
 * @rules
 *   - Fullscreen 弹系统模态 (focus-veil + focus-box), 900×620 或 90vw/85vh 取小, 同一 PTY 实例不重开
 *   - 模态内 Esc 或点遮罩关闭; 关闭后卡片回到原位置, PTY 不断
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import styles from './FullscreenModal.module.css';

export interface FullscreenModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function FullscreenModal({ open, onClose, children, title }: FullscreenModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.veil} onClick={onClose}>
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className={styles.header}>
            <span className={styles.title}>{title}</span>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

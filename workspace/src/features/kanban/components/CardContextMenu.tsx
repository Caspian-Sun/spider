/**
 * @description 右键上下文菜单：Run/Pause/Restart/Duplicate/Move to/Delete，Delete danger 样式 + 二次确认
 * @module features/kanban/components/CardContextMenu
 * @dependencies useKanbanStore, useWorkspaceStore
 * @prd docs/prds/claude-workflow-kanban.md#右键菜单
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T010
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.ctx .ctx-item .ctx-sep)
 * @rules
 *   - 右键点击 Agent 卡片弹出上下文菜单，定位在鼠标位置，超出视口时自动翻转方向
 *   - 菜单项顺序：Run / Pause / Restart / 分割线 / Duplicate / Move to…（子菜单列出其他泳道）/ 分割线 / Delete
 *   - Delete 为 danger 样式，hover 时文字变 var(--red)
 *   - Delete 点击弹二次确认；确认后销毁卡片及其 PTY 会话
 *   - 卡片处于 run 状态时，Run 禁用；idle 状态时，Pause / Restart 禁用
 *   - 点击菜单外侧或 Esc 关闭菜单，不执行任何操作
 */

import { useEffect, useRef } from 'react';
import { useKanbanStore } from '@/stores/useKanbanStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { AgentCardState } from '@/types/ipc';
import styles from './CardContextMenu.module.css';

export interface CardContextMenuProps {
  card: AgentCardState;
  x: number;
  y: number;
  onClose: () => void;
}

export function CardContextMenu({ card, x, y, onClose }: CardContextMenuProps) {
  const { removeCard, rebindCard } = useKanbanStore();
  const { workspace } = useWorkspaceStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const isRunning = card.status === 'run';
  const isIdle    = card.status === 'idle';

  // Flip if near viewport edge
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const MENU_W = 160;
  const MENU_H = 200;
  const left = x + MENU_W > vpW ? x - MENU_W : x;
  const top  = y + MENU_H > vpH ? y - MENU_H : y;

  // Close on Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleDelete() {
    const ok = window.confirm(`确认删除卡片「${card.title}」及其 PTY 会话？`);
    if (ok) {
      removeCard(card.id);
      onClose();
    }
  }

  const otherLanes = (workspace?.commands ?? []).filter((c) => c.id !== card.laneId);

  return (
    <>
      <div className={styles.veil} onClick={onClose} />
      <div
        ref={menuRef}
        className={styles.menu}
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.item} disabled={isRunning}>Run</button>
        <button className={styles.item} disabled={isIdle}>Pause</button>
        <button className={styles.item} disabled={isIdle}>Restart</button>

        <div className={styles.sep} />

        <button className={styles.item}>Duplicate</button>

        {otherLanes.length > 0 && (
          <>
            {otherLanes.map((lane) => (
              <button
                key={lane.id}
                className={styles.item}
                onClick={() => { rebindCard(card.id, lane.id); onClose(); }}
              >
                Move to /{lane.cmd}
              </button>
            ))}
          </>
        )}

        <div className={styles.sep} />

        <button className={`${styles.item} ${styles.danger}`} onClick={handleDelete}>
          Delete
        </button>
      </div>
    </>
  );
}

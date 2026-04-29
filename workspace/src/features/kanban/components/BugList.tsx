/**
 * @description /fix 泳道专用 Bug 报告列表
 * @module features/kanban/components
 * @dependencies useKanbanStore, ipc/fs
 * @prd docs/prds/claude-workflow-kanban.md#任务与-Bug-管理
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T046
 * @rules
 *   - BugReport 全部汇集到 /fix 泳道, 按 priority 降序 (P0 > P1 > P2), 同 priority 按 createdAt 降序
 *   - BugReport 的 status 切换同样调 update_frontmatter(path, { status })
 *   - BugReport 左侧显示 reporter 头像占位 (姓名首字母 + 随机背景色, 悬停 tooltip 显示全名)
 */

import { useState } from 'react';
import type { BugReport, BugPriority, BugStatus } from '@/types/ipc';
import styles from './BugList.module.css';

export interface BugListProps {
  bugReports: BugReport[];
  onStatusChange: (path: string, status: BugStatus) => void;
  onDelete: (path: string) => void;
}

const PRIORITY_ORDER: Record<BugPriority, number> = { P0: 0, P1: 1, P2: 2 };

const AVATAR_COLORS = [
  'var(--green)', 'var(--teal)', 'var(--blue)', 'var(--purple)',
  'var(--amber)', 'var(--red)',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const STATUS_CYCLE: BugStatus[] = ['triage', 'reproducing', 'fixing', 'fixed'];

function nextStatus(s: BugStatus): BugStatus {
  const idx = STATUS_CYCLE.indexOf(s);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

export function BugList({ bugReports, onStatusChange, onDelete }: BugListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sorted = [...bugReports].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    return b.createdAt.localeCompare(a.createdAt);
  });

  if (sorted.length === 0) {
    return <div className={styles.empty}>No bug reports</div>;
  }

  return (
    <div className={styles.list}>
      {sorted.map(bug => (
        <div
          key={bug.id}
          className={styles.row}
          onContextMenu={e => { e.preventDefault(); setConfirmDelete(bug.filePath); }}
        >
          <div
            className={styles.avatar}
            style={{ background: avatarColor(bug.reporter) }}
            title={bug.reporter}
          >
            {bug.reporter.charAt(0).toUpperCase()}
          </div>

          <span className={`${styles.priority} ${styles[`p${bug.priority.toLowerCase()}`]}`}>
            {bug.priority}
          </span>

          <span className={styles.title}>{bug.title}</span>

          <button
            className={`${styles.statusBadge} ${styles[bug.status]}`}
            onClick={() => onStatusChange(bug.filePath, nextStatus(bug.status))}
            title="Click to advance status"
          >
            {bug.status}
          </button>

          {confirmDelete === bug.filePath && (
            <div className={styles.confirmOverlay} onClick={e => e.stopPropagation()}>
              <span>Delete?</span>
              <button className={styles.confirmYes} onClick={() => { onDelete(bug.filePath); setConfirmDelete(null); }}>Yes</button>
              <button className={styles.confirmNo} onClick={() => setConfirmDelete(null)}>No</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

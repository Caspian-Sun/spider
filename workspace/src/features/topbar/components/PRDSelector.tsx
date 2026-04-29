/**
 * @description PRD 选择器下拉，显示当前激活 PRD + 状态切换
 * @module features/topbar/components/PRDSelector
 * @dependencies useWorkspaceStore, @tauri-apps/api/core, IPC
 * @prd docs/prds/claude-workflow-kanban.md#顶部操作栏
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T017
 * @rules
 *   - PRDSelector 展示当前激活 PRD 的 id + status badge + tbdCount (若 > 0 显示 amber 小气泡)
 *   - PRDSelector 下拉列出所有 PRD, 每条可直接点 status badge 切换状态 (draft / active / archived)
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { IPC } from '@/ipc/contract';
import type { PRD } from '@/types/ipc';
import styles from './PRDSelector.module.css';

const STATUS_LABEL: Record<string, string> = {
  draft: 'draft',
  active: 'active',
  archived: 'archived',
};

const STATUS_NEXT: Record<string, string> = {
  draft: 'active',
  active: 'archived',
  archived: 'draft',
};

export function PRDSelector() {
  const { workspace, activePrdId, setActivePrd } = useWorkspaceStore();
  const [open, setOpen] = useState(false);

  const prds = workspace?.prds ?? [];
  const active = prds.find((p) => p.id === activePrdId) ?? prds[0] ?? null;

  if (!active) return null;

  async function cycleStatus(prd: PRD, e: React.MouseEvent) {
    e.stopPropagation();
    const next = STATUS_NEXT[prd.status] ?? 'draft';
    try {
      await invoke(IPC.Cmd.UPDATE_FRONTMATTER, {
        filePath: prd.filePath,
        key: 'status',
        value: next,
      });
    } catch {
      // non-blocking — watcher will refresh
    }
  }

  return (
    <div className={styles.wrapper}>
      <button className={styles.trigger} onClick={() => setOpen((v) => !v)}>
        <span className={styles.prdId}>{active.id}</span>
        <span className={`${styles.badge} ${styles[active.status]}`}>
          {STATUS_LABEL[active.status]}
        </span>
        {active.tbdCount > 0 && (
          <span className={styles.tbdBubble}>{active.tbdCount}</span>
        )}
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          {prds.map((prd) => (
            <div
              key={prd.id}
              className={`${styles.item} ${prd.id === activePrdId ? styles.itemActive : ''}`}
              onClick={() => { setActivePrd(prd.id); setOpen(false); }}
            >
              <span className={styles.itemId}>{prd.id}</span>
              <button
                className={`${styles.badge} ${styles[prd.status]}`}
                onClick={(e) => cycleStatus(prd, e)}
                title="点击切换状态"
              >
                {STATUS_LABEL[prd.status]}
              </button>
              {prd.tbdCount > 0 && (
                <span className={styles.tbdBubble}>{prd.tbdCount}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

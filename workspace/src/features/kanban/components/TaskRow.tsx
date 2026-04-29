/**
 * @description 单条任务行：id + title + status badge + rules chips
 * @module features/kanban/components/TaskRow
 * @dependencies useWorkspaceStore, @tauri-apps/api/core, IPC
 * @prd docs/prds/claude-workflow-kanban.md#任务管理
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T023
 * @rules
 *   - Task 按 lane 字段归到对应泳道 tasks 分区顶部, 按 id 字典序升序
 *   - 点 status-badge 弹枚举下拉, 选完调 update_task_status(manifestPath, taskId, status), 写回对应 docs/tasks/*.json
 *   - 写 JSON 时必须保持原文件 key 顺序和数组顺序, 只改动目标 task 对象的 status 字段
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { IPC } from '@/ipc/contract';
import type { Task } from '@/types/ipc';
import styles from './TaskRow.module.css';

const STATUS_OPTIONS = ['pending', 'in-progress', 'done', 'blocked'] as const;
type TaskStatus = typeof STATUS_OPTIONS[number];

const STATUS_COLOR: Record<TaskStatus, string> = {
  'pending':     'var(--text-3)',
  'in-progress': 'var(--green)',
  'done':        'var(--teal)',
  'blocked':     'var(--red)',
};

export interface TaskRowProps {
  task: Task;
  manifestPath: string;
}

export function TaskRow({ task, manifestPath }: TaskRowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<TaskStatus>(task.status as TaskStatus);

  async function handleStatusChange(status: TaskStatus) {
    setDropdownOpen(false);
    setCurrentStatus(status);
    try {
      await invoke(IPC.Cmd.UPDATE_TASK_STATUS, {
        manifestPath,
        taskId: task.id,
        status,
      });
    } catch {
      // revert on failure
      setCurrentStatus(task.status as TaskStatus);
    }
  }

  return (
    <div className={styles.row}>
      <span className={styles.id}>{task.id}</span>
      <span className={styles.title}>{task.title}</span>

      <div className={styles.statusWrap}>
        <button
          className={styles.statusBadge}
          style={{ borderColor: STATUS_COLOR[currentStatus], color: STATUS_COLOR[currentStatus] }}
          onClick={() => setDropdownOpen((v) => !v)}
        >
          {currentStatus}
        </button>
        {dropdownOpen && (
          <div className={styles.dropdown}>
            {STATUS_OPTIONS.map((s) => (
              <div
                key={s}
                className={styles.dropItem}
                style={{ color: STATUS_COLOR[s] }}
                onClick={() => handleStatusChange(s)}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {task.rules.slice(0, 2).map((r, i) => (
        <span key={i} className={styles.ruleChip} title={r}>
          R{i + 1}
        </span>
      ))}
    </div>
  );
}

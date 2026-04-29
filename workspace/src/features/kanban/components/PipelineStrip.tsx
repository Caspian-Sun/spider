/**
 * @description 管道进度条，展示主命令 step 列表 + gate 菱形
 * @module features/kanban/components/PipelineStrip
 * @dependencies useWorkspaceStore, useKanbanStore
 * @prd docs/prds/claude-workflow-kanban.md#看板与泳道
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T019
 * @rules
 *   - PipelineStrip 固定高度 38px, 位于顶栏下方, 跨屏吸顶
 *   - 每个主命令 (helper: false 且有 idx) 渲染为一个 step, 按 idx 升序
 */

import styles from './PipelineStrip.module.css';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useKanbanStore } from '@/stores/useKanbanStore';
export function PipelineStrip() {
  const { workspace } = useWorkspaceStore();
  const { cards } = useKanbanStore();

  if (!workspace) return null;

  const steps = workspace.commands
    .filter((c) => !c.helper && c.idx != null)
    .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));

  function isDone(cmd: string) {
    return cards.some((c) => c.commandId === cmd && c.status === 'ok');
  }

  return (
    <div className={styles.strip}>
      {steps.map((cmd, i) => {
        const done = isDone(cmd.id);
        return (
          <div key={cmd.id} className={styles.stepGroup}>
            {i > 0 && (
              <div className={`${styles.connector} ${done ? styles.connectorDone : ''}`} />
            )}
            {cmd.gate && <span className={styles.gate}>◇</span>}
            <div className={`${styles.step} ${done ? styles.stepDone : ''}`}>
              <span className={styles.idx}>{cmd.idx}</span>
              <span className={styles.name}>/{cmd.cmd}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

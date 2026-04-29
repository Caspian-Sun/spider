/**
 * @description 就绪后的完整 Kanban 页面：TopBar + PipelineStrip + Board/GenericBoard + TweaksPanel
 * @module pages/KanbanShell
 * @dependencies TopBar, PipelineStrip, Board, TweaksPanel, useLayoutStore
 * @prd docs/prds/claude-workflow-kanban.md#看板与泳道
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T026
 * @rules
 *   - Layout 切换为 generic 时, PipelineStrip 隐藏
 *   - Layout Toggle 切换时, 顶栏 / RetroTimeline / 抽屉保持挂载不重渲
 */

import styles from './KanbanShell.module.css';
import { TopBar } from '@/features/topbar/components/TopBar';
import { PipelineStrip } from '@/features/kanban/components/PipelineStrip';
import { Board } from '@/features/kanban/components/Board';
import { TweaksPanel } from '@/features/tweaks/components/TweaksPanel';
import { useLayoutStore } from '@/stores/useLayoutStore';

export function KanbanShell() {
  const { layout } = useLayoutStore();
  const isWorkflow = layout === 'workflow';

  return (
    <div className={styles.shell}>
      <TopBar />
      {isWorkflow && <PipelineStrip />}
      {/* Board area — always mounted, swaps content */}
      {isWorkflow ? (
        <Board showPipeline />
      ) : (
        <div className={styles.genericPlaceholder}>通用看板 (T039)</div>
      )}
      {/* TweaksPanel and drawers always mounted */}
      <TweaksPanel />
    </div>
  );
}

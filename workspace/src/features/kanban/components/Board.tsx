/**
 * @description 工作流看板主体：横向滚动的泳道 + 连接箭头，position:absolute 布局适配各面板
 * @module features/kanban/components/Board
 * @dependencies Lane, Connector, useWorkspaceStore, useShellStore, constants
 * @prd docs/prds/claude-workflow-kanban.md#看板主区域
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T014
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.board .board-inner)
 * @rules
 *   - Board 使用 position: absolute; inset: 84px 0 28px 48px（top = TopBar 46px + Pipeline 38px = 84px；bottom = RetroTimeline 28px；left = Activity Bar 48px）
 *   - 横向滚动（overflow-x: auto），纵向不滚动（overflow-y: hidden）
 *   - 背景叠加两个径向渐变：左上角绿色光晕（radial-gradient(1400px 500px at 10% 0%, rgba(110,231,127,0.04), transparent 60%)）+ 右下角蓝色光晕（radial-gradient(1200px 500px at 90% 100%, rgba(122,162,255,0.04), transparent 60%)）
 *   - Shell Panel 打开时，bottom 从 28px 切换为 268px（Shell 240px + RetroTimeline 28px），过渡动画 transition: bottom 200ms ease
 *   - 横向滚动条高度 10px，拇指色 var(--line)，hover 时 var(--line-2)
 *   - 内部 .board-inner 为 flex row，高度 100%，align-items: stretch，min-width: max-content
 */

import styles from './Board.module.css';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useShellStore } from '@/features/shell/stores/useShellStore';
import { TOPBAR_HEIGHT, PIPELINE_HEIGHT, RETRO_HEIGHT, SHELL_HEIGHT } from '@/features/kanban/constants';
import { Lane } from './Lane';
import { Connector } from './Connector';

const ACTIVITY_BAR_WIDTH = 48;

interface BoardProps {
  showPipeline?: boolean;
  cwd?: string;
}

export function Board({ showPipeline = true, cwd = '.' }: BoardProps) {
  const { workspace } = useWorkspaceStore();
  const { isOpen: shellOpen } = useShellStore();

  if (!workspace) return null;

  const commands = workspace.commands;
  const top    = TOPBAR_HEIGHT + (showPipeline ? PIPELINE_HEIGHT : 0);
  const bottom = RETRO_HEIGHT + (shellOpen ? SHELL_HEIGHT : 0);

  return (
    <div
      className={styles.board}
      style={{
        top,
        bottom,
        left: ACTIVITY_BAR_WIDTH,
      }}
    >
      <div className={styles.inner}>
        {commands.map((cmd, i) => (
          <div key={cmd.id} className={styles.laneGroup}>
            {i > 0 && (
              <Connector
                gate={cmd.gate}
                label={cmd.inputs[0]}
                height={200}
              />
            )}
            <Lane command={cmd} cwd={cwd} />
          </div>
        ))}
      </div>
    </div>
  );
}

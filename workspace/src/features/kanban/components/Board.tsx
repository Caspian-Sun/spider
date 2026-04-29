/**
 * @description 工作流看板主体：横向滚动的泳道 + 连接箭头
 * @module features/kanban/components/Board
 * @dependencies Lane, Connector, useWorkspaceStore, constants
 * @prd docs/prds/claude-workflow-kanban.md#看板与泳道
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T024
 * @rules
 *   - Board 区域横向滚动, 纵向固定高度 100vh - 84px - 28px
 *   - 水平滚动条使用暗色主题样式 (高 10px, 轨道透明, thumb --line 色)
 */

import styles from './Board.module.css';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { BOARD_HEIGHT_OFFSET, PIPELINE_HEIGHT } from '@/features/kanban/constants';
import { Lane } from './Lane';
import { Connector } from './Connector';

interface BoardProps {
  showPipeline?: boolean;
}

export function Board({ showPipeline = true }: BoardProps) {
  const { workspace } = useWorkspaceStore();

  if (!workspace) return null;

  const commands = workspace.commands;
  const boardHeight = `calc(100vh - ${BOARD_HEIGHT_OFFSET + (showPipeline ? PIPELINE_HEIGHT : 0)}px)`;

  return (
    <div className={styles.board} style={{ height: boardHeight }}>
      {commands.map((cmd, i) => (
        <div key={cmd.id} className={styles.laneGroup}>
          {i > 0 && (
            <Connector
              gate={cmd.gate}
              label={cmd.inputs[0]}
              height={200}
            />
          )}
          <Lane command={cmd} />
        </div>
      ))}
    </div>
  );
}

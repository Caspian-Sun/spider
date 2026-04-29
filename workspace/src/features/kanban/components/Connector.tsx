/**
 * @description 泳道间 SVG 连接箭头 (52px 宽)
 * @module features/kanban/components/Connector
 * @prd docs/prds/claude-workflow-kanban.md#看板与泳道
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T021
 * @rules
 *   - 泳道之间 connector 占 52px, SVG 箭头从上一泳道右侧中段指向下一泳道左侧中段
 *   - connector 中央浮动 arrow-label 显示下游命令 inputs 数组首个 artifact (无 inputs 则省略)
 */

import styles from './Connector.module.css';
import { CONNECTOR_WIDTH } from '@/features/kanban/constants';

export interface ConnectorProps {
  gate?: string | null;
  label?: string;
  height?: number;
}

export function Connector({ gate, label, height = 200 }: ConnectorProps) {
  const isGate = !!gate;
  const midY = height / 2;

  return (
    <div className={styles.wrapper} style={{ width: CONNECTOR_WIDTH, height }}>
      <svg
        width={CONNECTOR_WIDTH}
        height={height}
        viewBox={`0 0 ${CONNECTOR_WIDTH} ${height}`}
        fill="none"
        className={styles.svg}
      >
        {/* horizontal line from left to right at midY */}
        <line
          x1={0} y1={midY} x2={CONNECTOR_WIDTH} y2={midY}
          stroke={isGate ? 'var(--amber)' : 'var(--line-2)'}
          strokeWidth={1.5}
        />
        {/* arrowhead */}
        <polygon
          points={`${CONNECTOR_WIDTH - 6},${midY - 4} ${CONNECTOR_WIDTH},${midY} ${CONNECTOR_WIDTH - 6},${midY + 4}`}
          fill={isGate ? 'var(--amber)' : 'var(--line-2)'}
        />
        {/* gate diamond */}
        {isGate && (
          <polygon
            points={`${CONNECTOR_WIDTH / 2 - 6},${midY} ${CONNECTOR_WIDTH / 2},${midY - 6} ${CONNECTOR_WIDTH / 2 + 6},${midY} ${CONNECTOR_WIDTH / 2},${midY + 6}`}
            fill="var(--amber)"
            opacity={0.3}
            stroke="var(--amber)"
            strokeWidth={1}
          />
        )}
      </svg>

      {label && (
        <div className={styles.label} style={{ top: midY - 9 }}>
          {label}
        </div>
      )}
    </div>
  );
}

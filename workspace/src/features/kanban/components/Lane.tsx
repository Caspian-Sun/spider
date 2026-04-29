/**
 * @description 单条泳道，含 lane-head + lane-body 分区
 * @module features/kanban/components/Lane
 * @dependencies AgentCard, useKanbanStore, constants
 * @prd docs/prds/claude-workflow-kanban.md#看板与泳道
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T020
 * @rules
 *   - 主泳道宽度 360px, helper 泳道宽度 320px 且边框改虚线
 *   - lane-head 分两行: 第一行 idx 徽章 + 斜杠命令名 + count chip + gate-badge; 第二行 desc + artifact tags
 */

import styles from './Lane.module.css';
import { useKanbanStore } from '@/stores/useKanbanStore';
import { LANE_WIDTH, HELPER_LANE_WIDTH } from '@/features/kanban/constants';
import type { Command } from '@/types/ipc';
import { AgentCard } from './AgentCard';

export interface LaneProps {
  command: Command;
}

export function Lane({ command }: LaneProps) {
  const { cards } = useKanbanStore();
  const isHelper = command.helper;
  const laneCards = cards.filter((c) => c.laneId === command.id);
  const width = isHelper ? HELPER_LANE_WIDTH : LANE_WIDTH;

  return (
    <div
      className={`${styles.lane} ${isHelper ? styles.helper : ''}`}
      style={{ width }}
    >
      <div className={styles.head}>
        <div className={styles.headRow1}>
          {command.idx != null && (
            <span className={styles.idx}>{command.idx}</span>
          )}
          <span className={styles.cmd}>/{command.cmd}</span>
          <span className={styles.count}>{laneCards.length}</span>
          {command.gate && <span className={styles.gate}>◇ {command.gate}</span>}
        </div>
        {(command.desc || command.outputs.length > 0) && (
          <div className={styles.headRow2}>
            {command.desc && <span className={styles.desc}>{command.desc}</span>}
            {command.outputs.map((o) => (
              <span key={o} className={styles.artifact}>{o}</span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.body}>
        {laneCards.length === 0 ? (
          <div className={styles.empty}>空泳道</div>
        ) : (
          laneCards.map((card) => (
            <AgentCard key={card.id} card={card} />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * @description 单条泳道，含 lane-head / lane-body 分区标签 / lane-foot，支持拖拽放置
 * @module features/kanban/components/Lane
 * @dependencies AgentCard, useKanbanStore, constants
 * @prd docs/prds/claude-workflow-kanban.md#泳道
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T013
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.lane .lane-head .lane-body .lane-foot .lane-section-label .artifact-tag)
 * @rules
 *   - 标准泳道 flex-basis 360px，Helper 泳道 flex-basis 320px（虚线边框 border-style: dashed）
 *   - 泳道头部（.lane-head）背景 var(--bg-2)，底部边框分隔，包含两行：第一行：步骤编号方块（22×22px）+ 命令名（/ 号绿色，13px 加粗）+ 卡片计数气泡 + 弹性空白 + GATE 徽章（有门禁时显示，琥珀色）；第二行：描述文字（11px，var(--text-3)）+ 产出物标签（in=蓝色；out=绿色）
 *   - 产出物标签（.artifact-tag）：mono 9.5px，圆角 10px；in 类型蓝色边框蓝色文字；out 类型绿色边框绿色文字
 *   - 泳道主体（.lane-body）纵向滚动，padding 12px，gap 10px
 *   - 分区标签（.lane-section-label）：UPPER_CASE，前有 4×4px 圆点，颜色：MAIN=绿、SUB-AGENTS=紫、SKILLS=青、LOGS=琥珀
 *   - 泳道主体为拖拽放置目标，drag-over 时显示绿色内阴影：box-shadow: inset 0 0 0 1px rgba(110,231,127,0.25)
 *   - 泳道底部（.lane-foot）有「+ add sub-agent」虚线按钮，hover 时文字变绿、边框绿色
 *   - 泳道无卡片时，主体显示「空泳道」提示文字，居中，var(--text-3)
 */

import { useState } from 'react';
import styles from './Lane.module.css';
import { useKanbanStore } from '@/stores/useKanbanStore';
import { LANE_WIDTH, HELPER_LANE_WIDTH } from '@/features/kanban/constants';
import type { Command } from '@/types/ipc';
import type { AgentCardState } from '@/types/ipc';
import { AgentCard } from './AgentCard';

export interface LaneProps {
  command: Command;
  cwd?: string;
}

type SectionKey = 'MAIN' | 'SUB-AGENTS' | 'SKILLS' | 'LOGS';

const SECTION_KINDS: Record<SectionKey, string> = {
  'MAIN':       'main',
  'SUB-AGENTS': 'sub',
  'SKILLS':     'skill',
  'LOGS':       'hook',
};

function groupBySection(cards: AgentCardState[]): [SectionKey, AgentCardState[]][] {
  const groups: [SectionKey, AgentCardState[]][] = [];
  for (const [label, kind] of Object.entries(SECTION_KINDS) as [SectionKey, string][]) {
    const group = cards.filter((c) => c.kind === kind);
    if (group.length > 0) groups.push([label, group]);
  }
  return groups;
}

export function Lane({ command, cwd = '.' }: LaneProps) {
  const { cards, rebindCard } = useKanbanStore();
  const [dragOver, setDragOver] = useState(false);

  const isHelper = command.helper;
  const laneCards = cards.filter((c) => c.laneId === command.id);
  const width = isHelper ? HELPER_LANE_WIDTH : LANE_WIDTH;
  const sections = groupBySection(laneCards);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const cardId = e.dataTransfer.getData('cardId');
    if (cardId) rebindCard(cardId, command.id);
  }

  return (
    <div
      className={`${styles.lane} ${isHelper ? styles.helper : ''}`}
      style={{ width }}
      data-lane-id={command.id}
    >
      {/* ── lane head ───────────────────────────────────────────── */}
      <div className={styles.head}>
        <div className={styles.headRow1}>
          {command.idx != null && (
            <span className={styles.idx}>{command.idx}</span>
          )}
          <span className={styles.cmd}>
            <span className={styles.slash}>/</span>{command.cmd}
          </span>
          <span className={styles.count}>{laneCards.length}</span>
          <span className={styles.headSpacer} />
          {command.gate && (
            <span className={styles.gate}>◇ {command.gate}</span>
          )}
        </div>

        {(command.desc || command.inputs.length > 0 || command.outputs.length > 0) && (
          <div className={styles.headRow2}>
            {command.desc && <span className={styles.desc}>{command.desc}</span>}
            {command.inputs.map((tag) => (
              <span key={`in:${tag}`} className={`${styles.artifactTag} ${styles.artifactIn}`}>{tag}</span>
            ))}
            {command.outputs.map((tag) => (
              <span key={`out:${tag}`} className={`${styles.artifactTag} ${styles.artifactOut}`}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── lane body ───────────────────────────────────────────── */}
      <div
        className={`${styles.body} ${dragOver ? styles.dragOver : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {laneCards.length === 0 ? (
          <div className={styles.empty}>空泳道</div>
        ) : sections.length > 0 ? (
          sections.map(([label, group]) => (
            <div key={label} className={styles.section}>
              <div className={`${styles.sectionLabel} ${styles[`section${label.replace('-', '')}`]}`}>
                <span className={styles.sectionDot} />
                {label}
              </div>
              {group.map((card) => (
                <AgentCard key={card.id} card={card} cwd={cwd} />
              ))}
            </div>
          ))
        ) : (
          laneCards.map((card) => (
            <AgentCard key={card.id} card={card} cwd={cwd} />
          ))
        )}
      </div>

      {/* ── lane foot ───────────────────────────────────────────── */}
      <div className={styles.foot}>
        <button className={styles.addBtn}>+ add sub-agent</button>
      </div>
    </div>
  );
}

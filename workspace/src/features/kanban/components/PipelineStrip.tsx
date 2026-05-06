/**
 * @description 流水线步骤条：展示主命令步骤 + GATE 标记 + helpers 区，点击步骤滚动对应泳道
 * @module features/kanban/components/PipelineStrip
 * @dependencies useWorkspaceStore, useKanbanStore, useLayoutStore
 * @prd docs/prds/claude-workflow-kanban.md#流水线步骤条
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T015
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.pipeline .pipe-step .pipe-gate .pipe-helpers)
 * @rules
 *   - Pipeline Strip 固定高度 38px，位于 TopBar 正下方，padding-left 64px 与 TopBar 对齐
 *   - 步骤顺序由后端扫描时读取 .claude/workflow.json 决定，前端不二次排序，直接用 workspace.commands 过滤后的顺序
 *   - 每个步骤显示：数字编号方块（16×16px，border-radius 3px）+ 命令名，整体 border-radius 4px 的圆角按钮
 *   - 激活步骤：绿色边框（rgba(110,231,127,0.4)）+ 绿色背景（rgba(110,231,127,0.06)）+ 数字方块绿底黑字
 *   - 已完成步骤：数字方块青色底（var(--teal)）黑字加粗
 *   - 步骤间箭头（→）用 var(--line-2) 颜色显示，不可点击
 *   - prd→plan 之间、plan→code 之间各有一个 GATE 标记（琥珀色虚线边框，显示门禁命令名如「◆ PRD-CHECK」）
 *   - 步骤条右侧显示「helpers:」标签 + /fix 链接 + /meta-audit 链接（无编号方块，样式更轻）
 *   - 点击步骤将对应泳道滚动到视口内并设为 activeStep
 *   - Layout 切换为 generic（通用看板）时，Pipeline Strip 整体隐藏
 */

import { useState } from 'react';
import styles from './PipelineStrip.module.css';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useKanbanStore } from '@/stores/useKanbanStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type { Command } from '@/types/ipc';

function scrollToLane(commandId: string) {
  const el = document.querySelector(`[data-lane-id="${commandId}"]`);
  el?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
}

export function PipelineStrip() {
  const { workspace } = useWorkspaceStore();
  const { cards } = useKanbanStore();
  const { layout } = useLayoutStore();
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  if (!workspace || layout === 'generic') return null;

  // 后端已按 workflow.json 排序，前端直接过滤，不再二次排序
  const steps = workspace.commands.filter((c) => !c.helper);

  const helpers = workspace.commands.filter((c) => c.helper);

  function isActive(cmd: Command) {
    return (
      activeStepId === cmd.id ||
      cards.some((c) => c.laneId === cmd.id && c.status === 'run')
    );
  }

  function isDone(cmd: Command) {
    const lane = cards.filter((c) => c.laneId === cmd.id);
    return lane.length > 0 && lane.every((c) => c.status === 'ok');
  }

  function handleStepClick(cmd: Command) {
    setActiveStepId(cmd.id);
    scrollToLane(cmd.id);
  }

  return (
    <div className={styles.strip}>
      {steps.map((cmd, i) => (
        <div key={cmd.id} className={styles.stepGroup}>
          {i > 0 && <span className={styles.arrow}>→</span>}

          {cmd.gate && (
            <span className={styles.gateTag}>◆ {cmd.gate.toUpperCase()}</span>
          )}

          <button
            className={[
              styles.step,
              isActive(cmd) ? styles.stepActive : '',
              isDone(cmd)   ? styles.stepDone   : '',
            ].filter(Boolean).join(' ')}
            onClick={() => handleStepClick(cmd)}
          >
            <span className={styles.idxBox}>{i + 1}</span>
            <span className={styles.name}>/{cmd.cmd}</span>
          </button>
        </div>
      ))}

      {helpers.length > 0 && (
        <div className={styles.helpers}>
          <span className={styles.helpersLabel}>helpers:</span>
          {helpers.map((cmd) => (
            <button
              key={cmd.id}
              className={styles.helperBtn}
              onClick={() => scrollToLane(cmd.id)}
            >
              /{cmd.cmd}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

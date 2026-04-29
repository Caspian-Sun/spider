/**
 * @description 卡片跨泳道拖拽 hook (HTML5 DnD)
 * @module features/kanban/hooks/useCardDragDrop
 * @dependencies useKanbanStore, useToastStore
 * @prd docs/prds/claude-workflow-kanban.md#看板与泳道
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T043
 * @rules
 *   - 卡片跨泳道拖拽时: PTY 保留 (ptyId 不变), 仅修改 AgentCardState.laneId 并刷新 UI; 不动任何文件
 *   - 拖拽过程中目标泳道 lane-body 应用 .drop-active 样式 (浅绿底 + inset 边框)
 */

import { useKanbanStore } from '@/stores/useKanbanStore';
import { useToastStore } from '@/stores/useLayoutStore';

const DRAG_CARD_KEY = 'dragCardId';

export function useDragSource(cardId: string) {
  return {
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_CARD_KEY, cardId);
      e.dataTransfer.effectAllowed = 'move';
    },
  };
}

export function useDropTarget(laneId: string, hasGate?: boolean) {
  const { rebindCard } = useKanbanStore();
  const { addToast } = useToastStore();

  return {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      (e.currentTarget as HTMLElement).classList.add('drop-active');
    },
    onDragLeave: (e: React.DragEvent) => {
      (e.currentTarget as HTMLElement).classList.remove('drop-active');
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).classList.remove('drop-active');
      const cardId = e.dataTransfer.getData(DRAG_CARD_KEY);
      if (!cardId) return;
      if (hasGate) {
        addToast('此泳道有 gate 约束，请检查前置条件', 'warning');
      }
      rebindCard(cardId, laneId);
    },
  };
}

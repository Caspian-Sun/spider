/**
 * @description 卡片多选 + 框选 hook
 * @module features/kanban/hooks/useMultiSelect
 * @dependencies useKanbanStore
 * @prd docs/prds/claude-workflow-kanban.md#终端卡片
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T044
 * @rules
 *   - Shift / Cmd + 点击实现多选, 顶栏浮出批量操作条 (Kill all / Delete all)
 *   - 鼠标按住空白区拖框实现框选, 矩形内所有卡片加入选中集
 */

import { useRef, useCallback } from 'react';
import { useKanbanStore } from '@/stores/useKanbanStore';

export interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useMultiSelect(boardRef: React.RefObject<HTMLElement>) {
  const { clearSelection } = useKanbanStore();
  const rectRef = useRef<SelectionRect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onBoardMouseDown = useCallback((e: React.MouseEvent) => {
    // Only trigger on board background (not on cards)
    if ((e.target as HTMLElement).closest('[data-testid="agent-card"]')) return;
    if (e.button !== 0) return;

    clearSelection();
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    startRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, [clearSelection, boardRef]);

  const onBoardMouseUp = useCallback(() => {
    startRef.current = null;
    rectRef.current = null;
  }, []);

  return { onBoardMouseDown, onBoardMouseUp };
}

/**
 * @description 看板 AgentCardState 列表和交互状态管理
 * @module stores/useKanbanStore
 * @dependencies zustand, @/types/ipc
 * @prd docs/prds/claude-workflow-kanban.md#终端卡片
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T014
 * @rules
 *   - 卡片跨泳道拖拽时: PTY 保留 (ptyId 不变), 仅修改 AgentCardState.laneId 并刷新 UI; 不动任何文件
 */

import { create } from 'zustand';
import type { AgentCardState } from '@/types/ipc';

interface KanbanState {
  cards: AgentCardState[];
  selectedLaneId: string | null;
  selectedCardIds: Set<string>;
}

interface KanbanActions {
  addCard: (card: AgentCardState) => void;
  removeCard: (cardId: string) => void;
  updateCardStatus: (cardId: string, status: AgentCardState['status']) => void;
  updateCardPtyId: (cardId: string, ptyId: string | null) => void;
  /** Move card to a new lane; PTY session is preserved */
  rebindCard: (cardId: string, newLaneId: string) => void;
  selectLane: (laneId: string | null) => void;
  toggleSelectCard: (cardId: string) => void;
  clearSelection: () => void;
  resetCards: () => void;
}

export const useKanbanStore = create<KanbanState & KanbanActions>((set) => ({
  cards: [],
  selectedLaneId: null,
  selectedCardIds: new Set(),

  addCard: (card) =>
    set((state) => ({ cards: [...state.cards, card] })),

  removeCard: (cardId) =>
    set((state) => ({ cards: state.cards.filter((c) => c.id !== cardId) })),

  updateCardStatus: (cardId, status) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === cardId ? { ...c, status } : c)),
    })),

  updateCardPtyId: (cardId, ptyId) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === cardId ? { ...c, ptyId } : c)),
    })),

  rebindCard: (cardId, newLaneId) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === cardId ? { ...c, laneId: newLaneId } : c
      ),
    })),

  selectLane: (laneId) => set({ selectedLaneId: laneId }),

  toggleSelectCard: (cardId) =>
    set((state) => {
      const next = new Set(state.selectedCardIds);
      if (next.has(cardId)) { next.delete(cardId); } else { next.add(cardId); }
      return { selectedCardIds: next };
    }),

  clearSelection: () => set({ selectedCardIds: new Set() }),

  resetCards: () => set({ cards: [], selectedLaneId: null, selectedCardIds: new Set() }),
}));

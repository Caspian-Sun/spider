/**
 * @description 通用看板状态管理 — 增删改卡片/列，写操作 debounce 200ms 持久化
 * @module src/stores
 * @dependencies useWorkspaceStore, generic-board/ipc
 * @prd docs/prds/claude-workflow-kanban.md#通用看板视图
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T050
 * @rules
 *   - 卡片支持鼠标拖拽到任意列, 释放时 card.col 立即更新; 跨列拖拽不杀 PTY, 仅改归属
 *   - 通用看板的所有改动立即写回 .kanban-board.json
 *   - 列 title 改成空字符串时拒绝保存, inline 提示「Title cannot be empty」
 */

import { create } from 'zustand';
import type { GenericBoard, GenericCard, GenericColumn } from '@/types/ipc';
import { readGenericBoard, writeGenericBoard } from '@/features/generic-board/ipc';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

const PERSIST_DEBOUNCE_MS = 200;

interface GenericBoardState {
  board: GenericBoard | null;
  loading: boolean;

  load: (workspaceRoot: string) => Promise<void>;
  addCard: (card: GenericCard) => void;
  removeCard: (cardId: string) => void;
  moveCard: (cardId: string, colId: string) => void;
  addColumn: (column: GenericColumn) => void;
  removeColumn: (colId: string, moveToBacklog?: boolean) => void;
  renameColumn: (colId: string, title: string) => 'ok' | 'empty-title';
  updateCardSize: (cardId: string, w?: number, h?: number) => void;
  updateCardTitle: (cardId: string, title: string) => void;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(board: GenericBoard) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const root = useWorkspaceStore.getState().workspace?.rootPath;
    if (root) writeGenericBoard(root, board);
  }, PERSIST_DEBOUNCE_MS);
}

export const useGenericBoardStore = create<GenericBoardState>((set, get) => ({
  board:   null,
  loading: false,

  load: async (workspaceRoot: string) => {
    set({ loading: true });
    try {
      const board = await readGenericBoard(workspaceRoot);
      set({ board, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addCard: (card: GenericCard) => {
    const { board } = get();
    if (!board) return;
    const next = { ...board, cards: [...board.cards, card] };
    set({ board: next });
    schedulePersist(next);
  },

  removeCard: (cardId: string) => {
    const { board } = get();
    if (!board) return;
    const next = { ...board, cards: board.cards.filter(c => c.id !== cardId) };
    set({ board: next });
    schedulePersist(next);
  },

  moveCard: (cardId: string, colId: string) => {
    const { board } = get();
    if (!board) return;
    const card = board.cards.find(c => c.id === cardId);
    if (!card || card.col === colId) return; // same column → no-op
    const next = {
      ...board,
      cards: board.cards.map(c => c.id === cardId ? { ...c, col: colId } : c),
    };
    set({ board: next });
    schedulePersist(next);
  },

  addColumn: (column: GenericColumn) => {
    const { board } = get();
    if (!board) return;
    const next = { ...board, columns: [...board.columns, column] };
    set({ board: next });
    schedulePersist(next);
  },

  removeColumn: (colId: string, moveToBacklog = false) => {
    const { board } = get();
    if (!board) return;
    let cards = board.cards;
    if (moveToBacklog) {
      cards = cards.map(c => c.col === colId ? { ...c, col: 'backlog' } : c);
    } else {
      cards = cards.filter(c => c.col !== colId);
    }
    const next = { ...board, columns: board.columns.filter(c => c.id !== colId), cards };
    set({ board: next });
    schedulePersist(next);
  },

  renameColumn: (colId: string, title: string) => {
    if (title.trim() === '') return 'empty-title';
    const { board } = get();
    if (!board) return 'ok';
    const next = {
      ...board,
      columns: board.columns.map(c => c.id === colId ? { ...c, title: title.trim() } : c),
    };
    set({ board: next });
    schedulePersist(next);
    return 'ok';
  },

  updateCardSize: (cardId: string, w?: number, h?: number) => {
    const { board } = get();
    if (!board) return;
    const next = {
      ...board,
      cards: board.cards.map(c =>
        c.id === cardId ? { ...c, size: (w == null && h == null) ? undefined : { w, h } } : c
      ),
    };
    set({ board: next });
    schedulePersist(next);
  },

  updateCardTitle: (cardId: string, title: string) => {
    const { board } = get();
    if (!board) return;
    const next = {
      ...board,
      cards: board.cards.map(c => c.id === cardId ? { ...c, title } : c),
    };
    set({ board: next });
    schedulePersist(next);
  },
}));

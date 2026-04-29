/**
 * @description Agent 卡片完整版：左侧彩色 kind 条 + 卡片头 + xterm 终端 + resize handle
 * @module features/kanban/components/AgentCard
 * @dependencies usePtySession, Terminal, useKanbanStore, constants
 * @prd docs/prds/claude-workflow-kanban.md#终端卡片
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T041
 * @rules
 *   - 卡片创建时立即调用 pty_spawn(cwd, cols, rows) 拿到 ptyId, status 初始设为 idle
 *   - 卡片右下角有一个 SVG resize handle, 鼠标拖动改 size, 最小 220×160, 最大 900×800
 */

import { useState, useRef, useCallback } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import { CARD_KIND_COLOR } from '@/features/kanban/constants';
import { usePtySession } from '@/features/terminal/hooks/usePtySession';
import { useKanbanStore } from '@/stores/useKanbanStore';
import { Terminal } from '@/features/terminal/components/Terminal';
import { resizePty } from '@/features/terminal/ipc';
import type { AgentCardState, CardStatus } from '@/types/ipc';
import styles from './AgentCard.module.css';

const STATUS_COLOR: Record<CardStatus, string> = {
  idle: 'var(--text-3)',
  run:  'var(--green)',
  ok:   'var(--teal)',
  err:  'var(--red)',
};

const MIN_W = 220;
const MIN_H = 160;
const MAX_W = 900;
const MAX_H = 800;

export interface AgentCardProps {
  card: AgentCardState;
  cwd?: string;
  onFullscreen?: (card: AgentCardState) => void;
}

export function AgentCard({ card, cwd = '.', onFullscreen }: AgentCardProps) {
  const { toggleSelectCard, selectedCardIds } = useKanbanStore();
  const [size, setSize] = useState({ w: 340, h: 200 });
  const [terminal, setTerminal] = useState<XTerm | null>(null);
  const isSelected = selectedCardIds.has(card.id);

  usePtySession({ cardId: card.id, cwd, terminal, cols: 80, rows: 24 });

  const handleResize = useCallback((cols: number, rows: number) => {
    if (card.ptyId) resizePty(card.ptyId, cols, rows);
  }, [card.ptyId]);

  // Drag-resize from bottom-right handle
  const dragState = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };

    function onMove(ev: MouseEvent) {
      if (!dragState.current) return;
      const newW = Math.min(MAX_W, Math.max(MIN_W, dragState.current.startW + ev.clientX - dragState.current.startX));
      const newH = Math.min(MAX_H, Math.max(MIN_H, dragState.current.startH + ev.clientY - dragState.current.startY));
      setSize({ w: newW, h: newH });
    }

    function onUp() {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleCardClick(e: React.MouseEvent) {
    if (e.shiftKey || e.metaKey) {
      e.stopPropagation();
      toggleSelectCard(card.id);
    }
  }

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      style={{ width: size.w, height: size.h }}
      data-testid="agent-card"
      onClick={handleCardClick}
    >
      {/* left color bar */}
      <div className={styles.kindBar} style={{ background: CARD_KIND_COLOR[card.kind] }} />

      <div className={styles.inner}>
        {/* card header */}
        <div className={styles.header}>
          <div className={styles.lights}>
            <span className={`${styles.light} ${styles.red}`} />
            <span className={`${styles.light} ${styles.yellow}`} />
            <span className={`${styles.light} ${styles.green}`} />
          </div>

          <span className={styles.kindTag}>{card.kind.toUpperCase()}</span>
          <span className={styles.title}>{card.title}</span>

          <span
            className={styles.statusBadge}
            data-testid="agent-card-status-dot"
            style={{ background: STATUS_COLOR[card.status] }}
          />

          <button
            className={styles.menuBtn}
            onClick={(e) => { e.stopPropagation(); onFullscreen?.(card); }}
            title="全屏"
          >
            ⤢
          </button>
        </div>

        {/* terminal area */}
        <div className={styles.terminalArea}>
          {card.status === 'idle' ? (
            <div className={styles.idlePlaceholder}>
              点击运行 /{card.commandId}
            </div>
          ) : (
            <Terminal
              onReady={setTerminal}
              onResize={handleResize}
            />
          )}
        </div>
      </div>

      {/* resize handle */}
      <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M3 10L10 3M7 10L10 7" stroke="var(--line-2)" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

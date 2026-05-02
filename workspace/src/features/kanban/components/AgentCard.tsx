/**
 * @description Agent 卡片：kind 彩色左边框 + traffic light 按钮 + 状态徽章(脉冲) + 右键菜单 + 焦点视图 + 折叠/pinned
 * @module features/kanban/components/AgentCard
 * @dependencies usePtySession, Terminal, useKanbanStore, CardContextMenu, AgentCardFocusView, constants
 * @prd docs/prds/claude-workflow-kanban.md#Agent-卡片
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T012
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.agent .agent-head .traffic .kind-tag .status-badge)
 * @rules
 *   - 卡片左侧 3px 实色边框区分 kind：main=var(--green)、sub=var(--purple)、skill=var(--teal)、hook=var(--amber)
 *   - 卡片头部（.agent-head）背景 var(--bg-3)，cursor: grab，包含：macOS 交通灯（红/黄/绿各 9px 圆）+ 标题（mono 11.5px）+ kind 标签 + 状态徽章 + 菜单按钮（···）
 *   - Kind 标签样式（均大写）：main=绿色背景、sub=紫色背景、skill=青色背景、hook=琥珀色背景
 *   - 状态徽章值及颜色（均大写）：idle=灰色 / run=琥珀色 / ok=绿色 / err=红色 / wait=蓝色
 *   - run 状态时，状态徽章应有闪烁/脉冲动画
 *   - 卡片 idle 状态时，终端区域显示「点击运行 /<cmd>」占位提示，居中，可点击触发 spawn
 *   - 交通灯功能：红=Kill Agent / 黄=Pause 或 Resume / 绿=Restart
 *   - 点击卡片（非交通灯/按钮区域）时打开焦点视图（#卡片详情焦点视图）
 *   - 右键卡片弹出右键菜单（#右键菜单）
 *   - 卡片可在同一泳道内拖拽排序，拖拽中 opacity 0.45
 *   - 选中（activeCard）：border-color: rgba(110,231,127,0.5); box-shadow: 0 0 0 1px rgba(110,231,127,0.3), 0 6px 22px rgba(0,0,0,0.45)
 *   - 折叠状态（collapsed）：隐藏描述文字和终端区域，只显示头部
 *   - Pinned 卡片不可被拖拽，头部显示 🔒 图标
 */

import { useState, useRef, useCallback } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import { CARD_KIND_COLOR } from '@/features/kanban/constants';
import { usePtySession } from '@/features/terminal/hooks/usePtySession';
import { useKanbanStore } from '@/stores/useKanbanStore';
import { Terminal } from '@/features/terminal/components/Terminal';
import { resizePty } from '@/features/terminal/ipc';
import { AgentCardFocusView } from './AgentCardFocusView';
import { CardContextMenu } from './CardContextMenu';
import type { AgentCardState } from '@/types/ipc';
import styles from './AgentCard.module.css';

const STATUS_LABEL: Record<string, string> = {
  idle: 'IDLE',
  run:  'RUN',
  ok:   'OK',
  err:  'ERR',
  wait: 'WAIT',
};

const MIN_W = 220;
const MIN_H = 160;
const MAX_W = 900;
const MAX_H = 800;

export interface AgentCardProps {
  card: AgentCardState;
  cwd?: string;
}

export function AgentCard({ card, cwd = '.' }: AgentCardProps) {
  const { toggleSelectCard, selectedCardIds, removeCard, updateCardStatus } = useKanbanStore();
  const [size, setSize] = useState({ w: 340, h: 200 });
  const [terminal, setTerminal] = useState<XTerm | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, _setPinned] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const isSelected = selectedCardIds.has(card.id);

  usePtySession({ cardId: card.id, cwd, terminal, cols: 80, rows: 24 });

  const handleResize = useCallback((cols: number, rows: number) => {
    if (card.ptyId) resizePty(card.ptyId, cols, rows);
  }, [card.ptyId]);

  // ── Drag-resize from bottom-right handle ──────────────────────────────────
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

  // ── Card click → focus view ───────────────────────────────────────────────
  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-no-focus]')) return;
    if (e.shiftKey || e.metaKey) {
      toggleSelectCard(card.id);
      return;
    }
    setFocusOpen(true);
  }

  // ── Right-click → context menu ────────────────────────────────────────────
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }

  // ── Traffic lights ─────────────────────────────────────────────────────────
  function handleKill(e: React.MouseEvent) {
    e.stopPropagation();
    removeCard(card.id);
  }
  function handlePause(e: React.MouseEvent) {
    e.stopPropagation();
    updateCardStatus(card.id, card.status === 'run' ? 'idle' : 'run');
  }
  function handleRestart(e: React.MouseEvent) {
    e.stopPropagation();
    updateCardStatus(card.id, 'idle');
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────
  function onDragStart(e: React.DragEvent) {
    if (pinned) { e.preventDefault(); return; }
    e.dataTransfer.setData('cardId', card.id);
    setDragging(true);
  }
  function onDragEnd() { setDragging(false); }

  const cardClass = [
    styles.card,
    isSelected ? styles.selected : '',
    collapsed  ? styles.collapsed : '',
    pinned     ? styles.pinned : '',
    dragging   ? styles.dragging : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        className={cardClass}
        style={{ width: size.w, height: collapsed ? 'auto' : size.h }}
        data-testid="agent-card"
        draggable={!pinned}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
      >
        {/* left kind color bar */}
        <div className={styles.kindBar} style={{ background: CARD_KIND_COLOR[card.kind] }} />

        <div className={styles.inner}>
          {/* ── card header ─────────────────────────────────────── */}
          <div className={styles.header} data-no-focus>
            {/* traffic lights */}
            <div className={styles.lights} data-no-focus>
              <span className={`${styles.light} ${styles.red}`}    title="Kill"    onClick={handleKill} />
              <span className={`${styles.light} ${styles.yellow}`} title="Pause/Resume" onClick={handlePause} />
              <span className={`${styles.light} ${styles.green}`}  title="Restart" onClick={handleRestart} />
            </div>

            <span className={`${styles.kindTag} ${styles[card.kind]}`}>
              {card.kind}
            </span>
            <span className={styles.title}>{card.title}</span>

            {pinned && <span className={styles.pinnedIcon}>🔒</span>}

            <span
              className={`${styles.statusBadge} ${styles[card.status]}`}
              data-testid="agent-card-status-dot"
            >
              {STATUS_LABEL[card.status] ?? card.status.toUpperCase()}
            </span>

            <button
              className={styles.menuBtn}
              data-no-focus
              title={collapsed ? '展开' : '折叠'}
              onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
            >
              {collapsed ? '▼' : '▲'}
            </button>
          </div>

          {/* ── terminal area ────────────────────────────────────── */}
          <div className={styles.terminalArea}>
            {card.status === 'idle' ? (
              <div className={styles.idlePlaceholder} data-no-focus onClick={(e) => e.stopPropagation()}>
                点击运行 /{card.commandId}
              </div>
            ) : (
              <Terminal onReady={setTerminal} onResize={handleResize} />
            )}
          </div>
        </div>

        {/* resize handle */}
        <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} data-no-focus>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 10L10 3M7 10L10 7" stroke="var(--line-2)" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {focusOpen && (
        <AgentCardFocusView card={card} cwd={cwd} onClose={() => setFocusOpen(false)} />
      )}

      {ctxMenu && (
        <CardContextMenu
          card={card}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
}

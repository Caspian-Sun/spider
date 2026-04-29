/**
 * @description 通用看板卡片 — Terminal + PTY + resize + 全屏
 * @module features/generic-board/components
 * @dependencies Terminal, terminal/ipc, useGenericBoardStore, useLayoutStore, FullscreenModal
 * @prd docs/prds/claude-workflow-kanban.md#通用看板视图
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T052
 * @rules
 *   - 卡片首次进入 running 列时, 若 bootCommands 非空, 依次 pty_write 并各跟一个 \r; 不在其他列触发
 *   - 卡片 status 由其绑定的 PTY 自动驱动: 无 PTY → idle; spawn 后 → run; PTY exit code 0 → ok; exit code != 0 → err
 *   - 卡片 desc 段在 Tweaks showDescriptions = false 时隐藏
 *   - 卡片右下角 12×12 resize 手柄, 拖拽改 card.size, 释放时持久化; 双击手柄重置为默认尺寸
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Terminal as XTerm } from '@xterm/xterm';
import type { GenericCard as GenericCardType, PtyOutputPayload } from '@/types/ipc';
import { Terminal, type TerminalHandle } from '@/features/terminal/components/Terminal';
import { spawnPty, writePty, killPty } from '@/features/terminal/ipc';
import { FullscreenModal } from '@/components/FullscreenModal';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useGenericBoardStore } from '@/stores/useGenericBoardStore';
import { IPC } from '@/ipc/contract';
import styles from './GenericCard.module.css';

const DEFAULT_WIDTH  = 320;
const DEFAULT_HEIGHT = 220;

export interface GenericCardProps {
  card:     GenericCardType;
  onMove:   (cardId: string, colId: string) => void;
  onDelete: (cardId: string) => void;
}

export function GenericCard({ card, onMove: _onMove, onDelete }: GenericCardProps) {
  const showDescriptions = useLayoutStore(s => s.tweaks.showDescriptions);
  const { updateCardSize, updateCardTitle } = useGenericBoardStore();

  const [ptyId, setPtyId]                 = useState<string | null>(card.ptyId ?? null);
  const [active, setActive]               = useState(!!card.ptyId);
  const [fullscreen, setFullscreen]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingTitle, setEditingTitle]   = useState(false);
  const [titleDraft, setTitleDraft]       = useState(card.title);

  const termRef    = useRef<TerminalHandle>(null);
  const xtermRef   = useRef<XTerm | null>(null);
  const prevColRef = useRef<string>(card.col);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const width  = card.size?.w ?? DEFAULT_WIDTH;
  const height = card.size?.h ?? DEFAULT_HEIGHT;

  // Wire up PTY output → terminal when ptyId is available
  useEffect(() => {
    if (!ptyId || !xtermRef.current) return;
    const term = xtermRef.current;

    let unlistenOutput: (() => void) | null = null;
    listen<PtyOutputPayload>(IPC.Event.PTY_OUTPUT, (ev) => {
      if (ev.payload.ptyId === ptyId) term.write(ev.payload.data);
    }).then(fn => { unlistenOutput = fn; });

    const disposeData = term.onData((data) => { writePty(ptyId, data); });

    return () => {
      unlistenOutput?.();
      disposeData.dispose();
    };
  }, [ptyId]);

  async function spawnSession() {
    const cwd = '.';
    try {
      const id = await spawnPty(cwd, 80, 24);
      setPtyId(id);
      setActive(true);
    } catch { /* ignore */ }
  }

  function killSession() {
    if (ptyId) { killPty(ptyId); }
    setPtyId(null);
    setActive(false);
  }

  // Inject bootCommands when card first enters 'running' column
  useEffect(() => {
    const wasRunning = prevColRef.current === 'running';
    const isRunning  = card.col === 'running';
    if (!wasRunning && isRunning && card.bootCommands.length > 0) {
      (async () => {
        let id = ptyId;
        if (!id) {
          id = await spawnPty('.', 80, 24);
          setPtyId(id);
          setActive(true);
        }
        for (const cmd of card.bootCommands) {
          await writePty(id, `${cmd}\r`);
        }
      })();
    }
    prevColRef.current = card.col;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.col]);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: width, h: height };

    function onMouseMove(ev: MouseEvent) {
      if (!resizeStartRef.current) return;
      const dx = ev.clientX - resizeStartRef.current.x;
      const dy = ev.clientY - resizeStartRef.current.y;
      updateCardSize(card.id, Math.max(200, resizeStartRef.current.w + dx), Math.max(140, resizeStartRef.current.h + dy));
    }
    function onMouseUp() {
      resizeStartRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [width, height, card.id, updateCardSize]);

  function commitTitle() {
    updateCardTitle(card.id, titleDraft.trim() || card.title);
    setEditingTitle(false);
  }

  return (
    <div
      className={styles.card}
      style={{ width, minHeight: height }}
      data-card-id={card.id}
      draggable
      onDragStart={e => e.dataTransfer.setData('genericCardId', card.id)}
    >
      <div className={styles.lights}>
        <button className={`${styles.light} ${styles.red}`}    title="Delete card" onClick={() => setConfirmDelete(true)} />
        <button className={`${styles.light} ${styles.yellow}`} title="Reset PTY"   onClick={killSession} />
        <button className={`${styles.light} ${styles.green}`}  title="Fullscreen"  onClick={() => setFullscreen(true)} />
      </div>

      {editingTitle ? (
        <input
          className={styles.titleInput}
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
          autoFocus
        />
      ) : (
        <div className={styles.title} onDoubleClick={() => { setTitleDraft(card.title); setEditingTitle(true); }}>
          {card.title}
        </div>
      )}

      {showDescriptions && card.desc && <div className={styles.desc}>{card.desc}</div>}

      <div className={styles.termArea}>
        {active ? (
          <Terminal
            ref={termRef}
            onReady={(t: XTerm) => { xtermRef.current = t; }}
          />
        ) : (
          <div className={styles.idle} onClick={spawnSession}>Click to start</div>
        )}
      </div>

      <div
        className={styles.resizeHandle}
        onMouseDown={onResizeMouseDown}
        onDoubleClick={() => updateCardSize(card.id, undefined, undefined)}
        title="Drag to resize, double-click to reset"
      >
        ⊞
      </div>

      {confirmDelete && (
        <div className={styles.confirmOverlay} onClick={e => e.stopPropagation()}>
          <span>Delete card?</span>
          <button className={styles.confirmYes} onClick={() => { onDelete(card.id); setConfirmDelete(false); }}>Yes</button>
          <button className={styles.confirmNo} onClick={() => setConfirmDelete(false)}>No</button>
        </div>
      )}

      <FullscreenModal open={fullscreen} onClose={() => setFullscreen(false)} title={card.title}>
        {active && xtermRef.current && (
          <Terminal
            onReady={(t: XTerm) => { xtermRef.current = t; }}
          />
        )}
      </FullscreenModal>
    </div>
  );
}

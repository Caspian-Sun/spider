/**
 * @description 单个 PTY 会话生命周期管理 hook
 * @module features/terminal/hooks/usePtySession
 * @dependencies @tauri-apps/api/event, terminal/ipc, useKanbanStore
 * @prd docs/prds/claude-workflow-kanban.md#终端卡片
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T039
 * @rules
 *   - xterm 的 onData 回调调 pty_write(ptyId, data) 把用户输入发回
 *   - 收到 pty_exit 事件后, 根据 code: 0 → ok, 非 0 → err
 */

import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Terminal } from '@xterm/xterm';
import { IPC } from '@/ipc/contract';
import { spawnPty, writePty, killPty } from '@/features/terminal/ipc';
import { useKanbanStore } from '@/stores/useKanbanStore';
import type { PtyOutputPayload, PtyExitPayload } from '@/types/ipc';

export interface UsePtySessionOptions {
  cardId: string;
  cwd: string;
  terminal: Terminal | null;
  cols?: number;
  rows?: number;
}

export function usePtySession({
  cardId,
  cwd,
  terminal,
  cols = 80,
  rows = 24,
}: UsePtySessionOptions) {
  const { updateCardPtyId, updateCardStatus } = useKanbanStore();
  const ptyIdRef = useRef<string | null>(null);

  // Spawn PTY on mount
  useEffect(() => {
    if (!terminal) return;

    let alive = true;

    async function spawn() {
      try {
        const ptyId = await spawnPty(cwd, cols, rows);
        if (!alive) { killPty(ptyId); return; }
        ptyIdRef.current = ptyId;
        updateCardPtyId(cardId, ptyId);

        // Subscribe pty_output → xterm.write
        const unlistenOutput = await listen<PtyOutputPayload>(IPC.Event.PTY_OUTPUT, (ev) => {
          if (ev.payload.ptyId === ptyId && terminal) {
            terminal.write(ev.payload.data);
          }
        });

        // Subscribe pty_exit
        const unlistenExit = await listen<PtyExitPayload>(IPC.Event.PTY_EXIT, (ev) => {
          if (ev.payload.ptyId !== ptyId) return;
          updateCardStatus(cardId, ev.payload.code === 0 ? 'ok' : 'err');
          unlistenOutput();
          unlistenExit();
        });

        // Forward user input → PTY
        terminal!.onData((data) => {
          if (ptyIdRef.current) writePty(ptyIdRef.current, data);
        });

        updateCardStatus(cardId, 'run');
      } catch {
        updateCardStatus(cardId, 'err');
      }
    }

    spawn();

    return () => {
      alive = false;
      if (ptyIdRef.current) {
        killPty(ptyIdRef.current);
        updateCardPtyId(cardId, null);
        ptyIdRef.current = null;
      }
    };
  }, [terminal, cwd]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ptyId: ptyIdRef.current };
}

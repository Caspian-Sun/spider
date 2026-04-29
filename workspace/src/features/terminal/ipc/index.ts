/**
 * @description PTY Tauri command wrappers
 * @module features/terminal/ipc
 * @dependencies @tauri-apps/api/core, @/ipc/contract
 * @prd docs/prds/claude-workflow-kanban.md#终端卡片
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T038
 * @rules
 *   - 不允许在组件或 hook 内直接调 invoke()，所有 PTY 命令调用必须通过本 wrapper 函数
 */

import { invoke } from '@tauri-apps/api/core';
import { IPC } from '@/ipc/contract';

export async function spawnPty(cwd: string, cols: number, rows: number): Promise<string> {
  return invoke<string>(IPC.Cmd.PTY_SPAWN, { cwd, cols, rows });
}

export async function writePty(ptyId: string, data: string): Promise<void> {
  return invoke<void>(IPC.Cmd.PTY_WRITE, { ptyId, data });
}

export async function resizePty(ptyId: string, cols: number, rows: number): Promise<void> {
  return invoke<void>(IPC.Cmd.PTY_RESIZE, { ptyId, cols, rows });
}

export async function killPty(ptyId: string): Promise<void> {
  return invoke<void>(IPC.Cmd.PTY_KILL, { ptyId });
}

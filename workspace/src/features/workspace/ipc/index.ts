/**
 * @description workspace 模块 Tauri command 调用封装，禁止在组件内直接调 invoke()
 * @module features/workspace/ipc
 * @dependencies @tauri-apps/api/core, @/ipc/contract, @/types/ipc
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T009
 * @rules
 *   - 不允许在组件内直接调 invoke()，必须通过 wrapper 函数
 */

import { invoke } from '@tauri-apps/api/core';
import { IPC } from '@/ipc/contract';
import type { ValidateResult, Workspace } from '@/types/ipc';

export async function pickWorkspaceFolder(): Promise<string> {
  return invoke<string>(IPC.Cmd.PICK_WORKSPACE_FOLDER);
}

export async function validateWorkspace(path: string): Promise<ValidateResult> {
  return invoke<ValidateResult>(IPC.Cmd.VALIDATE_WORKSPACE, { path });
}

export async function scanWorkspace(path: string): Promise<Workspace> {
  return invoke<Workspace>(IPC.Cmd.SCAN_WORKSPACE, { path });
}

export async function getRecentWorkspaces(): Promise<string[]> {
  return invoke<string[]>(IPC.Cmd.GET_RECENT_WORKSPACES);
}

export async function addRecentWorkspace(path: string): Promise<void> {
  return invoke<void>(IPC.Cmd.ADD_RECENT_WORKSPACE, { path });
}

export async function startWatcher(path: string): Promise<void> {
  return invoke<void>(IPC.Cmd.START_WATCHER, { path });
}

/**
 * @description 文件系统与 app_state IPC wrappers
 * @module features/fs/ipc
 * @dependencies @tauri-apps/api/core, @/ipc/contract, @/types/ipc
 * @prd docs/prds/claude-workflow-kanban.md#文件系统集成
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T030
 * @rules
 *   - UI 采用乐观更新: 改动即刻反映到 UI, 后台写入; 写失败 toast 错误 + 回滚 UI
 */

import { invoke } from '@tauri-apps/api/core';
import { IPC } from '@/ipc/contract';
import type { AppPersistentState } from '@/types/ipc';

export async function readFileRaw(path: string, root: string): Promise<string> {
  return invoke<string>(IPC.Cmd.READ_FILE_RAW, { path, root });
}

export async function writeFile(path: string, root: string, content: string): Promise<void> {
  return invoke<void>(IPC.Cmd.WRITE_FILE, { path, root, content });
}

export async function createFile(path: string, root: string, template?: string): Promise<void> {
  return invoke<void>(IPC.Cmd.CREATE_FILE, { path, root, template });
}

export async function deleteFile(path: string, root: string): Promise<void> {
  return invoke<void>(IPC.Cmd.DELETE_FILE, { path, root });
}

export async function renameFile(from: string, to: string, root: string): Promise<void> {
  return invoke<void>(IPC.Cmd.RENAME_FILE, { from, to, root });
}

export async function updateFrontmatter(
  path: string,
  root: string,
  key: string,
  value: string,
): Promise<void> {
  return invoke<void>(IPC.Cmd.UPDATE_FRONTMATTER, { path, root, key, value });
}

export async function updateTaskStatus(
  manifestPath: string,
  root: string,
  taskId: string,
  status: string,
): Promise<void> {
  return invoke<void>(IPC.Cmd.UPDATE_TASK_STATUS, { manifestPath, root, taskId, status });
}

export async function readAppState(): Promise<AppPersistentState> {
  return invoke<AppPersistentState>(IPC.Cmd.READ_APP_STATE);
}

export async function writeAppState(key: string, value: unknown): Promise<void> {
  return invoke<void>(IPC.Cmd.WRITE_APP_STATE, { key, value });
}

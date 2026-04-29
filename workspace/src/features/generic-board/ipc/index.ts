/**
 * @description 通用看板 Tauri command 的 typed wrapper
 * @module features/generic-board/ipc
 * @dependencies IPC, types/ipc
 * @prd docs/prds/claude-workflow-kanban.md#通用看板视图
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T049
 * @rules
 *   - 不允许在组件或 store 内直接调 invoke()，所有通用看板命令调用必须通过本 wrapper 函数
 */

import { invoke } from '@tauri-apps/api/core';
import { IPC } from '@/ipc/contract';
import type { GenericBoard, Layout } from '@/types/ipc';

export async function readGenericBoard(workspaceRoot: string): Promise<GenericBoard> {
  return invoke<GenericBoard>(IPC.Cmd.READ_GENERIC_BOARD, { workspaceRoot });
}

export async function writeGenericBoard(workspaceRoot: string, board: GenericBoard): Promise<void> {
  return invoke<void>(IPC.Cmd.WRITE_GENERIC_BOARD, { workspaceRoot, board });
}

export async function getLayout(): Promise<Layout> {
  return invoke<Layout>(IPC.Cmd.GET_LAYOUT);
}

export async function setLayout(layout: Layout): Promise<void> {
  return invoke<void>(IPC.Cmd.SET_LAYOUT, { layout });
}

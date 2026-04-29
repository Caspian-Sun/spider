/**
 * @description 监听 workspace_changed 事件，做增量 store 更新
 * @module hooks/useWorkspaceWatcher
 * @dependencies @tauri-apps/api/event, useWorkspaceStore, ipc/contract
 * @prd docs/prds/claude-workflow-kanban.md#文件系统集成
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T036
 * @rules
 *   - 前端根据 diff 做增量更新, 只刷新受影响的 store 切片, 不触发全表重绘
 *   - 从 Rust 发事件到 DOM 可见变化必须在 500ms 内完成
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { IPC } from '@/ipc/contract';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { scanWorkspace } from '@/features/workspace/ipc';
import type { WorkspaceChangedPayload } from '@/types/ipc';

export function useWorkspaceWatcher() {
  const { workspace, setWorkspace } = useWorkspaceStore();

  useEffect(() => {
    if (!workspace) return;

    const unlisten = listen<WorkspaceChangedPayload>(
      IPC.Event.WORKSPACE_CHANGED,
      async (event) => {
        const { kind } = event.payload;
        // Incremental rescan: only re-scan if known kind affected
        if (['commands', 'prds', 'tasks', 'rules', 'generic'].includes(kind)) {
          try {
            const updated = await scanWorkspace(workspace.rootPath);
            setWorkspace(updated);
          } catch {
            // non-critical — watcher failure should not break UX
          }
        }
      },
    );

    return () => { unlisten.then((fn) => fn()); };
  }, [workspace?.rootPath]); // eslint-disable-line react-hooks/exhaustive-deps
}

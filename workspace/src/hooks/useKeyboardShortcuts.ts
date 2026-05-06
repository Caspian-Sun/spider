/**
 * @description 全局键盘快捷键 — ⌘O 打开工作区 / ⌘W 关闭工作区 / ⌘S 保存
 * @module src/hooks
 * @dependencies useWorkspaceStore, workspace/ipc
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T054
 * @rules
 *   - ⌘O 触发 pickWorkspaceFolder，⌘W 触发 close workspace 回到 empty 状态，⌘S 触发当前聚焦编辑器保存
 *   - 快捷键映射集中定义为常量，禁止在 keydown handler 内硬编码 key 字符串
 *   - 组件 unmount 时必须移除 keydown listener，防止内存泄漏
 */

import { useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { pickWorkspaceFolder, validateWorkspace, scanWorkspace, addRecentWorkspace, startWatcher } from '@/features/workspace/ipc';

const SHORTCUTS = {
  OPEN_WORKSPACE:  'o',   // ⌘O / Ctrl+O
  CLOSE_WORKSPACE: 'w',   // ⌘W / Ctrl+W
  SAVE:            's',   // ⌘S / Ctrl+S
} as const;

export function useKeyboardShortcuts() {
  const { reset, setPhase, setWorkspace, addRecent, setScanError } = useWorkspaceStore();

  useEffect(() => {
    async function onKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;

      switch (e.key) {
        case SHORTCUTS.OPEN_WORKSPACE: {
          e.preventDefault();
          try {
            const path = await pickWorkspaceFolder();
            setPhase('scanning');
            const validation = await validateWorkspace(path);
            if (!validation.valid) { setPhase('invalid'); return; }
            const ws = await scanWorkspace(path);
            setWorkspace(ws);
            addRecent(path);
            await addRecentWorkspace(path);
            startWatcher(path).catch(() => { /* watcher best-effort */ });
          } catch { /* user cancelled or error */ }
          break;
        }
        case SHORTCUTS.CLOSE_WORKSPACE: {
          e.preventDefault();
          reset();
          break;
        }
        case SHORTCUTS.SAVE: {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('app:save'));
          break;
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [reset, setPhase, setWorkspace, addRecent, setScanError]);
}

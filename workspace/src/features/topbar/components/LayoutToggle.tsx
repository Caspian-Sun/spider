/**
 * @description 顶栏布局切换按钮 (workflow / generic)
 * @module features/topbar/components/LayoutToggle
 * @dependencies useLayoutStore, @tauri-apps/api/core, IPC
 * @prd docs/prds/claude-workflow-kanban.md#顶部操作栏
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T018
 * @rules
 *   - Layout Toggle 是位于 stats chip 与 Rules 按钮之间的图标按钮组 (icon: columns / grid), 默认高亮 workflow
 *   - Layout Toggle 切换时, 主体 Board 区域整体替换, 顶栏 / RetroTimeline / 抽屉保持挂载不重渲
 */

import { invoke } from '@tauri-apps/api/core';
import { useLayoutStore, type LayoutMode } from '@/stores/useLayoutStore';
import { IPC } from '@/ipc/contract';
import styles from './LayoutToggle.module.css';

const MODES: { mode: LayoutMode; label: string; icon: string }[] = [
  { mode: 'workflow', label: '泳道视图', icon: '⫴' },
  { mode: 'generic',  label: '通用看板', icon: '⊞' },
];

export function LayoutToggle() {
  const { layout, setLayout } = useLayoutStore();

  async function handleSwitch(mode: LayoutMode) {
    if (mode === layout) return;
    setLayout(mode);
    try {
      await invoke(IPC.Cmd.SET_LAYOUT, { layout: mode });
    } catch {
      // persist failure is non-blocking
    }
  }

  return (
    <div className={styles.group}>
      {MODES.map(({ mode, label, icon }) => (
        <button
          key={mode}
          className={`${styles.btn} ${layout === mode ? styles.active : ''}`}
          title={label}
          onClick={() => handleSwitch(mode)}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

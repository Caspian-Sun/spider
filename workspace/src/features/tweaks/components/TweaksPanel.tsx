/**
 * @description 右下角可折叠 Tweaks 面板
 * @module features/tweaks/components/TweaksPanel
 * @dependencies useLayoutStore, @tauri-apps/api/core, IPC
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T025
 * @rules
 *   - Tweaks 面板固定在右下角 14px, 宽 260px, 默认折叠为一个小圆钮 (24×24, 绿色发光点)
 *   - Density 段控件 (comfortable / compact 互斥), 改动后立即切换 padding/font-size
 *   - 所有面板改动都写入 Rust 端 app_state.json (键 tweaks.<field>), 下次启动保留; 不写 localStorage
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { IPC } from '@/ipc/contract';
import styles from './TweaksPanel.module.css';

type Density = 'compact' | 'comfortable';

export function TweaksPanel() {
  const { tweaks, setTweaks } = useLayoutStore();
  const [open, setOpen] = useState(false);

  async function persist(key: string, value: unknown) {
    try {
      await invoke(IPC.Cmd.WRITE_APP_STATE, { key: `tweaks.${key}`, value });
    } catch {
      // non-blocking
    }
  }

  function handleDensity(density: Density) {
    setTweaks({ density });
    persist('density', density);
  }

  function handleToggle(key: 'showHelperLanes' | 'showDescriptions', val: boolean) {
    setTweaks({ [key]: val });
    persist(key, val);
  }

  return (
    <div className={styles.container}>
      {open ? (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Tweaks</span>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className={styles.section}>
            <div className={styles.label}>Density</div>
            <div className={styles.segControl}>
              {(['compact', 'comfortable'] as Density[]).map((d) => (
                <button
                  key={d}
                  className={`${styles.seg} ${tweaks.density === d ? styles.segActive : ''}`}
                  onClick={() => handleDensity(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.toggle}>
              <span className={styles.label}>Helper lanes</span>
              <input
                type="checkbox"
                checked={tweaks.showHelperLanes}
                onChange={(e) => handleToggle('showHelperLanes', e.target.checked)}
              />
            </div>
            <div className={styles.toggle}>
              <span className={styles.label}>Show descriptions</span>
              <input
                type="checkbox"
                checked={tweaks.showDescriptions}
                onChange={(e) => handleToggle('showDescriptions', e.target.checked)}
              />
            </div>
          </div>
        </div>
      ) : (
        <button className={styles.fab} onClick={() => setOpen(true)} title="Tweaks" />
      )}
    </div>
  );
}

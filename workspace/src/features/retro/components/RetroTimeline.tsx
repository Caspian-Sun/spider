/**
 * @description 回溯时间轴 — 固定底部条，默认 28px，点击展开 120px；左侧 ws 状态指示灯 + 右侧 Shell tabs
 * @module features/retro/components/RetroTimeline
 * @dependencies useWorkspaceStore, useShellStore
 * @prd docs/prds/claude-workflow-kanban.md#底部时间轴
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T016
 * @design docs/designs/claude-workflow-kanban/wf-app.jsx (RetroTimeline 组件)
 * @rules
 *   - Retro Timeline 固定在屏幕最底部，默认高度 28px；点击后展开至 120px 显示完整历史
 *   - 展开/收起有高度过渡动画（0.15s ease）
 *   - 收起状态左侧显示：ws 状态指示灯（Ready=绿实心 / Empty=灰空心 / Scanning=琥珀闪烁 / Invalid=红实心）+ 最近一次 drift 数
 *   - 收起状态右侧显示：Shell Panel 终端 tab 行（tab 可点击切换，× 可关闭）
 *   - 展开状态显示历史列表：每项显示日期 + drift 数 + dead 引用数 + commits 数
 *   - drift 颜色：0 = var(--green) / 1-2 = var(--amber) / 3+ = var(--red)
 *   - 展开时，键盘左右方向键在历史记录间导航，高亮当前选中时间点
 */

import { useState, useEffect, useCallback } from 'react';
import type { Retrospective } from '@/types/ipc';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useShellStore } from '@/features/shell/stores/useShellStore';
import styles from './RetroTimeline.module.css';

export interface RetroTimelineProps {
  retrospectives: Retrospective[];
}

function driftColor(drift: number): string {
  if (drift === 0) return 'var(--green)';
  if (drift <= 2) return 'var(--amber)';
  return 'var(--red)';
}

export function RetroTimeline({ retrospectives }: RetroTimelineProps) {
  const { phase } = useWorkspaceStore();
  const { tabs, activeTabId, setActiveTab, closeTab } = useShellStore();
  const [expanded, setExpanded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const sorted = [...retrospectives].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (!expanded || sorted.length === 0) return;
    if (e.key === 'ArrowLeft') {
      setSelectedIdx((prev) => Math.max(0, (prev ?? sorted.length - 1) - 1));
    } else if (e.key === 'ArrowRight') {
      setSelectedIdx((prev) => Math.min(sorted.length - 1, (prev ?? 0) + 1));
    }
  }, [expanded, sorted.length]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <div
      className={`${styles.timeline} ${expanded ? styles.expanded : ''}`}
      onClick={() => setExpanded((e) => !e)}
      role="region"
      aria-label="Retro Timeline"
    >
      {!expanded ? (
        /* ── collapsed: indicator + summary + shell tabs ── */
        <>
          <div className={styles.left}>
            <span className={`${styles.wsIndicator} ${styles[`ws_${phase}`]}`} title={phase} />
            <span className={styles.summary}>
              {latest
                ? `${latest.date} · drift ${latest.drift}`
                : 'No retros yet'}
            </span>
          </div>

          {tabs.length > 0 && (
            <div className={styles.shellTabs} onClick={(e) => e.stopPropagation()}>
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`${styles.shellTab} ${tab.id === activeTabId ? styles.shellTabActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className={styles.shellTabTitle}>{tab.title}</span>
                  <span
                    className={styles.shellTabClose}
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  >×</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── expanded: history list ── */
        <div className={styles.nodes} onClick={(e) => e.stopPropagation()}>
          {sorted.length === 0 ? (
            <span className={styles.empty}>No retros yet</span>
          ) : (
            sorted.map((retro, idx) => (
              <div
                key={retro.id}
                className={`${styles.node} ${selectedIdx === idx ? styles.nodeSelected : ''}`}
                onClick={() => setSelectedIdx(idx)}
                role="button"
                tabIndex={0}
              >
                <div className={styles.dot} />
                <div className={styles.nodeDate}>{retro.date}</div>
                <div className={styles.badges}>
                  <span className={styles.badge} style={{ color: driftColor(retro.drift) }}>
                    d{retro.drift}
                  </span>
                  <span className={styles.badge} style={{ color: 'var(--text-3)' }}>
                    x{retro.dead}
                  </span>
                  <span className={styles.badge} style={{ color: 'var(--teal)' }}>
                    c{retro.commits}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

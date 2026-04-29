/**
 * @description 回溯时间轴 — 固定底部条，默认 28px，点击展开 120px
 * @module features/retro/components
 * @dependencies useWorkspaceStore
 * @prd docs/prds/claude-workflow-kanban.md#回溯时间轴
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T045
 * @rules
 *   - RetroTimeline 固定在 Board 底部, 默认高度 28px (仅显示一行摘要)
 *   - 点击展开到 120px, 横向列出所有 Retrospective 节点 (圆点 + 日期 + 三个小徽章 drift/dead/commits)
 *   - 节点按日期升序从左往右排, 最新的在右
 *   - drift 数字颜色: 0 绿 / 1-3 amber / >3 红
 *   - 键盘 Left/Right 切换选中节点 (展开态下)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Retrospective } from '@/types/ipc';
import styles from './RetroTimeline.module.css';

export interface RetroTimelineProps {
  retrospectives: Retrospective[];
}

function driftColor(drift: number): string {
  if (drift === 0) return 'var(--green)';
  if (drift <= 3) return 'var(--amber)';
  return 'var(--red)';
}

function latestSummary(retros: Retrospective[]): string {
  if (retros.length === 0) return 'No retros yet';
  const sorted = [...retros].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  return `${last.date} · drift ${last.drift} · dead ${last.dead} · ${last.commits} commits`;
}

export function RetroTimeline({ retrospectives }: RetroTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sorted = [...retrospectives].sort((a, b) => a.date.localeCompare(b.date));

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (!expanded || sorted.length === 0) return;
    if (e.key === 'ArrowLeft') {
      setSelectedIdx(prev => {
        const cur = prev ?? sorted.length - 1;
        return Math.max(0, cur - 1);
      });
    } else if (e.key === 'ArrowRight') {
      setSelectedIdx(prev => {
        const cur = prev ?? 0;
        return Math.min(sorted.length - 1, cur + 1);
      });
    }
  }, [expanded, sorted.length]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <div
      ref={containerRef}
      className={`${styles.timeline} ${expanded ? styles.expanded : ''}`}
      onClick={() => setExpanded(e => !e)}
      role="region"
      aria-label="Retro Timeline"
    >
      {!expanded ? (
        <span className={styles.summary}>{latestSummary(sorted)}</span>
      ) : (
        <div className={styles.nodes} onClick={e => e.stopPropagation()}>
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

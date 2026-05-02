/**
 * @description 卡片详情焦点视图：全屏遮罩 blur(3px) + 900×620 窗口 + 共享 PTY 会话 + Esc/遮罩关闭
 * @module features/kanban/components/AgentCardFocusView
 * @dependencies Terminal, usePtySession
 * @prd docs/prds/claude-workflow-kanban.md#卡片详情焦点视图
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T009
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.focus-veil .focus-box)
 * @rules
 *   - 点击卡片（非交通灯/按钮区域）打开焦点视图
 *   - 遮罩：rgba(0,0,0,0.65) + backdrop-filter: blur(3px) 全屏覆盖，z-index: 150
 *   - 焦点窗口尺寸：min(900px, 90vw) × min(620px, 85vh)，居中，border-radius 8px
 *   - 焦点窗口显示完整 Agent 卡片内容：头部 + 描述 + 全高度终端（无 max-height 限制）
 *   - Esc 或点击遮罩关闭焦点视图
 *   - 焦点视图与卡片共享同一 PTY 会话（不重新 spawn），关闭后 PTY 继续运行
 */

import { useEffect, useRef } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import { Terminal } from '@/features/terminal/components/Terminal';
import { usePtySession } from '@/features/terminal/hooks/usePtySession';
import { resizePty } from '@/features/terminal/ipc';
import type { AgentCardState } from '@/types/ipc';
import styles from './AgentCardFocusView.module.css';

export interface AgentCardFocusViewProps {
  card: AgentCardState;
  cwd?: string;
  onClose: () => void;
}

export function AgentCardFocusView({ card, cwd = '.', onClose }: AgentCardFocusViewProps) {
  const termRef = useRef<XTerm | null>(null);

  // 共享已有 PTY（不重新 spawn）— cardId 与卡片一致，usePtySession 内部检测 ptyId 已存在则跳过 spawn
  usePtySession({
    cardId: card.id,
    cwd,
    terminal: termRef.current,
    cols: 120,
    rows: 36,
  });

  // Esc 关闭
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.veil} onClick={onClose}>
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <span className={styles.title}>{card.title ?? card.id}</span>
          <button className={styles.closeBtn} onClick={onClose} title="关闭 (Esc)">×</button>
        </div>
        <div className={styles.terminal}>
          <Terminal
            onReady={(t) => { termRef.current = t; }}
            onResize={(cols, rows) => {
              if (card.ptyId) resizePty(card.ptyId, cols, rows);
            }}
          />
        </div>
      </div>
    </div>
  );
}

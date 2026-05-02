/**
 * @description 全局底部终端面板：tab 管理 + PTY 会话 + 220ms 滑入动画
 * @module features/shell/components/ShellPanel
 * @dependencies useShellStore, useWorkspaceStore, Terminal, usePtySession
 * @prd docs/prds/claude-workflow-kanban.md#全局-Shell-面板
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T006
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.shell-panel .shell-tabs .shell-tab)
 * @rules
 *   - Shell Panel 固定定位：left: 48px; right: 0; bottom: 28px; height: 240px
 *   - 默认隐藏（transform: translateY(100%)），⌘`（反引号）切换显示/隐藏，TopBar >_Shell 按钮同等效果
 *   - 显示/隐藏动画：220ms cubic-bezier(0.32, 0.72, 0, 1)
 *   - Shell Panel 打开时，Board bottom 从 28px 增加到 268px，防止内容被遮挡
 *   - Tab 栏高 32px，活跃 Tab 黑色背景 + 边框，Tab 有 × 关闭按钮
 *   - + 按钮新建 tab，自动 spawn 新 PTY 会话（默认 shell，cwd = workspace rootPath）
 *   - 头部右侧有 minimize / maximize / close 三个操作按钮
 *   - close 等同 ⌘`（关闭面板，不销毁 PTY）；maximize 将面板高度扩展至覆盖 Board
 *   - 面板内终端规则同 #卡片内嵌终端
 */

import { useRef } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import { useShellStore, makeShellTabId } from '../stores/useShellStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { usePtySession } from '@/features/terminal/hooks/usePtySession';
import { Terminal } from '@/features/terminal/components/Terminal';
import { resizePty } from '@/features/terminal/ipc';
import styles from './ShellPanel.module.css';

export function ShellPanel() {
  const { isOpen, isMaximized, tabs, activeTabId, toggle, close, toggleMaximize, addTab, closeTab, setActiveTab, updateTabPtyId } =
    useShellStore();
  const { workspace } = useWorkspaceStore();
  const cwd = workspace?.rootPath ?? '.';

  function handleAddTab() {
    const id = makeShellTabId();
    addTab({ id, ptyId: null, title: `shell ${tabs.length + 1}` });
  }

  function handleCloseTab(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    closeTab(id);
  }

  return (
    <div className={`${styles.panel} ${isOpen ? styles.open : ''} ${isMaximized ? styles.maximized : ''}`}>
      <div className={styles.header}>
        {/* Tab list */}
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${tab.id === activeTabId ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.title}
              <span
                className={styles.tabClose}
                role="button"
                onClick={(e) => handleCloseTab(e, tab.id)}
              >
                ×
              </span>
            </button>
          ))}
          <button className={styles.addBtn} onClick={handleAddTab} title="新建终端">+</button>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <button className={styles.ctrlBtn} title="最小化" onClick={close}>─</button>
          <button className={styles.ctrlBtn} title={isMaximized ? '还原' : '最大化'} onClick={toggleMaximize}>□</button>
          <button className={styles.ctrlBtn} title="关闭" onClick={toggle}>×</button>
        </div>
      </div>

      <div className={styles.body}>
        {tabs.length === 0 ? (
          <div className={styles.empty}>点击 + 新建终端</div>
        ) : (
          tabs.map((tab) => (
            <ShellTabTerminal
              key={tab.id}
              tabId={tab.id}
              ptyId={tab.ptyId}
              cwd={cwd}
              visible={tab.id === activeTabId}
              onPtyId={(ptyId) => updateTabPtyId(tab.id, ptyId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Per-tab terminal ─────────────────────────────────────────────────────────

interface ShellTabTerminalProps {
  tabId: string;
  ptyId: string | null;
  cwd: string;
  visible: boolean;
  onPtyId: (ptyId: string) => void;
}

function ShellTabTerminal({ tabId, cwd, visible, onPtyId }: ShellTabTerminalProps) {
  const termRef = useRef<XTerm | null>(null);

  usePtySession({
    cardId: `shell-${tabId}`,
    cwd,
    terminal: termRef.current,
    cols: 80,
    rows: 24,
  });

  function handleResize(cols: number, rows: number) {
    if (termRef.current) resizePty(`shell-${tabId}`, cols, rows);
  }

  return (
    <div style={{ display: visible ? 'flex' : 'none', height: '100%' }}>
      <Terminal
        onReady={(t) => {
          termRef.current = t;
          onPtyId(`shell-${tabId}`);
        }}
        onResize={handleResize}
      />
    </div>
  );
}

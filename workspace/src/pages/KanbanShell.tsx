/**
 * @description 就绪后的完整看板页面：集成 ActivityBar / ShellPanel / NotificationDrawer / CommandPalette / Board / RetroTimeline 等所有面板
 * @module pages/KanbanShell
 * @dependencies ActivityBar, TopBar, PipelineStrip, Board, GenericBoard, ShellPanel, NotificationDrawer, CommandPalette, RetroTimeline, useLayoutStore, useActivityBarStore, useShellStore
 * @prd docs/prds/claude-workflow-kanban.md#Activity-Bar
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T018
 * @design docs/designs/claude-workflow-kanban/wf-app.jsx (App 根组件结构)
 * @rules
 *   - Activity Bar 固定在屏幕最左侧，宽 48px，高度占满全屏，不随内容滚动，z-index: 95
 *   - 切换 activeView 时，主内容区域整体替换，TopBar / PipelineStrip / RetroTimeline 保持挂载不重渲
 *   - 默认隐藏（transform: translateY(100%)），⌘`（反引号）切换显示/隐藏，TopBar >_Shell 按钮同等效果
 *   - ⌘K 或 TopBar ⌘K 按钮打开命令面板，Esc 关闭
 *   - Shell Panel 打开时，Board bottom 从 28px 增加到 268px，防止内容被遮挡
 *   - Layout 切换为 generic（通用看板）时，Pipeline Strip 整体隐藏
 */

import { useEffect, useState } from 'react';
import { TopBar } from '@/features/topbar/components/TopBar';
import { PipelineStrip } from '@/features/kanban/components/PipelineStrip';
import { Board } from '@/features/kanban/components/Board';
import { GenericBoard } from '@/features/generic-board/components/GenericBoard';
import { ActivityBar } from '@/features/activity-bar/components/ActivityBar';
import { ShellPanel } from '@/features/shell/components/ShellPanel';
import { NotificationDrawer } from '@/features/notifications/components/NotificationDrawer';
import { CommandPalette } from '@/features/command-palette/components/CommandPalette';
import { RetroTimeline } from '@/features/retro/components/RetroTimeline';
import { RulesDrawer } from '@/features/rules/components/RulesDrawer';
import { DocsViewer } from '@/features/docs/components/DocsViewer';
import { PRDPreview } from '@/features/prd/components/PRDPreview';
import { BugList } from '@/features/kanban/components/BugList';
import { TweaksPanel } from '@/features/tweaks/components/TweaksPanel';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useActivityBarStore } from '@/features/activity-bar/stores/useActivityBarStore';
import { useShellStore } from '@/features/shell/stores/useShellStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useNotificationStore } from '@/features/notifications/stores/useNotificationStore';

export function KanbanShell() {
  const { layout } = useLayoutStore();
  const { activeView } = useActivityBarStore();
  const { toggle: toggleShell } = useShellStore();
  const { workspace } = useWorkspaceStore();
  const { isDrawerOpen } = useNotificationStore();
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  const isWorkflow = layout === 'workflow';
  const cwd = workspace?.rootPath ?? '.';
  const retrospectives = workspace?.retrospectives ?? [];
  const bugReports = workspace?.bugReports ?? [];

  // ── Global keyboard shortcuts ─────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // ⌘` — toggle shell
      if (e.metaKey && e.key === '`') {
        e.preventDefault();
        toggleShell();
      }
      // ⌘K — open command palette
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleShell]);

  // ── Main content based on activeView ─────────────────────────
  function renderMainContent() {
    switch (activeView) {
      case 'prd':
        return <PRDPreview />;
      case 'tasks':
      case 'bugs':
        return (
          <BugList
            bugReports={bugReports}
            onStatusChange={() => {}}
            onDelete={() => {}}
          />
        );
      case 'docs':
        return <DocsViewer />;
      case 'settings':
        return null;
      case 'board':
      default:
        return isWorkflow
          ? <Board showPipeline cwd={cwd} />
          : <GenericBoard />;
    }
  }

  return (
    <>
      {/* ── Fixed panels ─────────────────────────────────────── */}
      <ActivityBar />
      <ShellPanel />
      {isDrawerOpen && <NotificationDrawer />}

      {/* ── Page layout ─────────────────────────────────────────────
          TopBar / PipelineStrip are full-width; their own padding-left: 64px
          handles the Activity Bar offset (no extra marginLeft needed here) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopBar />
        {isWorkflow && activeView === 'board' && <PipelineStrip />}

        {/* Non-board views need to be offset right of Activity Bar */}
        {activeView !== 'board' && (
          <div style={{ flex: 1, overflow: 'hidden', marginLeft: 48 }}>
            {renderMainContent()}
          </div>
        )}
      </div>

      {/* Board uses absolute positioning, rendered outside flex flow */}
      {activeView === 'board' && renderMainContent()}

      {/* ── Always-mounted drawers / overlays ─────────────────── */}
      <RetroTimeline retrospectives={retrospectives} />
      <RulesDrawer />
      <TweaksPanel />

      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
      />
    </>
  );
}

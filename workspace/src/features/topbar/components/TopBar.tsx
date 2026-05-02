/**
 * @description 顶栏容器，固定 46px，padding-left 64px，三区布局含全部操作按钮
 * @module features/topbar/components/TopBar
 * @dependencies useWorkspaceStore, useDrawerStore, useShellStore, useNotificationStore, PRDSelector, LayoutToggle
 * @prd docs/prds/claude-workflow-kanban.md#顶部操作栏
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T011
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.topbar .tbar-left .tbar-center .tbar-right .tbar-btn .run-btn)
 * @rules
 *   - TopBar 固定高度 46px，吸顶，z-index: 40，不随看板横向滚动
 *   - padding-left 64px（Activity Bar 48px + 留白 16px），为侧边栏留出空间
 *   - 左区：λ logo（20×20px，绿→青 135° 渐变，border-radius 4px，内显示「λ」黑色加粗）+ 品牌文字「CLAUDE CODE WORKFLOW」（mono 加粗 12.5px）+ 路径 chip + PRD 选择器
 *   - 路径 chip 显示 rootPath 最后两段，格式「…/parent/dir」，悬停 tooltip 显示完整路径，font-family mono
 *   - 中区统计 chip 列表（mono 11px）：cmds 数 / tasks 数 / 文件数 / 测试数 / running 数
 *   - 右区从左到右：Rules 按钮（含违规数红色徽章）→ Docs 按钮 → 🔔 铃铛（含未读数红色徽章）→ ⌘K 按钮 → >_Shell 按钮 → Reset 按钮 → Run pipeline 绿色主按钮
 *   - Run pipeline：background: rgba(110,231,127,0.08); border-color: rgba(110,231,127,0.3); color: var(--green)，触发完整流水线执行前弹确认框
 *   - Rules 按钮违规数为 0 时不显示徽章；🔔 未读数为 0 时不显示徽章
 *   - Reset 点击：关闭工作区，返回 empty 状态，保留最近记录
 *   - 工作区未加载时：路径 chip 隐藏，中区 + 右区操作按钮全部禁用
 */

import styles from './TopBar.module.css';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useDrawerStore } from '@/stores/useLayoutStore';
import { useShellStore } from '@/features/shell/stores/useShellStore';
import { useNotificationStore, selectUnreadCount } from '@/features/notifications/stores/useNotificationStore';
import { PRDSelector } from './PRDSelector';
import { LayoutToggle } from './LayoutToggle';

function shortPath(full: string): string {
  const parts = full.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return full;
  return `…/${parts.slice(-2).join('/')}`;
}

export function TopBar() {
  const { workspace, phase, reset: closeWorkspace } = useWorkspaceStore();
  const { openDrawer } = useDrawerStore();
  const { toggle: toggleShell } = useShellStore();
  const { toggleDrawer: toggleNotifDrawer } = useNotificationStore();
  const unreadCount = useNotificationStore(selectUnreadCount);

  const isLoaded = phase === 'ready' && workspace != null;
  const rootPath   = workspace?.rootPath ?? '';
  const cmds       = workspace?.commands ?? [];
  const totalTasks = workspace?.tasks.reduce((acc, m) => acc + m.tasks.length, 0) ?? 0;
  const bugs       = workspace?.bugReports.length ?? 0;
  const runningCards = 0; // TODO: from useKanbanStore

  function handleReset() {
    if (window.confirm('关闭当前工作区并返回欢迎页？')) {
      closeWorkspace();
    }
  }

  function handleRunPipeline() {
    if (window.confirm('确认触发完整流水线执行？')) {
      // TODO: implement pipeline run
    }
  }

  return (
    <header className={styles.topbar}>
      {/* ── 左区 ──────────────────────────────────────────────────────── */}
      <div className={styles.left}>
        <span className={styles.logo}>λ</span>
        <span className={styles.brandName}>CLAUDE CODE WORKFLOW</span>
        {isLoaded && rootPath && (
          <span className={styles.pathChip} title={rootPath}>
            {shortPath(rootPath)}
          </span>
        )}
        <PRDSelector />
      </div>

      {/* ── 中区统计 ──────────────────────────────────────────────────── */}
      <div className={styles.center}>
        {isLoaded && (
          <>
            <span className={styles.statsChip}>{cmds.length} cmds</span>
            <span className={styles.statsChip}>{totalTasks} tasks</span>
            <span className={styles.statsChip}>{workspace?.staticDocs.length ?? 0} docs</span>
            {bugs > 0 && <span className={styles.statsChipAmber}>{bugs} bugs</span>}
            {runningCards > 0 && (
              <span className={`${styles.statsChip}`} style={{ color: 'var(--green)' }}>
                {runningCards} running
              </span>
            )}
          </>
        )}
      </div>

      {/* ── 右区 ──────────────────────────────────────────────────────── */}
      <div className={styles.right}>
        <LayoutToggle />

        {/* Rules */}
        <button
          className={`${styles.iconBtn} ${styles.badgeBtn}`}
          title="规则抽屉"
          disabled={!isLoaded}
          onClick={() => openDrawer('rules')}
        >
          ⚙
          {bugs > 0 && isLoaded && (
            <span className={styles.btnBadge}>{bugs > 99 ? '99+' : bugs}</span>
          )}
        </button>

        {/* Docs */}
        <button
          className={styles.iconBtn}
          title="文档浏览器"
          disabled={!isLoaded}
          onClick={() => openDrawer('docs')}
        >
          📚
        </button>

        {/* Bell */}
        <button
          className={`${styles.iconBtn} ${styles.badgeBtn}`}
          title="通知"
          disabled={!isLoaded}
          onClick={toggleNotifDrawer}
        >
          🔔
          {unreadCount > 0 && isLoaded && (
            <span className={styles.btnBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>

        {/* ⌘K */}
        <button
          className={styles.iconBtn}
          title="命令面板 (⌘K)"
          disabled={!isLoaded}
          onClick={() => {
            // KanbanShell 监听全局快捷键，这里通过事件触发
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
          }}
        >
          ⌘K
        </button>

        {/* Shell */}
        <button
          className={styles.iconBtn}
          title="全局终端 (⌘`)"
          disabled={!isLoaded}
          onClick={toggleShell}
        >
          &gt;_
        </button>

        {/* Reset */}
        <button
          className={styles.iconBtn}
          title="关闭工作区"
          disabled={!isLoaded}
          onClick={handleReset}
        >
          ⏹
        </button>

        {/* Run pipeline */}
        <button
          className={styles.runBtn}
          disabled={!isLoaded}
          onClick={handleRunPipeline}
        >
          ▶ Run pipeline
        </button>
      </div>
    </header>
  );
}

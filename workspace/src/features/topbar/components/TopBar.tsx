/**
 * @description 顶栏容器，固定 46px，flex 三区布局
 * @module features/topbar/components/TopBar
 * @dependencies useWorkspaceStore, useLayoutStore, useDrawerStore, PRDSelector, LayoutToggle
 * @prd docs/prds/claude-workflow-kanban.md#顶部操作栏
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T016
 * @rules
 *   - 顶栏固定高度 46px, 吸顶, 不随看板横向滚动
 *   - 路径 chip 显示 rootPath 的最后两段 + 省略号前缀, 悬停 tooltip 显示完整路径
 */

import styles from './TopBar.module.css';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useDrawerStore } from '@/stores/useLayoutStore';
import { PRDSelector } from './PRDSelector';
import { LayoutToggle } from './LayoutToggle';

function shortPath(full: string): string {
  const parts = full.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return full;
  return `…/${parts.slice(-2).join('/')}`;
}

export function TopBar() {
  const { workspace } = useWorkspaceStore();
  const { openDrawer } = useDrawerStore();

  const rootPath = workspace?.rootPath ?? '';
  const cmds = workspace?.commands ?? [];
  const totalTasks = workspace?.tasks.reduce((acc, m) => acc + m.tasks.length, 0) ?? 0;
  const bugs = workspace?.bugReports.length ?? 0;

  return (
    <header className={styles.topbar}>
      {/* left: brand + path */}
      <div className={styles.left}>
        <span className={styles.brand}>spider</span>
        {rootPath && (
          <span className={styles.pathChip} title={rootPath}>
            {shortPath(rootPath)}
          </span>
        )}
      </div>

      {/* center: PRDSelector + stats */}
      <div className={styles.center}>
        <PRDSelector />
        <span className={styles.statsChip}>{cmds.length} cmds</span>
        <span className={styles.statsChip}>{totalTasks} tasks</span>
        {bugs > 0 && <span className={styles.statsChipAmber}>{bugs} bugs</span>}
      </div>

      {/* right: layout toggle + rules btn */}
      <div className={styles.right}>
        <LayoutToggle />
        <button
          className={styles.iconBtn}
          title="规则抽屉"
          onClick={() => openDrawer('rules')}
        >
          ⚙
        </button>
      </div>
    </header>
  );
}

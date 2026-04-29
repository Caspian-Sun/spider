/**
 * @description Empty 状态页内最近工作区列表，最多 5 条，失效路径显示删除线 + × 移除
 * @module features/workspace/components
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T056
 * @rules
 *   - 应用启动后, 若 get_recent_workspaces 返回空数组, 进入 empty 状态并显示欢迎页
 *   - 最近工作区记录已失效 (路径消失) 时自动从 recentWorkspaces 中剔除该条, 进入 empty 状态
 */

import styles from './RecentWorkspacesList.module.css';

export interface RecentWorkspacesListProps {
  recents:  string[];
  onSelect: (path: string) => void;
  onRemove: (path: string) => void;
}

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.slice(-2).join('/');
}

export function RecentWorkspacesList({ recents, onSelect, onRemove }: RecentWorkspacesListProps) {
  if (recents.length === 0) return null;

  const display = recents.slice(0, 5);

  return (
    <ul className={styles.list}>
      {display.map(path => (
        <li key={path} className={styles.item}>
          <button
            className={styles.pathBtn}
            onClick={() => onSelect(path)}
            title={path}
          >
            {shortPath(path)}
          </button>
          <button
            className={styles.removeBtn}
            onClick={e => { e.stopPropagation(); onRemove(path); }}
            title="Remove from recents"
            aria-label={`Remove ${path}`}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

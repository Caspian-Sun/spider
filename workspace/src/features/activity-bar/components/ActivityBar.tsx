/**
 * @description 左侧 48px 固定导航栏：λ logo + 6 个导航按钮 + bugs 徽章 + settings 底部固定
 * @module features/activity-bar/components/ActivityBar
 * @dependencies useActivityBarStore, useWorkspaceStore, constants
 * @prd docs/prds/claude-workflow-kanban.md#Activity-Bar
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T005
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.activity-bar .ab-logo .ab-item .ab-spacer)
 * @rules
 *   - Activity Bar 固定在屏幕最左侧，宽 48px，高度占满全屏，不随内容滚动，z-index: 95
 *   - 顶部显示 λ logo（绿色，18px mono 字体，32×32px 区域），logo 下方依次排列 6 个导航按钮：看板（board）/ 需求（prd）/ 任务（tasks）/ 缺陷（bugs）/ 文档（docs）/ 设置（settings）
 *   - 激活按钮左侧显示 2px 绿色指示条（::before 伪元素，left: -10px），文字变为 var(--text)
 *   - 未激活按钮颜色为 var(--text-3)，hover 时变为 var(--text) 并显示 var(--bg-2) 背景，圆角 4px
 *   - 缺陷（bugs）图标显示当前未修复 bug 数量的红色数字徽章（右上角 14×14px 圆形）
 *   - 设置（settings）按钮固定在 Activity Bar 底部（.ab-spacer 弹性间隔），其余按钮在顶部
 *   - 工作区未加载（empty / invalid 状态）时，除 settings 外其他按钮禁用，徽章不显示
 *   - 切换 activeView 时，主内容区域整体替换，TopBar / PipelineStrip / RetroTimeline 保持挂载不重渲
 */

import styles from './ActivityBar.module.css';
import { useActivityBarStore } from '../stores/useActivityBarStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { ACTIVITY_NAV_ITEMS } from '../constants';
import type { ActivityView } from '../constants';

export function ActivityBar() {
  const { activeView, setView } = useActivityBarStore();
  const { workspace, phase } = useWorkspaceStore();

  const isLoaded = phase === 'ready' && workspace != null;
  const bugCount = workspace?.bugReports.length ?? 0;

  // nav items excluding settings (settings goes to bottom)
  const topItems = ACTIVITY_NAV_ITEMS.filter((item) => item.id !== 'settings');
  const settingsItem = ACTIVITY_NAV_ITEMS.find((item) => item.id === 'settings')!;

  function handleClick(id: ActivityView, disabled: boolean) {
    if (!disabled) setView(id);
  }

  return (
    <nav className={styles.bar} aria-label="Activity Bar">
      <span className={styles.logo} title="Spider">λ</span>

      <div className={styles.navList}>
        {topItems.map((item) => {
          const disabled = item.disableWhenNoWorkspace && !isLoaded;
          const isActive = activeView === item.id;
          const showBadge = item.id === 'bugs' && isLoaded && bugCount > 0;

          return (
            <button
              key={item.id}
              className={`${styles.item} ${isActive ? styles.active : ''}`}
              title={item.label}
              disabled={disabled}
              onClick={() => handleClick(item.id, disabled)}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.icon}
              {showBadge && (
                <span className={styles.badge}>
                  {bugCount > 99 ? '99+' : bugCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.spacer} />

      <button
        className={`${styles.item} ${activeView === 'settings' ? styles.active : ''}`}
        title={settingsItem.label}
        style={{ marginBottom: 8 }}
        onClick={() => setView('settings')}
        aria-current={activeView === 'settings' ? 'page' : undefined}
      >
        {settingsItem.icon}
      </button>
    </nav>
  );
}

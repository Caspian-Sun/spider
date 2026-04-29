/**
 * @description 规则抽屉：右侧滑入，按 P0→P1→P2 分组展示
 * @module features/rules/components/RulesDrawer
 * @dependencies useWorkspaceStore, useDrawerStore
 * @prd docs/prds/claude-workflow-kanban.md#规则管理
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T033
 * @rules
 *   - RulesDrawer 从屏幕右侧滑入, 宽 400px, 外层加背景模糊遮罩 (backdrop-filter: blur(3px))
 *   - 规则列表按 priority 分组并排序 P0 → P1 → P2, 每组可折叠 (默认全展开)
 */

import { useState } from 'react';
import { useDrawerStore } from '@/stores/useLayoutStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { Rule } from '@/types/ipc';
import styles from './RulesDrawer.module.css';

const PRIORITY_ORDER = ['P0', 'P1', 'P2'] as const;
type PriorityKey = typeof PRIORITY_ORDER[number];

const PRIORITY_COLOR: Record<PriorityKey, string> = {
  P0: 'var(--red)',
  P1: 'var(--amber)',
  P2: 'var(--text-3)',
};

export function RulesDrawer() {
  const { open, closeDrawer } = useDrawerStore();
  const { workspace } = useWorkspaceStore();
  const [collapsed, setCollapsed] = useState<Set<PriorityKey>>(new Set());

  const isOpen = open === 'rules';
  if (!isOpen) return null;

  const rules = workspace?.rules ?? [];
  const grouped: Record<PriorityKey, Rule[]> = { P0: [], P1: [], P2: [] };
  for (const rule of rules) {
    const p = (rule.priority as PriorityKey) ?? 'P2';
    grouped[p].push(rule);
  }

  function toggleGroup(p: PriorityKey) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  return (
    <div className={styles.overlay} onClick={closeDrawer}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>规则</span>
          <span className={styles.count}>{rules.length}</span>
          <button className={styles.closeBtn} onClick={closeDrawer}>✕</button>
        </div>

        <div className={styles.body}>
          {PRIORITY_ORDER.map((p) => {
            const group = grouped[p];
            if (group.length === 0) return null;
            const isCollapsed = collapsed.has(p);
            return (
              <div key={p} className={styles.group}>
                <button className={styles.groupHeader} onClick={() => toggleGroup(p)}>
                  <span className={styles.priorityBadge} style={{ color: PRIORITY_COLOR[p] }}>
                    {p}
                  </span>
                  <span className={styles.groupCount}>{group.length}</span>
                  <span className={styles.chevron}>{isCollapsed ? '▶' : '▼'}</span>
                </button>
                {!isCollapsed && group.map((rule) => (
                  <div key={rule.id} className={styles.ruleItem}>
                    <div className={styles.ruleId}>{rule.id}</div>
                    <div className={styles.ruleTitle}>{rule.title}</div>
                    {rule.desc && <div className={styles.ruleDesc}>{rule.desc}</div>}
                  </div>
                ))}
              </div>
            );
          })}
          {rules.length === 0 && (
            <div className={styles.empty}>暂无规则文件</div>
          )}
        </div>
      </div>
    </div>
  );
}

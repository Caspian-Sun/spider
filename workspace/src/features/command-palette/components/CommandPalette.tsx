/**
 * @description ⌘K 命令面板：分组结果 + 键盘 ↑↓ 导航 + Enter 执行 + 空搜索显示最近使用
 * @module features/command-palette/components/CommandPalette
 * @dependencies useWorkspaceStore
 * @prd docs/prds/claude-workflow-kanban.md#命令面板
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T008
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.cmdk-veil .cmdk .cmdk-input .cmdk-result)
 * @rules
 *   - ⌘K 或 TopBar ⌘K 按钮打开命令面板，Esc 关闭
 *   - 遮罩：rgba(0,0,0,0.55) + backdrop-filter: blur(2px) 全屏覆盖
 *   - 面板宽 min(640px, 92vw)，从屏幕上方 96px 处水平居中显示，border-radius 8px
 *   - 顶部搜索输入框（14px mono），打开时自动获焦，placeholder 文字灰色
 *   - 结果按组显示（Commands / PRDs / Tasks / Files），每组有灰色大写组标题
 *   - 每条结果：图标（16px）+ 名称 + 右侧描述（10.5px 灰色）
 *   - 键盘 ↑↓ 导航；激活行：左侧 2px 绿色边框 + var(--bg-3) 背景
 *   - Enter 执行选中条目（运行命令 / 打开文件 / 跳转泳道）
 *   - 面板底部显示键盘快捷键提示：↑↓ 导航 / ↵ 执行 / Esc 关闭
 *   - 搜索内容为空时，显示最近使用记录
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import styles from './CommandPalette.module.css';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ResultItem {
  id: string;
  group: 'Commands' | 'PRDs' | 'Tasks' | 'Files';
  icon: string;
  name: string;
  desc: string;
  action: () => void;
}

const RECENT_KEY = 'cmdk-recent';
const MAX_RECENT = 8;

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function saveRecent(name: string) {
  const list = [name, ...loadRecent().filter((n) => n !== name)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { workspace } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build result list from workspace data
  const allItems: ResultItem[] = [];

  (workspace?.commands ?? []).forEach((cmd) => {
    allItems.push({
      id: `cmd-${cmd.id}`,
      group: 'Commands',
      icon: '/',
      name: `/${cmd.cmd}`,
      desc: cmd.desc ?? '',
      action: () => { saveRecent(`/${cmd.cmd}`); onClose(); },
    });
  });

  (workspace?.prds ?? []).forEach((prd: { id: string; title?: string }) => {
    allItems.push({
      id: `prd-${prd.id}`,
      group: 'PRDs',
      icon: '📄',
      name: prd.title ?? prd.id,
      desc: prd.id,
      action: () => { saveRecent(prd.title ?? prd.id); onClose(); },
    });
  });

  (workspace?.tasks ?? []).flatMap((m) => m.tasks).forEach((task) => {
    allItems.push({
      id: `task-${task.id}`,
      group: 'Tasks',
      icon: '✓',
      name: task.title,
      desc: task.id,
      action: () => { saveRecent(task.title); onClose(); },
    });
  });

  const q = query.trim().toLowerCase();
  const recent = loadRecent();

  const filtered: ResultItem[] =
    q === ''
      ? allItems.filter((item) => recent.includes(item.name)).slice(0, MAX_RECENT)
      : allItems.filter(
          (item) =>
            item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
        );

  // Group for display
  const groups: Array<{ title: string; items: ResultItem[] }> = [];
  const groupOrder: ResultItem['group'][] = ['Commands', 'PRDs', 'Tasks', 'Files'];
  groupOrder.forEach((g) => {
    const items = filtered.filter((i) => i.group === g);
    if (items.length) groups.push({ title: g, items });
  });
  const flatItems = groups.flatMap((g) => g.items);

  // Reset highlight on query change
  useEffect(() => setHighlighted(0), [query]);

  // Auto-focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setHighlighted(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        flatItems[highlighted]?.action();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [flatItems, highlighted, onClose]
  );

  if (!isOpen) return null;

  let flatIdx = 0;

  return (
    <div className={styles.veil} onClick={onClose}>
      <div
        className={styles.palette}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.inputRow}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="输入命令、PRD 或文件名…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.results}>
          {groups.length === 0 && (
            <div style={{ padding: '12px 14px', color: 'var(--text-3)', fontSize: 12 }}>
              无匹配结果
            </div>
          )}
          {groups.map((group) => (
            <div key={group.title}>
              <div className={styles.groupTitle}>{group.title}</div>
              {group.items.map((item) => {
                const idx = flatIdx++;
                return (
                  <div
                    key={item.id}
                    className={`${styles.resultItem} ${idx === highlighted ? styles.highlighted : ''}`}
                    onClick={item.action}
                    onMouseEnter={() => setHighlighted(idx)}
                  >
                    <span className={styles.resultIcon}>{item.icon}</span>
                    <span className={styles.resultName}>{item.name}</span>
                    <span className={styles.resultDesc}>{item.desc}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}><kbd>↑↓</kbd> 导航</span>
          <span className={styles.hint}><kbd>↵</kbd> 执行</span>
          <span className={styles.hint}><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}

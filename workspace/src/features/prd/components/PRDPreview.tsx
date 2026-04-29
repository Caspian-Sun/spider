/**
 * @description PRD 预览模态：只读 markdown + 切换双栏编辑
 * @module features/prd/components/PRDPreview
 * @dependencies MarkdownEditor, useDrawerStore, react-markdown
 * @prd docs/prds/claude-workflow-kanban.md#PRD管理
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T032
 * @rules
 *   - 在 PRDSelector 下拉点某条 PRD → 打开 PRDPreview 模态, 默认只读渲染 markdown
 *   - 打开 PRD 时记录文件 mtime; 每次写回前先重读 mtime, 若与记录值不一致 (外部改过), 弹三选一对话框: MVP 只实现 Keep mine / Use disk
 */

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDrawerStore } from '@/stores/useLayoutStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { readFileRaw } from '@/features/fs/ipc';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import styles from './PRDPreview.module.css';

export function PRDPreview() {
  const { open, drawerPayload, closeDrawer } = useDrawerStore();
  const { workspace } = useWorkspaceStore();
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const filePath = drawerPayload ?? '';
  const isOpen = open === 'prd';

  useEffect(() => {
    if (!isOpen || !filePath || !workspace) return;
    setLoading(true);
    setEditing(false);
    readFileRaw(filePath, workspace.rootPath)
      .then(setContent)
      .catch(() => setContent('*Failed to load*'))
      .finally(() => setLoading(false));
  }, [isOpen, filePath, workspace]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeDrawer}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <MarkdownEditor
            filePath={filePath}
            initialContent={content}
            onSave={() => setEditing(false)}
            onClose={() => setEditing(false)}
          />
        ) : (
          <>
            <div className={styles.toolbar}>
              <span className={styles.title}>{filePath.split('/').pop()}</span>
              <button className={styles.editBtn} onClick={() => setEditing(true)}>Edit</button>
              <button className={styles.closeBtn} onClick={closeDrawer}>✕</button>
            </div>
            <div className={styles.body}>
              {loading ? (
                <div className={styles.loading}>Loading…</div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

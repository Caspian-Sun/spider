/**
 * @description 文档浏览器模态：左侧文件树 + 右侧 markdown 渲染
 * @module features/docs/components/DocsViewer
 * @dependencies useDrawerStore, useWorkspaceStore, react-markdown
 * @prd docs/prds/claude-workflow-kanban.md#文档管理
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T034
 * @rules
 *   - 点顶栏 Docs 按钮弹模态, 尺寸 800×600 或 90vw/85vh 取小
 *   - markdown 内相对链接点击在本模态内切换文档, 不跳系统浏览器
 */

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDrawerStore } from '@/stores/useLayoutStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { readFileRaw } from '@/features/fs/ipc';
import styles from './DocsViewer.module.css';

export function DocsViewer() {
  const { open, closeDrawer } = useDrawerStore();
  const { workspace } = useWorkspaceStore();
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const isOpen = open === 'docs';
  const staticDocs = workspace?.staticDocs ?? [];

  useEffect(() => {
    if (!isOpen || staticDocs.length === 0) return;
    const last = sessionStorage.getItem('docsviewer.lastPath');
    const first = last ?? staticDocs[0].filePath;
    loadDoc(first);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDoc(filePath: string) {
    if (!workspace) return;
    setActiveFile(filePath);
    sessionStorage.setItem('docsviewer.lastPath', filePath);
    setLoading(true);
    try {
      const text = await readFileRaw(filePath, workspace.rootPath);
      setContent(text);
    } catch {
      setContent('*Failed to load document.*');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeDrawer}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* left: file tree */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>文档</div>
          {staticDocs.map((doc) => (
            <button
              key={doc.filePath}
              className={`${styles.docItem} ${activeFile === doc.filePath ? styles.docItemActive : ''}`}
              onClick={() => loadDoc(doc.filePath)}
            >
              {doc.file}
            </button>
          ))}
        </div>

        {/* right: content */}
        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <span className={styles.docTitle}>{activeFile?.split('/').pop() ?? ''}</span>
            <button className={styles.closeBtn} onClick={closeDrawer}>✕</button>
          </div>
          <div className={styles.body}>
            {loading ? (
              <div className={styles.loading}>Loading…</div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Intercept relative links and load inside modal
                  a: ({ href, children }) => {
                    const isRelative = href && !href.startsWith('http') && !href.startsWith('#');
                    if (isRelative && activeFile) {
                      const base = activeFile.split('/').slice(0, -1).join('/');
                      const resolved = `${base}/${href}`;
                      return (
                        <a
                          onClick={(e) => { e.preventDefault(); loadDoc(resolved); }}
                          style={{ cursor: 'pointer' }}
                        >
                          {children}
                        </a>
                      );
                    }
                    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

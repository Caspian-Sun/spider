/**
 * @description 双栏 Markdown 编辑器：左 textarea + 右实时预览
 * @module components/MarkdownEditor
 * @dependencies react-markdown, remark-gfm
 * @prd docs/prds/claude-workflow-kanban.md#文档编辑
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T031
 * @rules
 *   - MVP 编辑器使用 <textarea> + 实时 react-markdown 预览, v2 换 CodeMirror 6
 *   - 编辑态 ⌘S / Ctrl+S 调 write_file(filePath, content), 成功 toast「Saved」, 失败 toast「Save failed: {reason}」
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToastStore } from '@/stores/useLayoutStore';
import { writeFile } from '@/features/fs/ipc';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import styles from './MarkdownEditor.module.css';

export interface MarkdownEditorProps {
  filePath: string;
  initialContent: string;
  onSave?: () => void;
  onClose?: () => void;
}

// Detect git merge conflict markers
const CONFLICT_RE = /^<{7}|^={7}|^>{7}/m;

export function MarkdownEditor({ filePath, initialContent, onSave, onClose }: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [dirty, setDirty] = useState(false);
  const [readOnly] = useState(() => CONFLICT_RE.test(initialContent));
  const { addToast } = useToastStore();
  const { workspace } = useWorkspaceStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const save = useCallback(async () => {
    if (!workspace) return;
    try {
      await writeFile(filePath, workspace.rootPath, content);
      setDirty(false);
      addToast('Saved', 'success');
      onSave?.();
    } catch (e) {
      addToast(`Save failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }, [content, filePath, workspace, addToast, onSave]);

  function handleClose() {
    if (dirty) {
      if (!window.confirm('放弃未保存的修改？')) return;
    }
    onClose?.();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        save().then(onClose);
      }
      if (e.key === 'Escape') {
        handleClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        {dirty && <span className={styles.dirtyDot} title="Unsaved changes" />}
        {readOnly && <span className={styles.conflictBadge}>⚠ Conflict — read-only</span>}
        <span className={styles.filePath}>{filePath}</span>
        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={save} disabled={readOnly || !dirty}>
            Save ⌘S
          </button>
          <button className={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>
      </div>

      <div className={styles.panes}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={content}
          readOnly={readOnly}
          onChange={(e) => { setContent(e.target.value); setDirty(true); }}
          spellCheck={false}
        />
        <div className={styles.preview}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

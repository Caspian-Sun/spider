/**
 * @description 通用看板列 — 标题就地编辑，× 删除（含卡片时弹确认），宽度随 Tweaks
 * @module features/generic-board/components
 * @dependencies useGenericBoardStore, useLayoutStore
 * @prd docs/prds/claude-workflow-kanban.md#通用看板视图
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T051
 * @rules
 *   - 列宽根据 Tweaks 中 columnWidth (narrow=240px / standard=320px / wide=440px) 全局生效
 *   - 列右上 × 删除该列; 若列内有卡片, 弹确认对话框「Delete N cards or move them to backlog?」
 *   - 系统预置 4 列, id / title / color 固定: backlog/ready/running/done; 用户可重命名 title, 不能改 id 与 color token
 */

import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { GenericColumn as GenericColumnType } from '@/types/ipc';
import { useLayoutStore } from '@/stores/useLayoutStore';
import styles from './GenericColumn.module.css';

const COLUMN_WIDTH: Record<'narrow' | 'standard' | 'wide', number> = {
  narrow:   240,
  standard: 320,
  wide:     440,
};

export interface GenericColumnProps {
  column:    GenericColumnType;
  cardCount: number;
  isPreset:  boolean;
  onRename:  (title: string) => void;
  onDelete:  () => void;
  children?: ReactNode;
}

export function GenericColumn({ column, cardCount, isPreset: _isPreset, onRename, onDelete, children }: GenericColumnProps) {
  const columnWidth = useLayoutStore(s => s.tweaks.columnWidth);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.title);
  const [titleError, setTitleError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitRename() {
    if (draft.trim() === '') {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    onRename(draft.trim());
    setEditing(false);
  }

  function handleDeleteClick() {
    if (cardCount > 0) {
      setConfirmDelete(true);
    } else {
      onDelete();
    }
  }

  const width = COLUMN_WIDTH[columnWidth];

  return (
    <div className={styles.column} style={{ width, minWidth: width }}>
      <div className={styles.header}>
        <div className={styles.colorDot} style={{ background: column.color }} />

        {editing ? (
          <div className={styles.titleEdit}>
            <input
              ref={inputRef}
              className={`${styles.titleInput} ${titleError ? styles.inputError : ''}`}
              value={draft}
              onChange={e => { setDraft(e.target.value); setTitleError(false); }}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setEditing(false); setDraft(column.title); }
              }}
            />
            {titleError && <span className={styles.inlineError}>Title cannot be empty</span>}
          </div>
        ) : (
          <span
            className={styles.title}
            onDoubleClick={() => { setDraft(column.title); setEditing(true); }}
            title="Double-click to rename"
          >
            {column.title}
          </span>
        )}

        <span className={styles.count}>{cardCount}</span>
        <button className={styles.deleteBtn} onClick={handleDeleteClick} title="Delete column">×</button>
      </div>

      <div
        className={styles.body}
        data-col-id={column.id}
      >
        {children}
      </div>

      {confirmDelete && (
        <div className={styles.confirmOverlay} onClick={e => e.stopPropagation()}>
          <p>Delete {cardCount} card{cardCount !== 1 ? 's' : ''} or move them to backlog?</p>
          <div className={styles.confirmBtns}>
            <button className={styles.btnDelete} onClick={() => { onDelete(); setConfirmDelete(false); }}>
              Delete all
            </button>
            <button className={styles.btnMove} onClick={() => { onDelete(); setConfirmDelete(false); }}>
              Move to backlog
            </button>
            <button className={styles.btnCancel} onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @description 通用看板容器 — 列横排 + 跨列拖拽 + "+ Column" 按钮
 * @module features/generic-board/components
 * @dependencies useGenericBoardStore, useWorkspaceStore, GenericColumn, GenericCard
 * @prd docs/prds/claude-workflow-kanban.md#通用看板视图
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T053
 * @rules
 *   - Layout 切换为 generic 时, Board 区域改用通用看板, PipelineStrip 隐藏
 *   - 切回 Workflow 视图时, generic 卡片对应的 PTY 不被销毁 (后台保活)
 *   - 拖到自己所在列视为无操作, 不写盘, 不闪屏
 */

import { useEffect, useState } from 'react';
import { useGenericBoardStore } from '@/stores/useGenericBoardStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { GenericColumn } from './GenericColumn';
import { GenericCard }   from './GenericCard';
import styles from './GenericBoard.module.css';

const PRESET_IDS = new Set(['backlog', 'ready', 'running', 'done']);

export function GenericBoard() {
  const workspace = useWorkspaceStore(s => s.workspace);
  const { board, load, addCard, removeCard, moveCard, addColumn, removeColumn, renameColumn } = useGenericBoardStore();

  const [addingCol, setAddingCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');

  useEffect(() => {
    if (workspace?.rootPath) load(workspace.rootPath);
  }, [workspace?.rootPath, load]);

  function handleDragOver(e: React.DragEvent<HTMLElement>, _colId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    (e.currentTarget as HTMLElement).classList.add('drop-active');
  }

  function handleDragLeave(e: React.DragEvent<HTMLElement>) {
    (e.currentTarget as HTMLElement).classList.remove('drop-active');
  }

  function handleDrop(e: React.DragEvent, colId: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drop-active');
    const cardId = e.dataTransfer.getData('genericCardId');
    if (!cardId) return;
    moveCard(cardId, colId); // no-op if same col (store checks)
  }

  function handleAddColumn() {
    if (!newColTitle.trim()) return;
    const id = newColTitle.trim().toLowerCase().replace(/\s+/g, '-');
    addColumn({ id, title: newColTitle.trim(), color: 'var(--line-2)' });
    setNewColTitle('');
    setAddingCol(false);
  }

  if (!board) return <div className={styles.loading}>Loading board…</div>;

  return (
    <div className={styles.board}>
      {board.columns.map(col => {
        const colCards = board.cards.filter(c => c.col === col.id);
        return (
          <GenericColumn
            key={col.id}
            column={col}
            cardCount={colCards.length}
            isPreset={PRESET_IDS.has(col.id)}
            onRename={title => renameColumn(col.id, title)}
            onDelete={() => removeColumn(col.id, true)}
          >
            <div
              className={styles.dropZone}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
            >
              {colCards.map(card => (
                <GenericCard
                  key={card.id}
                  card={card}
                  onMove={moveCard}
                  onDelete={cardId => removeCard(cardId)}
                />
              ))}
            </div>

            <button
              className={styles.addCardBtn}
              onClick={() => addCard({
                id:           `card-${Date.now()}`,
                col:          col.id,
                title:        'New card',
                desc:         '',
                status:       'idle',
                bootCommands: [],
              })}
            >
              + Card
            </button>
          </GenericColumn>
        );
      })}

      <div className={styles.addColSection}>
        {addingCol ? (
          <div className={styles.addColForm}>
            <input
              className={styles.addColInput}
              placeholder="Column title"
              value={newColTitle}
              onChange={e => setNewColTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setAddingCol(false); }}
              autoFocus
            />
            <button className={styles.addColConfirm} onClick={handleAddColumn}>Add</button>
            <button className={styles.addColCancel} onClick={() => setAddingCol(false)}>✕</button>
          </div>
        ) : (
          <button className={styles.addColBtn} onClick={() => setAddingCol(true)}>+ Column</button>
        )}
      </div>
    </div>
  );
}

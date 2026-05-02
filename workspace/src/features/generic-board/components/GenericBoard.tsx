/**
 * @description 通用看板容器 — 4 默认列 + 跨列拖拽 + 200ms debounce 持久化 + "+ Column" 按钮
 * @module features/generic-board/components
 * @dependencies useGenericBoardStore, useWorkspaceStore, GenericColumn, GenericCard
 * @prd docs/prds/claude-workflow-kanban.md#通用看板
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-05-02.json#T017
 * @design docs/designs/claude-workflow-kanban/wf-app.jsx (GenericBoard 组件)
 * @rules
 *   - 通过 TopBar Layout Toggle 切换到 generic 模式，PipelineStrip 隐藏，Board 切换为通用看板
 *   - 通用看板数据持久化到工作区 .claude/.kanban-board.json
 *   - 默认 4 列：Backlog / Ready / Running / Done
 *   - 列可重命名（双击列标题内联编辑），按 Enter 或失焦提交，Esc 恢复原标题
 *   - 列标题提交为空时，显示「Title cannot be empty」错误，不提交更改
 *   - 列宽三档：narrow（240px）/ standard（320px）/ wide（440px），列头部下拉选择
 *   - 删除含卡片的列时，弹确认框「Delete N cards or move them to backlog?」
 *   - 卡片可跨列拖拽（HTML5 DnD），drag-over 时列显示绿色内阴影
 *   - 卡片移入 running 列时，如有 bootCommands，自动依次执行
 *   - 状态变更 200ms debounce 后持久化到 .kanban-board.json
 *   - .kanban-board.json 不存在时，自动创建 4 列默认结构并写入文件
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
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');

  useEffect(() => {
    if (workspace?.rootPath) load(workspace.rootPath);
  }, [workspace?.rootPath, load]);

  function handleDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColId(colId);
  }

  function handleDragLeave(e: React.DragEvent, colId: string) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColId((prev) => (prev === colId ? null : prev));
    }
  }

  function handleDrop(e: React.DragEvent, colId: string) {
    e.preventDefault();
    setDragOverColId(null);
    const cardId = e.dataTransfer.getData('genericCardId');
    if (!cardId) return;
    moveCard(cardId, colId);
  }

  function handleAddColumn() {
    const title = newColTitle.trim();
    if (!title) return;
    const id = title.toLowerCase().replace(/\s+/g, '-');
    addColumn({ id, title, color: 'var(--line-2)' });
    setNewColTitle('');
    setAddingCol(false);
  }

  if (!board) return <div className={styles.loading}>Loading board…</div>;

  return (
    <div className={styles.board}>
      {board.columns.map((col) => {
        const colCards = board.cards.filter((c) => c.col === col.id);
        const isDragOver = dragOverColId === col.id;
        return (
          <GenericColumn
            key={col.id}
            column={col}
            cardCount={colCards.length}
            isPreset={PRESET_IDS.has(col.id)}
            onRename={(title) => renameColumn(col.id, title)}
            onDelete={() => removeColumn(col.id, true)}
          >
            <div
              className={`${styles.dropZone} ${isDragOver ? styles.dropActive : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {colCards.map((card) => (
                <GenericCard
                  key={card.id}
                  card={card}
                  onMove={moveCard}
                  onDelete={(cardId) => removeCard(cardId)}
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
              onChange={(e) => setNewColTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddColumn();
                if (e.key === 'Escape') setAddingCol(false);
              }}
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

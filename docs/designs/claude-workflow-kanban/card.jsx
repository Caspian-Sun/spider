// Terminal Card — a draggable, resizable card wrapping a Terminal.

(function () {
  const { useState, useRef, useEffect } = React;

  function TerminalCard(props) {
    const {
      card, columnId, selected, onSelect, onStatusChange, onTitleChange, onDescChange,
      onDragStart, onDragEnd, onDelete, onFocus, onResize, onDuplicate,
      size, layout, compact,
    } = props;

    const [titleEditing, setTitleEditing] = useState(false);
    const [descEditing, setDescEditing] = useState(false);
    const [menuOpen, setMenuOpen] = useState(null);
    const resizing = useRef(null);
    const ref = useRef(null);

    const onMouseDownHead = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      // Let the native drag API handle it via draggable attr
    };

    const startResize = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const startW = ref.current.offsetWidth;
      const startH = ref.current.offsetHeight;
      const move = (ev) => {
        const w = Math.max(220, startW + (ev.clientX - startX));
        const h = Math.max(160, startH + (ev.clientY - startY));
        onResize(card.id, { w, h });
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    };

    const statusCls = ({
      idle: 'idle', run: 'run', ok: 'ok', err: 'err',
    })[card.status] || 'idle';

    const style = {};
    if (size) {
      style.width = size.w;
      style.height = size.h;
      style.flex = 'none';
    }

    return (
      <div
        ref={ref}
        className={
          'card' +
          (selected ? ' selected' : '') +
          (card.dragging ? ' dragging' : '') +
          (compact ? ' compact' : '')
        }
        style={style}
        draggable={!titleEditing && !descEditing}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', card.id);
          e.dataTransfer.effectAllowed = 'move';
          onDragStart(card.id, columnId, e);
        }}
        onDragEnd={() => onDragEnd(card.id)}
        onClick={(e) => {
          if (e.target.closest('.term-input-row') || e.target.closest('.term-output')) return;
          onSelect(card.id, e.shiftKey || e.metaKey || e.ctrlKey);
        }}
      >
        <div className="card-head" onMouseDown={onMouseDownHead}>
          <span className="lights"><i className="r" /><i className="y" /><i className="g" /></span>
          <div className="title" onDoubleClick={() => setTitleEditing(true)}>
            {titleEditing ? (
              <input
                autoFocus
                value={card.title}
                onChange={(e) => onTitleChange(card.id, e.target.value)}
                onBlur={() => setTitleEditing(false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setTitleEditing(false); }}
              />
            ) : (
              card.title
            )}
          </div>
          <span className={'status ' + statusCls}>{card.status}</span>
          <button
            className="menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              setMenuOpen({ x: r.right, y: r.bottom + 4 });
            }}
            title="Actions"
          >⋯</button>
        </div>

        {!compact && (
          <div className="card-desc" onDoubleClick={() => setDescEditing(true)}>
            {descEditing ? (
              <input
                autoFocus
                value={card.desc}
                onChange={(e) => onDescChange(card.id, e.target.value)}
                onBlur={() => setDescEditing(false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setDescEditing(false); }}
              />
            ) : (
              <span style={{ color: card.desc ? 'var(--text-2)' : 'var(--text-3)' }}>
                {card.desc || 'Double-click to add description'}
              </span>
            )}
          </div>
        )}

        <window.Terminal
          cardId={card.id}
          title={card.title}
          initialCwd={card.cwd}
          onStatusChange={(s) => onStatusChange(card.id, s)}
          compact={compact}
          onBootCommands={card.bootCommands}
        />

        <svg className="resize" viewBox="0 0 14 14" onMouseDown={startResize}>
          <path d="M14,0 L14,14 L0,14 Z" fill="currentColor" opacity="0.15" />
          <path d="M14,6 L6,14 M14,10 L10,14" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>

        {menuOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 199 }}
              onClick={() => setMenuOpen(null)}
            />
            <div className="ctx" style={{ left: menuOpen.x - 150, top: menuOpen.y }}>
              <button onClick={() => { setMenuOpen(null); onFocus(card.id); }}>
                Open fullscreen <span className="hint">F</span>
              </button>
              <button onClick={() => { setMenuOpen(null); onDuplicate(card.id); }}>
                Duplicate <span className="hint">⌘D</span>
              </button>
              <button onClick={() => { setMenuOpen(null); setTitleEditing(true); }}>
                Rename
              </button>
              <div className="sep" />
              <button className="danger" onClick={() => { setMenuOpen(null); onDelete(card.id); }}>
                Delete <span className="hint">⌫</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  window.TerminalCard = TerminalCard;
})();

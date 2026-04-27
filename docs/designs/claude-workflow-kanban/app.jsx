// Main App — kanban board, columns, cards, tweaks, focus overlay.

(function () {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  const COLOR_FOR_COL = {
    backlog: '#6b7280',
    ready:   '#7aa2ff',
    running: '#ffb547',
    done:    '#6ee77f',
    failed:  '#ff6b6b',
  };

  const INITIAL = {
    columns: [
      { id: 'backlog', title: 'Backlog', color: COLOR_FOR_COL.backlog },
      { id: 'ready',   title: 'Ready',   color: COLOR_FOR_COL.ready },
      { id: 'running', title: 'Running', color: COLOR_FOR_COL.running },
      { id: 'done',    title: 'Done',    color: COLOR_FOR_COL.done },
    ],
    cards: [
      { id: 'c1', col: 'backlog', title: 'scrape-prices.py', desc: 'Poll 3 marketplaces every 5 min and dedupe results.', status: 'idle',
        bootCommands: ['ls', 'cat README.md'] },
      { id: 'c2', col: 'backlog', title: 'summarize-threads',  desc: 'Summarize 24h of support threads into a daily digest.', status: 'idle',
        bootCommands: ['pwd'] },
      { id: 'c3', col: 'ready', title: 'nightly-build',   desc: 'Build, package, publish artifact to registry.', status: 'idle',
        bootCommands: ['npm run build'] },
      { id: 'c4', col: 'running', title: 'watch-src',    desc: 'Hot-reload worker rebuilding on file change.', status: 'run',
        bootCommands: ['watch'] },
      { id: 'c5', col: 'running', title: 'ping-monitor',  desc: 'Keep-alive ping against upstream services.', status: 'run',
        bootCommands: ['ping example.com'] },
      { id: 'c6', col: 'done', title: 'migrate-db',  desc: 'One-shot migration v3 → v4.', status: 'ok',
        bootCommands: ['git log'] },
    ],
  };

  function Icon({ name, size = 14 }) {
    const paths = {
      plus: 'M12 5v14M5 12h14',
      x: 'M6 6l12 12M18 6L6 18',
      columns: 'M4 4h5v16H4zM15 4h5v16h-5z',
      sparkles: 'M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z',
      terminal: 'M4 6l4 4-4 4M10 16h8',
      grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
      stack: 'M4 4h16v5H4zM4 11h16v5H4zM4 18h16v3H4z',
    };
    return (
      <svg className="ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[name]} />
      </svg>
    );
  }

  // Tweaks defaults — editable by the host
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "layout": "stack",
    "density": "comfortable",
    "accent": "green",
    "showDescriptions": true,
    "columnWidth": "standard"
  }/*EDITMODE-END*/;

  function App() {
    // Persist small bits
    const [columns, setColumns] = useState(INITIAL.columns);
    const [cards, setCards] = useState(INITIAL.cards);
    const [selected, setSelected] = useState(new Set());
    const [dragging, setDragging] = useState(null); // { id, from }
    const [dropTarget, setDropTarget] = useState(null); // colId
    const [sizes, setSizes] = useState({}); // cardId -> {w,h}
    const [focusId, setFocusId] = useState(null);
    const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
    const [tweaksOpen, setTweaksOpen] = useState(false);
    const [tweaksAllowed, setTweaksAllowed] = useState(true);

    // Restore persisted state
    useEffect(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('tk-state-v1') || 'null');
        if (saved) {
          if (saved.columns) setColumns(saved.columns);
          if (saved.cards) setCards(saved.cards);
          if (saved.sizes) setSizes(saved.sizes);
        }
      } catch (_) {}
    }, []);
    useEffect(() => {
      try { localStorage.setItem('tk-state-v1', JSON.stringify({ columns, cards, sizes })); } catch (_) {}
    }, [columns, cards, sizes]);

    // Tweaks wiring
    useEffect(() => {
      const onMsg = (e) => {
        const d = e.data;
        if (!d || typeof d !== 'object') return;
        if (d.type === '__activate_edit_mode') setTweaksOpen(true);
        if (d.type === '__deactivate_edit_mode') setTweaksOpen(false);
      };
      window.addEventListener('message', onMsg);
      window.parent.postMessage({ type: '__edit_mode_available' }, '*');
      return () => window.removeEventListener('message', onMsg);
    }, []);
    const setTweak = (k, v) => {
      setTweaks(prev => {
        const next = { ...prev, [k]: v };
        window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
        return next;
      });
    };

    const cardsByCol = useMemo(() => {
      const out = {};
      columns.forEach(c => out[c.id] = []);
      cards.forEach(c => { (out[c.col] = out[c.col] || []).push(c); });
      return out;
    }, [cards, columns]);

    // --- Card ops ---
    const addCard = (colId) => {
      const id = 'c' + Math.random().toString(36).slice(2, 7);
      setCards(cs => [...cs, {
        id, col: colId, title: 'new-agent.sh', desc: 'Double-click to describe the job.', status: 'idle',
      }]);
    };
    const deleteCard = (id) => {
      setCards(cs => cs.filter(c => c.id !== id));
      setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    };
    const duplicateCard = (id) => {
      setCards(cs => {
        const src = cs.find(c => c.id === id);
        if (!src) return cs;
        const copy = { ...src, id: 'c' + Math.random().toString(36).slice(2, 7), title: src.title + ' (copy)' };
        const idx = cs.findIndex(c => c.id === id);
        const next = [...cs];
        next.splice(idx + 1, 0, copy);
        return next;
      });
    };
    const updateCard = (id, patch) => {
      setCards(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
    };
    const setStatus = (id, status) => updateCard(id, { status });
    const setTitle = (id, title) => updateCard(id, { title });
    const setDesc = (id, desc) => updateCard(id, { desc });

    // --- Select ---
    const selectCard = (id, additive) => {
      setSelected(s => {
        const n = new Set(s);
        if (additive) {
          if (n.has(id)) n.delete(id); else n.add(id);
        } else {
          n.clear(); n.add(id);
        }
        return n;
      });
    };
    useEffect(() => {
      const onDown = (e) => {
        if (e.key === 'Escape') {
          setSelected(new Set());
          setFocusId(null);
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size && !e.target.matches('input,textarea')) {
          e.preventDefault();
          selected.forEach(id => deleteCard(id));
        }
      };
      window.addEventListener('keydown', onDown);
      return () => window.removeEventListener('keydown', onDown);
    }, [selected]);

    // --- Drag ---
    const onDragStart = (id, from) => { setDragging({ id, from }); };
    const onDragEnd = () => { setDragging(null); setDropTarget(null); };
    const onColDragOver = (e, colId) => {
      if (!dragging) return;
      e.preventDefault();
      setDropTarget(colId);
    };
    const onColDrop = (e, colId) => {
      e.preventDefault();
      if (!dragging) return;
      const ids = selected.has(dragging.id) && selected.size > 1 ? Array.from(selected) : [dragging.id];
      setCards(cs => cs.map(c => ids.includes(c.id) ? { ...c, col: colId } : c));
      setDragging(null); setDropTarget(null);
    };

    // --- Columns ---
    const addColumn = () => {
      const id = 'col-' + Math.random().toString(36).slice(2, 7);
      const palette = ['#7aa2ff', '#c39bff', '#ffb547', '#6ee77f', '#ff6b6b'];
      setColumns(cs => [...cs, { id, title: 'New Lane', color: palette[cs.length % palette.length] }]);
    };
    const deleteColumn = (colId) => {
      setColumns(cs => cs.filter(c => c.id !== colId));
      setCards(cs => cs.filter(c => c.col !== colId));
    };
    const renameColumn = (colId, title) => {
      setColumns(cs => cs.map(c => c.id === colId ? { ...c, title } : c));
    };

    // --- Focus overlay ---
    const focused = focusId ? cards.find(c => c.id === focusId) : null;

    // --- Render ---
    const wideCls = tweaks.columnWidth === 'wide' ? 'wide' : tweaks.columnWidth === 'narrow' ? 'narrow' : '';
    const compact = tweaks.density === 'compact';

    return (
      <React.Fragment>
        {/* Top bar */}
        <div className="topbar">
          <div className="brand"><span className="dot" /> AGENT&nbsp;BOARD</div>
          <div className="path"><b>~/workspace</b> · {cards.length} agents · {columns.length} lanes</div>
          <div className="spacer" />
          <div className="chip">
            <span style={{ color: 'var(--green)' }}>●</span> {cards.filter(c => c.status === 'run').length} running
          </div>
          <div className="chip">
            <kbd>⇧</kbd> multi-select · <kbd>⌫</kbd> delete · <kbd>Esc</kbd> clear
          </div>
          <button className="btn" onClick={addColumn}><Icon name="columns" />Add lane</button>
          <button className="btn primary" onClick={() => addCard(columns[0]?.id)}><Icon name="plus" />New agent</button>
        </div>

        {/* Board */}
        <div className="board">
          {columns.map(col => {
            const colCards = cardsByCol[col.id] || [];
            const isDropTarget = dropTarget === col.id;
            return (
              <div key={col.id} className={'col ' + wideCls}>
                <div className="col-head">
                  <span className="pill" style={{ background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
                  <ColumnTitle title={col.title} onChange={(t) => renameColumn(col.id, t)} />
                  <span className="count">{colCards.length}</span>
                  <span className="flex" />
                  <button className="icon-btn" title="Add agent" onClick={() => addCard(col.id)}><Icon name="plus" size={13} /></button>
                  <button className="icon-btn" title="Delete lane" onClick={() => deleteColumn(col.id)}><Icon name="x" size={13} /></button>
                </div>
                <div
                  className={
                    'col-body' +
                    (isDropTarget ? ' drop-active' : '') +
                    (tweaks.layout === 'grid' ? ' grid-layout' : '')
                  }
                  onDragOver={(e) => onColDragOver(e, col.id)}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => onColDrop(e, col.id)}
                >
                  {colCards.map(card => (
                    <window.TerminalCard
                      key={card.id}
                      card={card}
                      columnId={col.id}
                      selected={selected.has(card.id)}
                      size={sizes[card.id]}
                      compact={compact}
                      layout={tweaks.layout}
                      onSelect={selectCard}
                      onStatusChange={setStatus}
                      onTitleChange={setTitle}
                      onDescChange={setDesc}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDelete={deleteCard}
                      onDuplicate={duplicateCard}
                      onFocus={setFocusId}
                      onResize={(id, sz) => setSizes(s => ({ ...s, [id]: sz }))}
                    />
                  ))}
                  {colCards.length === 0 && (
                    <div style={{
                      color: 'var(--text-3)',
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      textAlign: 'center',
                      padding: '18px 8px',
                      border: '1px dashed var(--line)',
                      borderRadius: 6,
                    }}>
                      — empty lane —<br />drop agents here
                    </div>
                  )}
                </div>
                <div className="col-foot">
                  <button className="add-agent" onClick={() => addCard(col.id)}>
                    <Icon name="plus" size={12} /> spawn terminal in {col.title.toLowerCase()}
                  </button>
                </div>
              </div>
            );
          })}
          <div style={{ flex: '0 0 40px' }} />
        </div>

        {/* Focus overlay */}
        {focused && (
          <div className="focus-veil" onClick={() => setFocusId(null)}>
            <div className="focus-box" onClick={(e) => e.stopPropagation()}>
              <div className="card-head" style={{ borderBottom: '1px solid var(--line)' }}>
                <span className="lights"><i className="r" /><i className="y" /><i className="g" /></span>
                <div className="title">{focused.title}</div>
                <span className={'status ' + (focused.status || 'idle')}>{focused.status}</span>
                <button className="menu-btn" onClick={() => setFocusId(null)} title="Close">✕</button>
              </div>
              <div style={{ flex: 1, display: 'flex' }}>
                <window.Terminal
                  cardId={focused.id + '-focus'}
                  title={focused.title}
                  initialCwd={focused.cwd}
                  onStatusChange={(s) => setStatus(focused.id, s)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tweaks */}
        {tweaksOpen && (
          <div className="tweaks">
            <h4>TWEAKS · DIRECTIONS</h4>
            <div className="row">
              <div className="label">Layout</div>
              <div className="seg">
                <button className={tweaks.layout === 'stack' ? 'active' : ''} onClick={() => setTweak('layout', 'stack')}>Stack</button>
                <button className={tweaks.layout === 'grid' ? 'active' : ''} onClick={() => setTweak('layout', 'grid')}>Grid</button>
              </div>
            </div>
            <div className="row">
              <div className="label">Density</div>
              <div className="seg">
                <button className={tweaks.density === 'comfortable' ? 'active' : ''} onClick={() => setTweak('density', 'comfortable')}>Comfort</button>
                <button className={tweaks.density === 'compact' ? 'active' : ''} onClick={() => setTweak('density', 'compact')}>Compact</button>
              </div>
            </div>
            <div className="row">
              <div className="label">Column width</div>
              <div className="seg">
                <button className={tweaks.columnWidth === 'narrow' ? 'active' : ''} onClick={() => setTweak('columnWidth', 'narrow')}>S</button>
                <button className={tweaks.columnWidth === 'standard' ? 'active' : ''} onClick={() => setTweak('columnWidth', 'standard')}>M</button>
                <button className={tweaks.columnWidth === 'wide' ? 'active' : ''} onClick={() => setTweak('columnWidth', 'wide')}>L</button>
              </div>
            </div>
            <div className="row">
              <button
                className="add-agent"
                onClick={() => { localStorage.removeItem('tk-state-v1'); location.reload(); }}
                style={{ border: '1px solid var(--line)' }}
              >
                reset board
              </button>
            </div>
          </div>
        )}
      </React.Fragment>
    );
  }

  function ColumnTitle({ title, onChange }) {
    const [editing, setEditing] = useState(false);
    return editing ? (
      <input
        autoFocus
        defaultValue={title}
        onBlur={(e) => { onChange(e.target.value || title); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
        style={{
          background: 'transparent', border: '1px solid var(--line)', borderRadius: 4,
          color: 'inherit', font: 'inherit', padding: '1px 6px', textTransform: 'uppercase',
          letterSpacing: '0.08em', fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)',
          outline: 'none',
        }}
      />
    ) : (
      <span className="title" onDoubleClick={() => setEditing(true)}>{title}</span>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
})();

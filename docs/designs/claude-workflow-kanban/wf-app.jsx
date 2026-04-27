// Workflow DAG kanban — maps .claude/commands/* to lanes with main + sub agents.

(function () {
  const { useState, useEffect, useMemo, useRef } = React;

  // ─── Workflow schema: 8 main lanes + 2 helpers ────────────────
  // Each lane: main command + sub agents/skills/hooks that naturally fire in that step.
  const LANES = [
    {
      id: 'prd', idx: 1, cmd: 'prd',
      title: 'Requirements',
      desc: 'Spoken requirement → Structured PRD with [TBD] placeholders.',
      inputs: [], outputs: ['PRD.md'],
      gate: { cmd: 'prd-check', label: 'PRD-CHECK · placeholders' },
      agents: [
        { kind: 'main',  name: '/prd',         desc: 'Drafts the PRD.', auto: true },
        { kind: 'main',  name: '/prd-check',   desc: 'Hard gate — zero out [TBD].', auto: false },
      ],
    },
    {
      id: 'plan', idx: 2, cmd: 'plan',
      title: 'Breakdown',
      desc: 'PRD → Task manifest (prdRef + @rules bindings).',
      inputs: ['PRD.md'], outputs: ['tasks.json'],
      gate: { cmd: 'plan-check', label: 'PLAN-CHECK · DAG valid' },
      agents: [
        { kind: 'main',  name: '/plan',        desc: 'Decompose into tasks.', auto: true },
        { kind: 'main',  name: '/plan-check',  desc: 'Gate — DAG + traceability.', auto: false },
      ],
    },
    {
      id: 'code', idx: 3, cmd: 'code',
      title: 'Implementation',
      desc: 'Task manifest → code artifact with @prd/@task/@rules header.',
      inputs: ['tasks.json'], outputs: ['src/*.ts'],
      agents: [
        { kind: 'main',  name: '/code',              desc: 'Writes code per task.', auto: true },
        { kind: 'sub',   name: 'test-writer',        desc: 'Parallel: @rules → it().', auto: false },
        { kind: 'hook',  name: 'check-hardcode',     desc: 'Silent guard — no magic nums.', auto: true },
      ],
    },
    {
      id: 'test', idx: 4, cmd: 'test',
      title: 'Verification',
      desc: '@rules → it() cases (one per rule, name quotes the rule).',
      inputs: ['src/*.ts'], outputs: ['*.test.ts'],
      agents: [
        { kind: 'main',  name: '/test',         desc: 'Drives test generation.', auto: true },
        { kind: 'sub',   name: 'test-writer',   desc: 'Parallel per module.', auto: true },
        { kind: 'sub',   name: 'test-writer',   desc: 'Parallel per module.', auto: false },
      ],
    },
    {
      id: 'review', idx: 5, cmd: 'review',
      title: 'Audit',
      desc: 'Independent-perspective review of the diff.',
      inputs: ['*.test.ts'], outputs: ['review.md'],
      agents: [
        { kind: 'main',  name: '/review',          desc: 'Coordinates review.', auto: true },
        { kind: 'sub',   name: 'code-reviewer',    desc: 'Read-only subagent.', auto: true },
        { kind: 'skill', name: 'ext-a11y-check',   desc: 'WCAG AA quick scan.', auto: false },
      ],
    },
    {
      id: 'build', idx: 6, cmd: 'build',
      title: 'Productization',
      desc: 'Type-check · bundle · minify → dist/',
      inputs: ['review.md'], outputs: ['dist/'],
      agents: [
        { kind: 'main',  name: '/build',          desc: 'Runs the build.', auto: true },
        { kind: 'skill', name: 'ext-dep-audit',   desc: 'Audit outdated deps.', auto: false },
      ],
    },
    {
      id: 'deploy', idx: 7, cmd: 'deploy',
      title: 'Delivery',
      desc: 'Push artifact to target environment.',
      inputs: ['dist/'], outputs: ['env: prod'],
      agents: [
        { kind: 'main',  name: '/deploy',         desc: 'Rollout + health-check.', auto: true },
        { kind: 'skill', name: 'ext-perf-audit',  desc: 'Post-deploy perf check.', auto: false },
      ],
    },
    {
      id: 'release', idx: 8, cmd: 'release',
      title: 'Release',
      desc: 'Aggregate changelog + cut tag.',
      inputs: ['env: prod'], outputs: ['tag v*'],
      agents: [
        { kind: 'main',  name: '/release',        desc: 'Tag + publish.', auto: true },
        { kind: 'skill', name: 'ext-changelog',   desc: 'Aggregate commits.', auto: true },
      ],
    },
  ];

  const HELPERS = [
    {
      id: 'fix', cmd: 'fix', title: 'Hotfix loop', helper: true,
      desc: 'Bug-report → parallel patches. Loops back into /test.',
      inputs: ['bug-report.md'], outputs: ['patch'],
      agents: [
        { kind: 'main',  name: '/fix',         desc: 'Orchestrates fixes.', auto: true },
        { kind: 'sub',   name: 'bug-fixer',    desc: 'One per bug, parallel.', auto: true },
        { kind: 'sub',   name: 'bug-fixer',    desc: 'One per bug, parallel.', auto: false },
      ],
    },
    {
      id: 'meta', cmd: 'meta-audit', title: 'Meta-audit', helper: true,
      desc: 'God-view scan for drift / dead references. Writes retro.',
      inputs: ['<entire repo>'], outputs: ['retrospectives/'],
      agents: [
        { kind: 'main',  name: '/meta-audit',  desc: 'Triggers the audit.', auto: true },
        { kind: 'sub',   name: 'meta-auditor', desc: 'Isolated ctx scan.', auto: true },
      ],
    },
  ];

  function Icon({ name, size = 14 }) {
    const p = {
      plus: 'M12 5v14M5 12h14',
      x: 'M6 6l12 12M18 6L6 18',
      play: 'M6 4l14 8-14 8z',
      flow: 'M4 6h6a4 4 0 014 4v4a4 4 0 004 4h2',
      grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
      expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    };
    return (
      <svg className="ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={p[name]} />
      </svg>
    );
  }

  function uid() { return 'a' + Math.random().toString(36).slice(2, 7); }

  // Build initial agent instances from the schema
  function buildInitialAgents() {
    const out = {};
    [...LANES, ...HELPERS].forEach(lane => {
      out[lane.id] = lane.agents.map((a, i) => ({
        id: uid(),
        lane: lane.id,
        kind: a.kind,
        name: a.name,
        desc: a.desc,
        status: 'idle',
        auto: a.auto,
      }));
    });
    return out;
  }

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "density": "comfortable",
    "showHelpers": true,
    "autoPlay": false
  }/*EDITMODE-END*/;

  // .claude/rules/* mapped + simulated violations per lane
  const RULES = [
    { id: 'no-hardcode',   p: 'P0', title: 'No Hardcoding',      desc: 'All values via config / tokens / i18n. Never hardcoded.',  lanes: ['code','review'] },
    { id: 'file-docs',     p: 'P1', title: 'File Documentation', desc: 'JSDoc header with @prd/@task/@rules. README in sync.',    lanes: ['code','review'] },
    { id: 'coding-style',  p: 'P1', title: 'Coding Style',       desc: 'PascalCase / use-prefix hooks / no `any` / no inline.',   lanes: ['code','review'] },
    { id: 'tech-stack',    p: 'P1', title: 'Tech Stack',         desc: 'UmiJS 4 + React 18 + antd 5. No duplicate deps.',         lanes: ['build'] },
    { id: 'testing',       p: 'P1', title: 'Testing',            desc: 'One it() per @rules. MSW only. Mirror src structure.',   lanes: ['test','review'] },
  ];
  // Simulated violations surfaced by hooks/reviewers
  const SEED_VIOLATIONS = [
    { rule: 'no-hardcode',  file: 'src/features/user/pager.tsx', msg: 'magic number 50 in PAGE_SIZE', severity: 'error' },
    { rule: 'file-docs',    file: 'src/api/client.ts',           msg: 'missing @rules anchor',        severity: 'warn' },
    { rule: 'coding-style', file: 'src/features/user/UserTable.tsx', msg: 'inline style used',        severity: 'warn' },
  ];

  // Simulated tasks.json — per-lane task manifests from docs/tasks/
  // docs/prds/ — simulated PRD list
  const SEED_PRDS = [
    {
      id: 'PRD-042', title: 'User management module',
      status: 'active', author: '@suntao', updated: '2d ago',
      tbd: 0, sections: 6,
      summary: 'CRUD + RBAC for user accounts. Table, form drawer, detail page, role assignment.',
      anchors: { tasks: 8, code: 5, tests: 3 },
    },
    {
      id: 'PRD-043', title: 'Order list refactor',
      status: 'draft', author: '@suntao', updated: '5h ago',
      tbd: 3, sections: 4,
      summary: 'Rewrite order list to use new pagination pattern. Add column visibility toggle.',
      anchors: { tasks: 0, code: 0, tests: 0 },
    },
    {
      id: 'PRD-041', title: 'Dashboard metrics v2',
      status: 'archived', author: '@lin', updated: 'Mar 28',
      tbd: 0, sections: 8,
      summary: 'Real-time KPI cards + 4 chart widgets. Shipped v0.0.9.',
      anchors: { tasks: 12, code: 12, tests: 12 },
    },
  ];

  // docs/bug-reports/ — simulated bug intake for /fix lane
  const SEED_BUGS = [
    { id: 'BUG-114', title: 'race condition in useUserStore',     severity: 'P0', status: 'fixing',   reporter: '@qa',   created: '2h ago',  prdRef: 'PRD-042' },
    { id: 'BUG-115', title: 'UserTable empty-state missing',      severity: 'P1', status: 'fixing',   reporter: '@lin',  created: '5h ago',  prdRef: 'PRD-042' },
    { id: 'BUG-116', title: 'drawer close animation flicker',     severity: 'P2', status: 'reproducing', reporter: '@qa', created: '1d ago',  prdRef: 'PRD-042' },
    { id: 'BUG-113', title: 'role checkbox ignores disabled prop',severity: 'P1', status: 'fixed',    reporter: '@qa',   created: '3d ago',  prdRef: 'PRD-042' },
    { id: 'BUG-112', title: 'search debounce 300ms too slow',     severity: 'P2', status: 'triage',   reporter: '@pm',   created: '4d ago',  prdRef: 'PRD-042' },
  ];

  // docs/retrospectives/ — timeline of /meta-audit runs
  const SEED_RETROS = [
    { date: '2026-04-21', drift: 4, dead: 1, commits: 28 },
    { date: '2026-04-14', drift: 1, dead: 0, commits: 19 },
    { date: '2026-04-07', drift: 0, dead: 0, commits: 22 },
    { date: '2026-03-31', drift: 6, dead: 2, commits: 34 },
    { date: '2026-03-24', drift: 2, dead: 0, commits: 17 },
    { date: '2026-03-17', drift: 0, dead: 0, commits: 12 },
    { date: '2026-03-10', drift: 3, dead: 1, commits: 21 },
    { date: '2026-03-03', drift: 1, dead: 0, commits: 15 },
  ];

  const SEED_TASKS = {
    code: [
      { id: 'T001', title: 'userApi',        status: 'done',        prdRef: 'PRD-042', rules: ['no-hardcode','file-docs'] },
      { id: 'T002', title: 'useUserStore',   status: 'done',        prdRef: 'PRD-042', rules: ['coding-style'] },
      { id: 'T003', title: 'UserTable',      status: 'in-progress', prdRef: 'PRD-042', rules: ['coding-style','file-docs'] },
      { id: 'T004', title: 'UserForm',       status: 'pending',     prdRef: 'PRD-042', rules: ['no-hardcode'],  deps: ['T003'] },
      { id: 'T005', title: 'UserPage',       status: 'pending',     prdRef: 'PRD-042', rules: ['file-docs'],    deps: ['T004'] },
    ],
    test: [
      { id: 'T101', title: 'userApi.test.ts',        status: 'done',     prdRef: 'PRD-042', rules: ['testing'] },
      { id: 'T102', title: 'useUserStore.test.ts',   status: 'done',     prdRef: 'PRD-042', rules: ['testing'] },
      { id: 'T103', title: 'UserTable.test.tsx',     status: 'blocked',  prdRef: 'PRD-042', rules: ['testing'], deps: ['T003'] },
    ],
  };

  function App() {
    const [agentsByLane, setAgentsByLane] = useState(buildInitialAgents);
    const [dragging, setDragging] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [focused, setFocused] = useState(null); // agent object
    const [activeStep, setActiveStep] = useState(null);
    const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
    const [tweaksOpen, setTweaksOpen] = useState(false);
    const [rulesOpen, setRulesOpen] = useState(false);
    const [violations] = useState(SEED_VIOLATIONS);
    const [activePrdId, setActivePrdId] = useState('PRD-042');
    const [prdDropdown, setPrdDropdown] = useState(false);
    const [prdPreview, setPrdPreview] = useState(null);
    const [docsOpen, setDocsOpen] = useState(false);
    const [docsView, setDocsView] = useState(null);
    const activePrd = SEED_PRDS.find(p => p.id === activePrdId) || SEED_PRDS[0];

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

    // Persist
    useEffect(() => {
      try {
        const s = JSON.parse(localStorage.getItem('wf-state-v1') || 'null');
        if (s && s.agentsByLane) setAgentsByLane(s.agentsByLane);
      } catch (_) {}
    }, []);
    useEffect(() => {
      try { localStorage.setItem('wf-state-v1', JSON.stringify({ agentsByLane })); } catch (_) {}
    }, [agentsByLane]);

    const setStatus = (agentId, laneId, status) => {
      setAgentsByLane(prev => ({
        ...prev,
        [laneId]: prev[laneId].map(a => a.id === agentId ? { ...a, status } : a),
      }));
    };

    const addAgent = (laneId, kind) => {
      const id = uid();
      const lane = [...LANES, ...HELPERS].find(l => l.id === laneId);
      const defaultName = kind === 'sub' ? 'sub-agent' : kind === 'skill' ? 'ext-*' : kind === 'hook' ? 'hook' : `/${lane.cmd}`;
      setAgentsByLane(prev => ({
        ...prev,
        [laneId]: [...(prev[laneId] || []), { id, lane: laneId, kind, name: defaultName, desc: '', status: 'idle' }],
      }));
    };
    const deleteAgent = (agentId, laneId) => {
      setAgentsByLane(prev => ({
        ...prev,
        [laneId]: prev[laneId].filter(a => a.id !== agentId),
      }));
    };

    // drag across lanes
    const onDragStart = (agentId, fromLane) => setDragging({ agentId, fromLane });
    const onDragEnd = () => { setDragging(null); setDropTarget(null); };
    const onLaneDragOver = (e, laneId) => {
      if (!dragging) return;
      e.preventDefault();
      setDropTarget(laneId);
    };
    const onLaneDrop = (e, laneId) => {
      e.preventDefault();
      if (!dragging) return;
      const { agentId, fromLane } = dragging;
      if (fromLane === laneId) { setDragging(null); setDropTarget(null); return; }
      setAgentsByLane(prev => {
        const agent = prev[fromLane].find(a => a.id === agentId);
        if (!agent) return prev;
        return {
          ...prev,
          [fromLane]: prev[fromLane].filter(a => a.id !== agentId),
          [laneId]: [...(prev[laneId] || []), { ...agent, lane: laneId }],
        };
      });
      setDragging(null); setDropTarget(null);
    };

    // Run whole pipeline
    const runAll = () => {
      let delay = 0;
      LANES.forEach(lane => {
        (agentsByLane[lane.id] || []).forEach(a => {
          if (a.kind === 'main' && !a.name.includes('check')) {
            setTimeout(() => setActiveStep(lane.id), delay);
            delay += 1200;
          }
        });
      });
    };

    const renderedLanes = tweaks.showHelpers ? [...LANES, ...HELPERS] : LANES;

    return (
      <React.Fragment>
        <div className="topbar">
          <div className="brand">
            <span className="logo">λ</span>
            <span>CLAUDE CODE WORKFLOW</span>
            <span className="sub">/ suntaoTom·claude-code-workflow</span>
          </div>

          {/* PRD selector */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn"
              onClick={() => setPrdDropdown(v => !v)}
              style={{ padding: '5px 10px', fontFamily: 'var(--mono)' }}
              title="Switch active PRD (workflow context)"
            >
              <span style={{ color: activePrd.status === 'active' ? 'var(--green)' : activePrd.status === 'draft' ? 'var(--amber)' : 'var(--text-3)' }}>▸</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{activePrd.id}</span>
              <span style={{ color: 'var(--text-3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activePrd.title}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 9 }}>▾</span>
            </button>
            {prdDropdown && (
              <React.Fragment>
                <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setPrdDropdown(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                  width: 380, background: 'var(--bg-1)',
                  border: '1px solid var(--line)', borderRadius: 6,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                  zIndex: 200, padding: 6,
                  fontFamily: 'var(--mono)', fontSize: 11.5,
                }}>
                  <div style={{ padding: '6px 8px', color: 'var(--text-3)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>docs/prds/</span>
                    <span style={{ flex: 1 }} />
                    <span>{SEED_PRDS.length} PRDs</span>
                  </div>
                  {SEED_PRDS.map(p => (
                    <div key={p.id}
                      onClick={() => { setActivePrdId(p.id); setPrdDropdown(false); }}
                      style={{
                        padding: '8px 10px', borderRadius: 4,
                        cursor: 'pointer',
                        background: p.id === activePrdId ? 'var(--bg-3)' : 'transparent',
                        borderLeft: '2px solid ' + (p.id === activePrdId ? 'var(--green)' : 'transparent'),
                        marginBottom: 2,
                      }}
                      onMouseEnter={(e) => { if (p.id !== activePrdId) e.currentTarget.style.background = 'var(--bg-2)'; }}
                      onMouseLeave={(e) => { if (p.id !== activePrdId) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{p.id}</span>
                        <span style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 3,
                          background: p.status === 'active' ? 'rgba(110,231,127,0.12)' : p.status === 'draft' ? 'rgba(255,181,71,0.12)' : 'var(--bg-3)',
                          color: p.status === 'active' ? 'var(--green)' : p.status === 'draft' ? 'var(--amber)' : 'var(--text-3)',
                          border: '1px solid ' + (p.status === 'active' ? 'rgba(110,231,127,0.3)' : p.status === 'draft' ? 'rgba(255,181,71,0.3)' : 'var(--line)'),
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{p.status}</span>
                        {p.tbd > 0 && (
                          <span style={{ fontSize: 9, color: 'var(--amber)' }}>{p.tbd} [TBD]</span>
                        )}
                        <span style={{ flex: 1 }} />
                        <span style={{ color: 'var(--text-3)', fontSize: 9.5 }}>{p.updated}</span>
                      </div>
                      <div style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 4 }}>{p.title}</div>
                      <div style={{ color: 'var(--text-3)', fontFamily: 'var(--sans)', fontSize: 10.5, lineHeight: 1.4, marginBottom: 4 }}>{p.summary}</div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 9.5, color: 'var(--text-3)' }}>
                        <span>tasks <span style={{ color: 'var(--text-2)' }}>{p.anchors.tasks}</span></span>
                        <span>·</span>
                        <span>code <span style={{ color: 'var(--text-2)' }}>{p.anchors.code}</span></span>
                        <span>·</span>
                        <span>tests <span style={{ color: 'var(--text-2)' }}>{p.anchors.tests}</span></span>
                        <span style={{ flex: 1 }} />
                        <a onClick={(e) => { e.stopPropagation(); setPrdPreview(p); setPrdDropdown(false); }}
                           style={{ color: 'var(--blue)', cursor: 'pointer' }}>preview →</a>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--line)', padding: 6, marginTop: 4 }}>
                    <button className="add-btn" onClick={() => setPrdDropdown(false)}>+ new PRD · /prd</button>
                  </div>
                </div>
              </React.Fragment>
            )}
          </div>

          <div className="path" style={{ marginLeft: 'auto' }}>
            <b>{activePrd.anchors.tasks}</b> tasks · <b>{activePrd.anchors.code}</b> files · <b>{activePrd.anchors.tests}</b> tests
          </div>
          <div className="chip">
            <span style={{ color: 'var(--green)' }}>●</span>
            {Object.values(agentsByLane).flat().filter(a => a.status === 'run').length} running
          </div>
          <button
            className={'btn' + (rulesOpen ? ' active' : '')}
            onClick={() => setRulesOpen(v => !v)}
            title="Open .claude/rules"
          >
            <span style={{ color: violations.length ? 'var(--red)' : 'var(--green)' }}>●</span>
            Rules {violations.length > 0 && <span style={{ color: 'var(--red)' }}>({violations.length})</span>}
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className={'btn' + (docsOpen ? ' active' : '')}
              onClick={() => setDocsOpen(v => !v)}
              title="Reference docs"
            >
              <span style={{ color: 'var(--text-3)' }}>📖</span> Docs
            </button>
            {docsOpen && (
              <React.Fragment>
                <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setDocsOpen(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  width: 280, background: 'var(--bg-1)',
                  border: '1px solid var(--line)', borderRadius: 6,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                  zIndex: 200, padding: 6,
                  fontFamily: 'var(--mono)', fontSize: 11.5,
                }}>
                  <div style={{ padding: '6px 8px', color: 'var(--text-3)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    reference · read-only
                  </div>
                  {[
                    { id: 'workflow',  file: 'WORKFLOW.md',   desc: '8-step pipeline overview' },
                    { id: 'decisions', file: 'DECISIONS.md',  desc: 'Architecture decision log' },
                    { id: 'adapting',  file: 'ADAPTING.md',   desc: 'How to adapt to your stack' },
                    { id: 'claude',    file: 'CLAUDE.md',     desc: 'Onboarding for Claude Code' },
                    { id: 'readme',    file: 'README.md',     desc: 'Project overview' },
                  ].map(d => (
                    <div key={d.id}
                      onClick={() => { setDocsView(d); setDocsOpen(false); }}
                      style={{
                        padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                        marginBottom: 1,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 2 }}>{d.file}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: 10.5, fontFamily: 'var(--sans)' }}>{d.desc}</div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--line)', padding: '6px 8px', marginTop: 4, fontSize: 10, color: 'var(--text-3)' }}>
                    static — linked, not modeled
                  </div>
                </div>
              </React.Fragment>
            )}
          </div>
          <button className="btn" onClick={() => setActiveStep(null)}>
            <Icon name="flow" size={13} /> Reset
          </button>
          <button className="btn primary" onClick={runAll}>
            <Icon name="play" size={11} /> Run pipeline
          </button>
        </div>

        {/* Pipeline strip */}
        <div className="pipeline">
          {LANES.map((lane, i) => (
            <React.Fragment key={lane.id}>
              <div
                className={'step' + (activeStep === lane.id ? ' active' : '')}
                onClick={() => setActiveStep(lane.id)}
              >
                <span className="idx">{lane.idx}</span>
                <span>/{lane.cmd}</span>
              </div>
              {lane.gate && (
                <>
                  <span className="arrow">→</span>
                  <span className="gate">◆ /{lane.gate.cmd}</span>
                </>
              )}
              {i < LANES.length - 1 && <span className="arrow">→</span>}
            </React.Fragment>
          ))}
          <span style={{ flex: 1 }} />
          <span className="arrow">·</span>
          <span style={{ color: 'var(--text-3)' }}>helpers:</span>
          {HELPERS.map(h => (
            <div key={h.id} className="step" onClick={() => setActiveStep(h.id)} style={{ borderStyle: 'dashed' }}>
              <span>/{h.cmd}</span>
            </div>
          ))}
        </div>

        {/* Board */}
        <div className="board">
          <div className="board-inner">
            {renderedLanes.map((lane, i) => (
              <React.Fragment key={lane.id}>
                <Lane
                  lane={lane}
                  agents={agentsByLane[lane.id] || []}
                  tasks={SEED_TASKS[lane.id]}
                  bugs={lane.id === 'fix' ? SEED_BUGS : null}
                  active={activeStep === lane.id}
                  isDropTarget={dropTarget === lane.id}
                  density={tweaks.density}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={(e) => onLaneDragOver(e, lane.id)}
                  onDrop={(e) => onLaneDrop(e, lane.id)}
                  onStatusChange={setStatus}
                  onAddAgent={addAgent}
                  onDelete={deleteAgent}
                  onFocus={setFocused}
                />
                {i < renderedLanes.length - 1 && !lane.helper && !renderedLanes[i + 1].helper && (
                  <Connector lane={lane} next={renderedLanes[i + 1]} />
                )}
                {i < renderedLanes.length - 1 && (lane.helper || renderedLanes[i + 1].helper) && (
                  <div style={{ flex: '0 0 16px' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Focus overlay */}
        {focused && (
          <div className="focus-veil" onClick={() => setFocused(null)}>
            <div className="focus-box" onClick={(e) => e.stopPropagation()}>
              <div className="agent-head" style={{ borderBottom: '1px solid var(--line)' }}>
                <span className="lights"><i className="r" /><i className="y" /><i className="g" /></span>
                <span className={'kind-tag ' + focused.kind}>{focused.kind}</span>
                <div className="title">{focused.name}</div>
                <span className={'status ' + focused.status}>{focused.status}</span>
                <button className="menu-btn" onClick={() => setFocused(null)}>✕</button>
              </div>
              <div style={{ flex: 1, display: 'flex' }}>
                <window.WFTerminal
                  cmd={focused.name.replace(/^\//, '')}
                  autoRun={true}
                  onStatusChange={(s) => setStatus(focused.id, focused.lane, s)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Retrospectives timeline (bottom strip) */}
        <RetroTimeline retros={SEED_RETROS} />

        {/* Docs viewer (static md files) */}
        {docsView && (
          <div className="focus-veil" onClick={() => setDocsView(null)}>
            <div className="focus-box" style={{ width: 'min(720px, 85vw)', height: 'min(560px, 80vh)' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)' }}>
                <span style={{ color: 'var(--text-3)' }}>📖</span>
                <b style={{ color: 'var(--text)' }}>{docsView.file}</b>
                <span style={{ color: 'var(--text-3)' }}>{docsView.desc}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--text-3)', fontSize: 10.5 }}>~/{docsView.file}</span>
                <button className="menu-btn" onClick={() => setDocsView(null)} style={{ fontSize: 18, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', fontFamily: 'var(--sans)', fontSize: 13, lineHeight: 1.65, color: 'var(--text-2)' }}>
                <DocsBody id={docsView.id} />
              </div>
              <div style={{ padding: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 8, justifyContent: 'flex-end', fontFamily: 'var(--mono)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-3)', alignSelf: 'center', marginRight: 'auto' }}>static reference — not part of the runtime DAG</span>
                <button className="btn" onClick={() => setDocsView(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* PRD preview overlay */}
        {prdPreview && (
          <div className="focus-veil" onClick={() => setPrdPreview(null)}>
            <div className="focus-box" style={{ width: 'min(720px, 85vw)', height: 'min(560px, 80vh)' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)' }}>
                <span style={{ color: 'var(--green)' }}>●</span>
                <b style={{ color: 'var(--text)' }}>{prdPreview.id}</b>
                <span style={{ color: 'var(--text-2)' }}>{prdPreview.title}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--text-3)', fontSize: 10.5 }}>docs/prds/{prdPreview.id.toLowerCase()}.md</span>
                <button className="menu-btn" onClick={() => setPrdPreview(null)} style={{ fontSize: 18, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', fontFamily: 'var(--sans)', fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>
                <h3 style={{ color: 'var(--text)', marginTop: 0, fontFamily: 'var(--mono)', fontSize: 14 }}># {prdPreview.title}</h3>
                <p style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                  anchor: <span style={{ color: 'var(--green)' }}>{prdPreview.id}</span> · author: {prdPreview.author} · updated: {prdPreview.updated}
                </p>
                <h4 style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>## Goal</h4>
                <p>{prdPreview.summary}</p>
                <h4 style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>## Actors</h4>
                <ul style={{ paddingLeft: 18 }}>
                  <li>Admin — full CRUD</li>
                  <li>Ops — read + role assignment</li>
                  <li>User — self-profile edit</li>
                </ul>
                <h4 style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>## Flows</h4>
                <ol style={{ paddingLeft: 18 }}>
                  <li>list → filter → open drawer → edit → save</li>
                  <li>create → validate → persist → toast</li>
                  <li>role assignment → confirm modal → audit log</li>
                </ol>
                {prdPreview.tbd > 0 && (
                  <div style={{ background: 'rgba(255,181,71,0.08)', border: '1px solid rgba(255,181,71,0.3)', padding: 10, borderRadius: 4, marginTop: 12, fontFamily: 'var(--mono)', fontSize: 11 }}>
                    <b style={{ color: 'var(--amber)' }}>⚠ {prdPreview.tbd} [TBD]</b> — run <span style={{ color: 'var(--green)' }}>/prd-check</span> to clear before /plan.
                  </div>
                )}
              </div>
              <div style={{ padding: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setPrdPreview(null)}>Close</button>
                <button className="btn primary" onClick={() => { setActivePrdId(prdPreview.id); setPrdPreview(null); }}>
                  Bind to workflow →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules drawer */}
        {rulesOpen && (
          <RulesDrawer
            rules={RULES}
            violations={violations}
            activeStep={activeStep}
            onClose={() => setRulesOpen(false)}
            onJumpLane={(laneId) => { setActiveStep(laneId); }}
          />
        )}

        {/* Tweaks */}
        {tweaksOpen && (
          <div className="tweaks">
            <h4>TWEAKS</h4>
            <div className="row">
              <div className="label">Density</div>
              <div className="seg">
                <button className={tweaks.density === 'comfortable' ? 'active' : ''} onClick={() => setTweak('density', 'comfortable')}>Full</button>
                <button className={tweaks.density === 'compact' ? 'active' : ''} onClick={() => setTweak('density', 'compact')}>Compact</button>
              </div>
            </div>
            <div className="row">
              <div className="label">Helper lanes</div>
              <div className="seg">
                <button className={tweaks.showHelpers ? 'active' : ''} onClick={() => setTweak('showHelpers', true)}>Show</button>
                <button className={!tweaks.showHelpers ? 'active' : ''} onClick={() => setTweak('showHelpers', false)}>Hide</button>
              </div>
            </div>
            <div className="row">
              <button className="add-btn" onClick={() => { localStorage.removeItem('wf-state-v1'); location.reload(); }}>
                reset workflow
              </button>
            </div>
          </div>
        )}
      </React.Fragment>
    );
  }

  function Lane({ lane, agents, tasks, bugs, active, isDropTarget, density, onDragStart, onDragEnd, onDragOver, onDrop, onStatusChange, onAddAgent, onDelete, onFocus }) {
    const main = agents.filter(a => a.kind === 'main');
    const subs = agents.filter(a => a.kind === 'sub');
    const skills = agents.filter(a => a.kind === 'skill');
    const hooks = agents.filter(a => a.kind === 'hook');

    return (
      <div className={'lane' + (lane.helper ? ' helper' : '') + (active ? ' active' : '')}>
        <div className="lane-head">
          <div className="row">
            <span className="step-idx">{lane.idx || '·'}</span>
            <span className="cmd"><span className="slash">/</span>{lane.cmd}</span>
            <span className="count">{agents.length}</span>
            <span className="flex" />
            {lane.gate && <span className="gate-badge">◆ gate</span>}
          </div>
          <div className="desc">{lane.desc}</div>
          <div className="artifacts">
            {(lane.inputs || []).map((t, i) => (
              <span key={'i' + i} className="artifact-tag in">← {t}</span>
            ))}
            {(lane.outputs || []).map((t, i) => (
              <span key={'o' + i} className="artifact-tag out">{t} →</span>
            ))}
          </div>
        </div>
        <div
          className={'lane-body' + (isDropTarget ? ' drop-active' : '')}
          onDragOver={onDragOver}
          onDragLeave={() => {}}
          onDrop={onDrop}
        >
          {tasks && tasks.length > 0 && (
            <React.Fragment>
              <div className="lane-section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>docs/tasks/tasks-042.json</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--green)' }}>{tasks.filter(t => t.status === 'done').length}</span>
                <span style={{ color: 'var(--text-3)' }}>/ {tasks.length}</span>
              </div>
              {tasks.map(t => <TaskRow key={t.id} task={t} />)}
            </React.Fragment>
          )}

          {bugs && bugs.length > 0 && (
            <React.Fragment>
              <div className="lane-section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>docs/bug-reports/</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--red)' }}>{bugs.filter(b => b.status !== 'fixed').length}</span>
                <span style={{ color: 'var(--text-3)' }}>open</span>
              </div>
              {bugs.map(b => <BugRow key={b.id} bug={b} />)}
            </React.Fragment>
          )}

          {main.length > 0 && <div className="lane-section-label main" style={{ marginTop: tasks ? 8 : 0 }}>Main agent{main.length > 1 ? 's' : ''}</div>}
          {main.map(a => (
            <AgentCard key={a.id} agent={a} density={density}
              onDragStart={onDragStart} onDragEnd={onDragEnd}
              onStatusChange={onStatusChange} onDelete={onDelete} onFocus={onFocus} />
          ))}

          {subs.length > 0 && <div className="lane-section-label sub" style={{ marginTop: 6 }}>Sub-agents ({subs.length})</div>}
          {subs.map(a => (
            <AgentCard key={a.id} agent={a} density={density} short
              onDragStart={onDragStart} onDragEnd={onDragEnd}
              onStatusChange={onStatusChange} onDelete={onDelete} onFocus={onFocus} />
          ))}

          {skills.length > 0 && <div className="lane-section-label skill" style={{ marginTop: 6 }}>Skills</div>}
          {skills.map(a => (
            <AgentCard key={a.id} agent={a} density={density} short
              onDragStart={onDragStart} onDragEnd={onDragEnd}
              onStatusChange={onStatusChange} onDelete={onDelete} onFocus={onFocus} />
          ))}

          {hooks.length > 0 && <div className="lane-section-label hook" style={{ marginTop: 6 }}>Hooks</div>}
          {hooks.map(a => (
            <AgentCard key={a.id} agent={a} density={density} short
              onDragStart={onDragStart} onDragEnd={onDragEnd}
              onStatusChange={onStatusChange} onDelete={onDelete} onFocus={onFocus} />
          ))}
        </div>
        <div className="lane-foot">
          <LaneAddMenu laneId={lane.id} onAdd={onAddAgent} cmd={lane.cmd} />
        </div>
      </div>
    );
  }

  function BugRow({ bug }) {
    const sev = {
      P0: { fg: 'var(--red)',   bg: 'rgba(255,107,107,0.12)', br: 'rgba(255,107,107,0.3)' },
      P1: { fg: 'var(--amber)', bg: 'rgba(255,181,71,0.12)',  br: 'rgba(255,181,71,0.3)' },
      P2: { fg: 'var(--text-3)',bg: 'var(--bg-3)',             br: 'var(--line)' },
    }[bug.severity] || { fg: 'var(--text-3)', bg: 'var(--bg-3)', br: 'var(--line)' };
    const st = {
      triage:       { ic: '?', fg: 'var(--text-3)' },
      reproducing:  { ic: '◐', fg: 'var(--blue)' },
      fixing:       { ic: '◐', fg: 'var(--amber)' },
      fixed:        { ic: '✓', fg: 'var(--green)' },
    }[bug.status] || { ic: '·', fg: 'var(--text-3)' };
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px',
        background: bug.status === 'fixed' ? 'rgba(110,231,127,0.05)' : 'var(--bg-2)',
        border: '1px solid var(--line)',
        borderLeft: '3px solid ' + sev.fg,
        borderRadius: 5,
        fontFamily: 'var(--mono)', fontSize: 11,
        opacity: bug.status === 'fixed' ? 0.6 : 1,
      }}>
        <span style={{ color: st.fg, width: 12 }}>{st.ic}</span>
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 3,
          color: sev.fg, background: sev.bg, border: '1px solid ' + sev.br,
          fontWeight: 600,
        }}>{bug.severity}</span>
        <span style={{ color: 'var(--text-3)', width: 52 }}>{bug.id}</span>
        <span style={{ color: 'var(--text)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bug.title}</span>
        <span style={{ color: 'var(--text-3)', fontSize: 9.5 }}>{bug.reporter}</span>
      </div>
    );
  }

  function TaskRow({ task }) {
    const statusColor = {
      'done':        { bg: 'rgba(110,231,127,0.08)', fg: 'var(--green)', br: 'rgba(110,231,127,0.25)', ic: '✓' },
      'in-progress': { bg: 'rgba(255,181,71,0.08)',  fg: 'var(--amber)', br: 'rgba(255,181,71,0.25)',  ic: '◐' },
      'pending':     { bg: 'var(--bg-2)',            fg: 'var(--text-3)',br: 'var(--line)',            ic: '○' },
      'blocked':     { bg: 'rgba(255,107,107,0.08)', fg: 'var(--red)',   br: 'rgba(255,107,107,0.25)', ic: '⊘' },
    }[task.status] || { bg: 'var(--bg-2)', fg: 'var(--text-3)', br: 'var(--line)', ic: '·' };
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px',
        background: statusColor.bg,
        border: '1px solid ' + statusColor.br,
        borderRadius: 5,
        fontFamily: 'var(--mono)', fontSize: 11,
      }}>
        <span style={{ color: statusColor.fg, width: 12 }}>{statusColor.ic}</span>
        <span style={{ color: 'var(--text-3)', width: 34 }}>{task.id}</span>
        <span style={{ color: 'var(--text)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>
        {task.deps && (
          <span style={{
            color: 'var(--text-3)', fontSize: 9.5,
            padding: '1px 5px', background: 'var(--bg)',
            border: '1px solid var(--line)', borderRadius: 3,
          }}>↳ {task.deps.join(',')}</span>
        )}
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 3,
          color: statusColor.fg, background: 'var(--bg)',
          border: '1px solid ' + statusColor.br,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{task.status}</span>
      </div>
    );
  }

  function LaneAddMenu({ laneId, onAdd, cmd }) {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ position: 'relative' }}>
        <button className="add-btn" onClick={() => setOpen(v => !v)}>
          <Icon name="plus" size={11} /> spawn terminal in /{cmd}
        </button>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpen(false)} />
            <div className="ctx" style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6 }}>
              <button onClick={() => { onAdd(laneId, 'main'); setOpen(false); }}>main agent <span style={{ color: 'var(--green)' }}>●</span></button>
              <button onClick={() => { onAdd(laneId, 'sub'); setOpen(false); }}>sub-agent <span style={{ color: 'var(--purple)' }}>●</span></button>
              <button onClick={() => { onAdd(laneId, 'skill'); setOpen(false); }}>skill <span style={{ color: 'var(--teal)' }}>●</span></button>
              <button onClick={() => { onAdd(laneId, 'hook'); setOpen(false); }}>hook <span style={{ color: 'var(--amber)' }}>●</span></button>
            </div>
          </>
        )}
      </div>
    );
  }

  function AgentCard({ agent, density, short, onDragStart, onDragEnd, onStatusChange, onDelete, onFocus }) {
    const [menu, setMenu] = useState(null);
    return (
      <div
        className={'agent kind-' + agent.kind}
        draggable
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', agent.id); onDragStart(agent.id, agent.lane); }}
        onDragEnd={() => onDragEnd()}
      >
        <div className="agent-head">
          <span className="lights"><i className="r" /><i className="y" /><i className="g" /></span>
          <span className={'kind-tag ' + agent.kind}>{agent.kind}</span>
          <div className="title">{agent.name}</div>
          <span className={'status ' + agent.status}>{agent.status}</span>
          <button className="menu-btn" onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            setMenu({ x: r.right, y: r.bottom + 4 });
          }}>⋯</button>
        </div>
        {density !== 'compact' && agent.desc && <div className="agent-desc">{agent.desc}</div>}
        <window.WFTerminal
          cmd={agent.name.replace(/^\//, '')}
          autoRun={agent.auto && agent.kind !== 'sub'}
          short={short || density === 'compact'}
          onStatusChange={(s) => onStatusChange(agent.id, agent.lane, s)}
        />
        {menu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setMenu(null)} />
            <div className="ctx" style={{ left: menu.x - 160, top: menu.y }}>
              <button onClick={() => { setMenu(null); onFocus(agent); }}>Open fullscreen</button>
              <button onClick={() => { setMenu(null); onStatusChange(agent.id, agent.lane, 'idle'); }}>Reset status</button>
              <div className="sep" />
              <button className="danger" onClick={() => { setMenu(null); onDelete(agent.id, agent.lane); }}>Delete agent</button>
            </div>
          </>
        )}
      </div>
    );
  }

  function Connector({ lane, next }) {
    const artifact = (lane.outputs && lane.outputs[0]) || '';
    const hasGate = lane.gate;
    return (
      <div className={'connector' + (hasGate ? ' gate' : '')}>
        <svg width="40" height="24" viewBox="0 0 40 24">
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L6,4 L0,8 z" fill={hasGate ? '#ffb547' : '#6ee77f'} />
            </marker>
          </defs>
          <line x1="0" y1="12" x2="34" y2="12"
                stroke={hasGate ? '#ffb547' : '#6ee77f'}
                strokeWidth="1.4"
                strokeDasharray={hasGate ? '4 3' : ''}
                markerEnd="url(#arr)" />
        </svg>
        <div className="arrow-label">
          {hasGate ? <>◆ {lane.gate.label}</> : <><span className="tag">out</span>{artifact}</>}
        </div>
      </div>
    );
  }

  function DocsBody({ id }) {
    const H = ({ children }) => <h4 style={{ color: 'var(--text)', fontFamily: 'var(--mono)', marginTop: 14, marginBottom: 6 }}>{children}</h4>;
    const CODE = ({ children }) => <code style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11.5 }}>{children}</code>;
    if (id === 'workflow') return (
      <React.Fragment>
        <H># Workflow</H>
        <p>8 main commands form a linear pipeline, each with a hard gate between phases. Helpers (<CODE>/fix</CODE>, <CODE>/meta-audit</CODE>) loop in sideways.</p>
        <H>## Pipeline</H>
        <ol style={{ paddingLeft: 18 }}>
          <li><CODE>/prd</CODE> → PRD.md · gate <CODE>/prd-check</CODE></li>
          <li><CODE>/plan</CODE> → tasks.json · gate <CODE>/plan-check</CODE></li>
          <li><CODE>/code</CODE> → src/*</li>
          <li><CODE>/test</CODE> → *.test.ts</li>
          <li><CODE>/review</CODE> → review.md</li>
          <li><CODE>/build</CODE> → dist/</li>
          <li><CODE>/deploy</CODE> → release</li>
          <li><CODE>/release</CODE> → tag v*</li>
        </ol>
        <H>## Principle</H>
        <p>Every artifact carries <CODE>@prd</CODE> / <CODE>@task</CODE> / <CODE>@rules</CODE> anchors so traceability is mechanical, not aspirational.</p>
      </React.Fragment>
    );
    if (id === 'decisions') return (
      <React.Fragment>
        <H># Decisions log</H>
        <p>Architecture decision records (ADR). One entry per non-reversible choice.</p>
        <H>## ADR-001 · Linear DAG, not graph</H>
        <p>Chose strict linear pipeline over arbitrary DAG. Rationale: one direction of causality = simpler gates and easier rollback.</p>
        <H>## ADR-002 · File-based state</H>
        <p>All workflow state lives in <CODE>docs/</CODE> as plain Markdown/JSON. No external DB. Git is the store of record.</p>
        <H>## ADR-003 · Sub-agents via Agent tool</H>
        <p>Spawn read-only specialists (<CODE>code-reviewer</CODE>, <CODE>test-writer</CODE>) via Agent tool to keep main context clean.</p>
      </React.Fragment>
    );
    if (id === 'adapting') return (
      <React.Fragment>
        <H># Adapting to your stack</H>
        <p>Default stack: UmiJS 4 + React 18 + antd 5. To adapt:</p>
        <ol style={{ paddingLeft: 18 }}>
          <li>Edit <CODE>.claude/rules/tech-stack.md</CODE> to your framework</li>
          <li>Rewrite <CODE>.claude/rules/coding-style.md</CODE> conventions</li>
          <li>Update <CODE>CLAUDE.md</CODE> onboarding paths</li>
          <li>Keep the 8 commands — they are framework-agnostic</li>
        </ol>
        <H>## What NOT to change</H>
        <p>The gate commands (<CODE>/prd-check</CODE>, <CODE>/plan-check</CODE>) and the traceability anchors. They are the backbone.</p>
      </React.Fragment>
    );
    if (id === 'claude') return (
      <React.Fragment>
        <H># CLAUDE.md</H>
        <p>Onboarding. Loaded automatically into every Claude Code session.</p>
        <H>## You must</H>
        <ul style={{ paddingLeft: 18 }}>
          <li>Read <CODE>.claude/rules/*.md</CODE> before writing any code</li>
          <li>Emit <CODE>@prd</CODE>/<CODE>@task</CODE>/<CODE>@rules</CODE> headers on every new file</li>
          <li>Never hardcode values — P0 rule, no exceptions</li>
        </ul>
        <H>## You must not</H>
        <ul style={{ paddingLeft: 18 }}>
          <li>Skip <CODE>/prd-check</CODE> or <CODE>/plan-check</CODE> gates</li>
          <li>Modify <CODE>docs/retrospectives/</CODE> — audit trail is immutable</li>
        </ul>
      </React.Fragment>
    );
    return (
      <React.Fragment>
        <H># {id === 'readme' ? 'Claude Code Workflow' : id}</H>
        <p>AI frontend automation knowledge base. Turns spoken requirements into shipped code through a strict 8-step pipeline with mechanical traceability.</p>
        <H>## Quick start</H>
        <ol style={{ paddingLeft: 18 }}>
          <li>Clone repo · <CODE>pnpm install</CODE></li>
          <li>Open in Claude Code</li>
          <li>Run <CODE>/start</CODE> to onboard</li>
          <li>Run <CODE>/prd</CODE> with your requirement</li>
        </ol>
      </React.Fragment>
    );
  }

  function RulesDrawer({ rules, violations, activeStep, onClose, onJumpLane }) {
    const vByRule = useMemo(() => {
      const m = {};
      violations.forEach(v => { (m[v.rule] = m[v.rule] || []).push(v); });
      return m;
    }, [violations]);

    return (
      <div style={{
        position: 'fixed', top: 84, right: 0, bottom: 0, width: 360,
        background: 'var(--bg-1)', borderLeft: '1px solid var(--line)',
        zIndex: 80, display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.4)',
        fontFamily: 'var(--mono)', fontSize: 12,
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--green)' }}>●</span>
          <b style={{ color: 'var(--text)', letterSpacing: '0.06em' }}>.CLAUDE / RULES</b>
          <span style={{ color: 'var(--text-3)', fontSize: 10.5 }}>{rules.length} rules · {violations.length} violations</span>
          <span style={{ flex: 1 }} />
          <button className="menu-btn" onClick={onClose} style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {rules.map(r => {
            const vs = vByRule[r.id] || [];
            const activeHere = activeStep && r.lanes.includes(activeStep);
            return (
              <div key={r.id} style={{
                background: 'var(--bg-2)',
                border: '1px solid ' + (vs.length ? 'rgba(255,107,107,0.3)' : 'var(--line)'),
                borderLeft: '3px solid ' + (vs.length ? 'var(--red)' : activeHere ? 'var(--green)' : 'var(--line-2)'),
                borderRadius: 5, padding: '10px 12px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 3,
                    background: r.p === 'P0' ? 'rgba(255,107,107,0.15)' : 'var(--bg-3)',
                    color: r.p === 'P0' ? 'var(--red)' : 'var(--text-3)',
                    border: '1px solid ' + (r.p === 'P0' ? 'rgba(255,107,107,0.3)' : 'var(--line)'),
                    fontWeight: 600,
                  }}>{r.p}</span>
                  <b style={{ color: 'var(--text)', fontSize: 12 }}>{r.title}</b>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 9.5, color: 'var(--text-3)' }}>{r.id}.md</span>
                </div>
                <div style={{ color: 'var(--text-2)', fontFamily: 'var(--sans)', fontSize: 11.5, lineHeight: 1.45, marginBottom: 6 }}>
                  {r.desc}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: vs.length ? 8 : 0 }}>
                  {r.lanes.map(l => (
                    <span key={l}
                      onClick={() => onJumpLane(l)}
                      style={{
                        fontSize: 9.5, padding: '1px 6px',
                        background: activeStep === l ? 'rgba(110,231,127,0.12)' : 'var(--bg-3)',
                        color: activeStep === l ? 'var(--green)' : 'var(--text-3)',
                        border: '1px solid ' + (activeStep === l ? 'rgba(110,231,127,0.3)' : 'var(--line)'),
                        borderRadius: 10, cursor: 'pointer',
                      }}>/{l}</span>
                  ))}
                </div>
                {vs.map((v, i) => (
                  <div key={i} style={{
                    background: 'var(--bg)',
                    border: '1px solid ' + (v.severity === 'error' ? 'rgba(255,107,107,0.3)' : 'rgba(255,181,71,0.3)'),
                    borderRadius: 4, padding: '6px 8px', marginTop: 4,
                    fontSize: 10.5,
                  }}>
                    <div style={{ color: v.severity === 'error' ? 'var(--red)' : 'var(--amber)', marginBottom: 2 }}>
                      {v.severity === 'error' ? '✗' : '!'} {v.msg}
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: 10 }}>{v.file}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function RetroTimeline({ retros }) {
    const [open, setOpen] = useState(false);
    const [hover, setHover] = useState(null);
    const maxDrift = Math.max(...retros.map(r => r.drift + r.dead), 1);
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: open ? 120 : 28,
        background: 'var(--bg-1)',
        borderTop: '1px solid var(--line)',
        zIndex: 70,
        transition: 'height 180ms ease',
        fontFamily: 'var(--mono)', fontSize: 11,
        display: 'flex', flexDirection: 'column',
      }}>
        <div
          onClick={() => setOpen(v => !v)}
          style={{
            height: 28, padding: '0 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', color: 'var(--text-3)',
            borderBottom: open ? '1px solid var(--line)' : 'none',
            flex: '0 0 28px',
          }}>
          <span style={{ color: 'var(--teal)' }}>◆</span>
          <b style={{ color: 'var(--text-2)', letterSpacing: '0.06em' }}>docs/retrospectives/</b>
          <span>{retros.length} audits · last {retros[0].date}</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: 'var(--text-3)' }}>{open ? '▾ collapse' : '▸ expand'}</span>
        </div>
        {open && (
          <div style={{ flex: 1, padding: '10px 14px 12px 14px', display: 'flex', alignItems: 'flex-end', gap: 4, position: 'relative' }}>
            {retros.slice().reverse().map((r, i) => {
              const total = r.drift + r.dead;
              const h = 4 + (total / maxDrift) * 56;
              const fg = total === 0 ? 'var(--green)' : total < 3 ? 'var(--amber)' : 'var(--red)';
              return (
                <div
                  key={r.date}
                  onMouseEnter={() => setHover(r)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    flex: '1 1 0', minWidth: 28, maxWidth: 80,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 4,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: '100%', height: h,
                    background: fg, opacity: 0.7,
                    borderRadius: '2px 2px 0 0',
                    border: '1px solid ' + fg,
                    transition: 'opacity 120ms',
                  }} />
                  <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{r.date.slice(5)}</div>
                </div>
              );
            })}
            {hover && (
              <div style={{
                position: 'absolute', top: 6, right: 14,
                background: 'var(--bg-2)', border: '1px solid var(--line)',
                borderRadius: 4, padding: '6px 10px',
                fontSize: 10.5, color: 'var(--text-2)',
              }}>
                <b style={{ color: 'var(--text)' }}>{hover.date}</b>
                <span style={{ margin: '0 8px', color: 'var(--text-3)' }}>·</span>
                <span>drift <b style={{ color: hover.drift ? 'var(--amber)' : 'var(--green)' }}>{hover.drift}</b></span>
                <span style={{ margin: '0 8px', color: 'var(--text-3)' }}>·</span>
                <span>dead <b style={{ color: hover.dead ? 'var(--red)' : 'var(--green)' }}>{hover.dead}</b></span>
                <span style={{ margin: '0 8px', color: 'var(--text-3)' }}>·</span>
                <span>{hover.commits} commits</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Workspace state shell (desktop-only states) ──────────────
  function WorkspaceShell() {
    // Tweakable state: 'ready' | 'empty' | 'scanning' | 'invalid'
    const [wsState, setWsState] = useState('ready');
    const [recentPaths] = useState([
      '~/code/claude-code-work',
      '~/projects/acme-dashboard',
      '~/work/internal-tools',
    ]);

    useEffect(() => {
      const onMsg = (e) => {
        if (e.data && e.data.type === '__ws_set_state') setWsState(e.data.state);
      };
      window.addEventListener('message', onMsg);
      // expose a tweak hook for the panel to toggle states
      window.__setWorkspaceState = setWsState;
      return () => window.removeEventListener('message', onMsg);
    }, []);

    return (
      <React.Fragment>
        {wsState === 'ready' && <App />}
        {wsState === 'empty' && <EmptyWorkspace recentPaths={recentPaths} onOpen={() => setWsState('scanning')} />}
        {wsState === 'scanning' && <ScanningWorkspace onDone={() => setWsState('ready')} />}
        {wsState === 'invalid' && <InvalidWorkspace path="~/Downloads/random-folder" onPick={() => setWsState('empty')} onContinue={() => setWsState('ready')} />}

        {/* State switcher — dev affordance, bottom-left */}
        <WsStateSwitcher state={wsState} onChange={setWsState} />
      </React.Fragment>
    );
  }

  function WsStateSwitcher({ state, onChange }) {
    const states = [
      { id: 'ready',    label: 'Ready',    color: 'var(--green)' },
      { id: 'empty',    label: 'Empty',    color: 'var(--text-3)' },
      { id: 'scanning', label: 'Scanning', color: 'var(--amber)' },
      { id: 'invalid',  label: 'Invalid',  color: 'var(--red)' },
    ];
    return (
      <div style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 300,
        background: 'var(--bg-1)', border: '1px solid var(--line)',
        borderRadius: 6, padding: 6, display: 'flex', gap: 2,
        fontFamily: 'var(--mono)', fontSize: 10.5,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}>
        <span style={{ padding: '4px 8px', color: 'var(--text-3)', alignSelf: 'center' }}>ws:</span>
        {states.map(s => (
          <button key={s.id}
            onClick={() => onChange(s.id)}
            style={{
              padding: '4px 8px', borderRadius: 4,
              background: state === s.id ? 'var(--bg-3)' : 'transparent',
              border: '1px solid ' + (state === s.id ? 'var(--line-2)' : 'transparent'),
              color: state === s.id ? s.color : 'var(--text-3)',
              cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10.5,
            }}>
            <span style={{ color: s.color }}>●</span> {s.label}
          </button>
        ))}
      </div>
    );
  }

  // ─── State 1: Empty — no workspace opened ─────────────────────
  function EmptyWorkspace({ recentPaths, onOpen }) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--mono)', color: 'var(--text)',
        zIndex: 50,
      }}>
        {/* bg grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.4,
          backgroundImage: 'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
        }} />

        <div style={{ position: 'relative', width: 'min(560px, 90vw)', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20, color: 'var(--green)', lineHeight: 1, fontWeight: 300 }}>λ</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.2em', marginBottom: 10 }}>CLAUDE CODE WORKFLOW</div>
          <h1 style={{ fontSize: 22, color: 'var(--text)', fontWeight: 600, margin: '0 0 10px', fontFamily: 'var(--mono)' }}>
            Open a workspace to begin
          </h1>
          <p style={{ color: 'var(--text-3)', fontFamily: 'var(--sans)', fontSize: 13.5, lineHeight: 1.6, margin: '0 auto 28px', maxWidth: 420 }}>
            Select a folder containing <code style={{ color: 'var(--green)', background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11.5 }}>.claude/</code> and <code style={{ color: 'var(--green)', background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11.5 }}>docs/</code>. The board will scan your commands, agents, PRDs and tasks, then bind them to lanes.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
            <button onClick={onOpen} style={{
              padding: '10px 18px',
              background: 'var(--green)', color: '#0a0e0b',
              border: 'none', borderRadius: 5,
              fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.04em', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 0 20px rgba(110,231,127,0.2)',
            }}>
              <span>▸</span> Open folder…
            </button>
            <button style={{
              padding: '10px 18px',
              background: 'transparent', color: 'var(--text-2)',
              border: '1px solid var(--line)', borderRadius: 5,
              fontFamily: 'var(--mono)', fontSize: 12,
              cursor: 'pointer',
            }}>
              Clone from Git…
            </button>
          </div>

          {/* Recent */}
          <div style={{ textAlign: 'left', borderTop: '1px solid var(--line)', paddingTop: 18 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Recent</div>
            {recentPaths.map((p, i) => (
              <div key={i}
                onClick={onOpen}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 4,
                  cursor: 'pointer', fontSize: 12, color: 'var(--text-2)',
                  background: 'var(--bg-1)', border: '1px solid var(--line)',
                  marginBottom: 4,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-1)'}
              >
                <span style={{ color: 'var(--text-3)' }}>📁</span>
                <span>{p}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>↵</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
            ⌘O &nbsp; open folder &nbsp;·&nbsp; ⌘K &nbsp; command palette
          </div>
        </div>
      </div>
    );
  }

  // ─── State 2: Scanning — loading progress ─────────────────────
  function ScanningWorkspace({ onDone }) {
    const [progress, setProgress] = useState(0);
    const [currentFile, setCurrentFile] = useState('.claude/');
    const files = [
      '.claude/commands/prd.md',
      '.claude/commands/plan.md',
      '.claude/commands/code.md',
      '.claude/commands/test.md',
      '.claude/agents/code-reviewer.md',
      '.claude/agents/test-writer.md',
      '.claude/rules/no-hardcode.md',
      '.claude/rules/coding-style.md',
      'docs/prds/PRD-042.md',
      'docs/prds/PRD-043.md',
      'docs/tasks/tasks-042.json',
      'docs/bug-reports/BUG-17.md',
      'docs/retrospectives/2026-04-21.json',
    ];

    useEffect(() => {
      let idx = 0;
      const tick = setInterval(() => {
        idx++;
        if (idx >= files.length) {
          clearInterval(tick);
          setProgress(100);
          setTimeout(onDone, 300);
          return;
        }
        setCurrentFile(files[idx]);
        setProgress(Math.round((idx / files.length) * 100));
      }, 180);
      return () => clearInterval(tick);
    }, []);

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--mono)', color: 'var(--text)',
        zIndex: 50,
      }}>
        {/* top scan line */}
        <div style={{ position: 'relative', height: 2, background: 'var(--line)' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: progress + '%', background: 'var(--green)',
            boxShadow: '0 0 12px rgba(110,231,127,0.6)',
            transition: 'width 0.2s ease-out',
          }} />
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 'min(520px, 90vw)', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 20px',
              border: '2px solid var(--line)', borderTopColor: 'var(--green)',
              borderRadius: '50%', animation: 'wf-spin 0.9s linear infinite',
            }} />
            <style>{`@keyframes wf-spin { to { transform: rotate(360deg); } }`}</style>

            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.12em', marginBottom: 8 }}>SCANNING WORKSPACE</div>
            <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4, fontWeight: 600 }}>~/code/claude-code-work</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 24 }}>parsing <code style={{ color: 'var(--green)' }}>.claude/</code> and <code style={{ color: 'var(--green)' }}>docs/</code> …</div>

            {/* current file */}
            <div style={{
              background: 'var(--bg-1)', border: '1px solid var(--line)',
              borderRadius: 4, padding: '8px 12px',
              fontSize: 11, color: 'var(--text-2)',
              display: 'flex', alignItems: 'center', gap: 8,
              textAlign: 'left',
            }}>
              <span style={{ color: 'var(--green)' }}>▸</span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentFile}</span>
              <span style={{ color: 'var(--text-3)' }}>{progress}%</span>
            </div>

            {/* mini counters */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 20,
              marginTop: 18, fontSize: 10.5, color: 'var(--text-3)',
            }}>
              <span>commands <b style={{ color: 'var(--text)' }}>{Math.min(10, Math.ceil(progress / 10))}</b></span>
              <span>·</span>
              <span>agents <b style={{ color: 'var(--text)' }}>{Math.min(4, Math.ceil(progress / 25))}</b></span>
              <span>·</span>
              <span>rules <b style={{ color: 'var(--text)' }}>{Math.min(5, Math.ceil(progress / 20))}</b></span>
              <span>·</span>
              <span>prds <b style={{ color: 'var(--text)' }}>{Math.min(3, Math.ceil(progress / 33))}</b></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── State 3: Invalid — folder lacks .claude/ ─────────────────
  function InvalidWorkspace({ path, onPick, onContinue }) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--mono)', color: 'var(--text)',
        zIndex: 50,
      }}>
        <div style={{ width: 'min(560px, 90vw)' }}>
          {/* warning banner */}
          <div style={{
            background: 'rgba(255,181,71,0.08)',
            border: '1px solid rgba(255,181,71,0.3)',
            borderLeft: '3px solid var(--amber)',
            borderRadius: 5, padding: '14px 16px',
            marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span style={{ color: 'var(--amber)', fontSize: 18, lineHeight: 1 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--amber)', fontWeight: 700, fontSize: 12, marginBottom: 4, letterSpacing: '0.04em' }}>
                NOT A CLAUDE CODE WORKFLOW PROJECT
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: 12, fontFamily: 'var(--sans)', lineHeight: 1.55 }}>
                This folder doesn't contain <code style={{ color: 'var(--amber)', fontFamily: 'var(--mono)', fontSize: 11 }}>.claude/</code>. The board needs a workflow manifest to render lanes.
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-1)', border: '1px solid var(--line)',
            borderRadius: 5, padding: 14, marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Opened folder</div>
            <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 10 }}>{path}</div>

            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginBottom: 6 }}>detected:</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', paddingLeft: 6 }}>
              <div>├─ <span style={{ color: 'var(--red)' }}>✗</span> <span style={{ color: 'var(--text-3)' }}>.claude/</span>   <span style={{ color: 'var(--text-3)' }}>(missing)</span></div>
              <div>├─ <span style={{ color: 'var(--red)' }}>✗</span> <span style={{ color: 'var(--text-3)' }}>docs/</span>      <span style={{ color: 'var(--text-3)' }}>(missing)</span></div>
              <div>├─ <span style={{ color: 'var(--green)' }}>✓</span> package.json</div>
              <div>├─ <span style={{ color: 'var(--green)' }}>✓</span> src/</div>
              <div>└─ <span style={{ color: 'var(--green)' }}>✓</span> README.md</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={onPick} style={{
              padding: '9px 14px', background: 'var(--green)', color: '#0a0e0b',
              border: 'none', borderRadius: 5,
              fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700,
              cursor: 'pointer',
            }}>
              ▸ Choose different folder
            </button>
            <button onClick={onContinue} style={{
              padding: '9px 14px', background: 'var(--bg-2)', color: 'var(--text-2)',
              border: '1px solid var(--line)', borderRadius: 5,
              fontFamily: 'var(--mono)', fontSize: 11.5,
              cursor: 'pointer',
            }}>
              Initialize here
            </button>
            <button style={{
              padding: '9px 14px', background: 'transparent', color: 'var(--text-3)',
              border: '1px solid var(--line)', borderRadius: 5,
              fontFamily: 'var(--mono)', fontSize: 11.5,
              cursor: 'pointer',
            }}>
              View docs
            </button>
          </div>

          <div style={{
            fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--sans)',
            lineHeight: 1.55, borderTop: '1px solid var(--line)', paddingTop: 12,
          }}>
            <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)', marginBottom: 4 }}>Expected structure:</div>
            <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-3)', fontSize: 10.5, paddingLeft: 8 }}>
              <div>workspace/</div>
              <div>├─ .claude/commands/*.md</div>
              <div>├─ .claude/agents/*.md</div>
              <div>├─ .claude/rules/*.md</div>
              <div>└─ docs/prds, docs/tasks, docs/bug-reports, docs/retrospectives</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<WorkspaceShell />);
})();

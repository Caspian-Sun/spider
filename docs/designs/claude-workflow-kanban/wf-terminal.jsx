// Workflow-aware terminal. Lightweight wrapper around the shell helper
// with support for a "claude slash-command" simulator alongside shell commands.

(function () {
  const { useState, useRef, useEffect, useCallback } = React;

  // Fake output scripts for Claude slash-commands. Indexed by command name.
  const CC_SCRIPTS = {
    'prd': [
      { d: 150, l: [{ cls: 'out-dim', text: '▶ /prd — Requirements → Structured PRD' }] },
      { d: 300, l: [{ html: '<span class="c-blue">reading</span> docs/prds/_template.md' }] },
      { d: 500, l: [{ html: '<span class="c-purple">anchor</span> PRD-042 created' }] },
      { d: 600, l: [{ html: '  • goal        <span class="c-green">filled</span>' },
                    { html: '  • actors      <span class="c-green">filled</span>' },
                    { html: '  • flows       <span class="c-amber">[TBD]</span> 2 placeholders' }] },
      { d: 400, l: [{ cls: 'out-ok', text: '✓ PRD draft written → docs/prds/prd-042.md' }] },
      { d: 200, l: [{ cls: 'out-dim', text: 'next: run /prd-check to clear TBDs' }] },
    ],
    'prd-check': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /prd-check — Gate: zero-out placeholders' }] },
      { d: 400, l: [{ html: '<span class="c-red">FAIL</span>  docs/prds/prd-042.md has 2 [TBD]' }] },
      { d: 300, l: [{ cls: 'out-err', text: '  • flows.login   [TBD]' },
                    { cls: 'out-err', text: '  • flows.logout  [TBD]' }] },
      { d: 200, l: [{ cls: 'out-dim', text: 'gate blocked; awaiting human input' }] },
    ],
    'plan': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /plan — PRD → Task manifest' }] },
      { d: 500, l: [{ html: '<span class="c-blue">reading</span> docs/prds/prd-042.md' }] },
      { d: 600, l: [{ html: '<span class="c-purple">decomposing</span> 14 tasks across 3 modules' }] },
      { d: 700, l: [{ html: '  • <span class="c-green">auth</span>    5 tasks' },
                    { html: '  • <span class="c-green">user</span>    6 tasks' },
                    { html: '  • <span class="c-green">layout</span>  3 tasks' }] },
      { d: 400, l: [{ cls: 'out-ok', text: '✓ tasks → docs/tasks/tasks-042.json' }] },
    ],
    'plan-check': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /plan-check — Gate: task manifest complete' }] },
      { d: 400, l: [{ html: '  • prdRef present       <span class="c-green">✓</span>' },
                    { html: '  • dependencies DAG     <span class="c-green">✓</span>' },
                    { html: '  • @rules traceable     <span class="c-green">✓</span>' }] },
      { d: 300, l: [{ cls: 'out-ok', text: '✓ gate passed — plan approved' }] },
    ],
    'code': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /code — Task manifest → Artifact' }] },
      { d: 400, l: [{ html: '<span class="c-blue">T001</span> userApi        <span class="c-green">✓</span>' }] },
      { d: 500, l: [{ html: '<span class="c-blue">T002</span> useUserStore   <span class="c-green">✓</span>' }] },
      { d: 600, l: [{ html: '<span class="c-blue">T003</span> UserTable      <span class="c-amber">~</span> writing' }] },
      { d: 700, l: [{ html: '<span class="c-dim">  │</span> header @prd/@task/@rules injected' },
                    { html: '<span class="c-dim">  │</span> no-hardcode hook passed' }] },
      { d: 300, l: [{ cls: 'out-ok', text: '✓ 3/5 tasks done; 2 in progress' }] },
    ],
    'test': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /test — @rules → it() cases' }] },
      { d: 400, l: [{ html: '<span class="c-purple">spawn</span> test-writer (userApi)' }] },
      { d: 300, l: [{ html: '<span class="c-purple">spawn</span> test-writer (UserTable)' }] },
      { d: 800, l: [{ html: '<span class="c-green">PASS</span>  userApi.test.ts (8 its)' }] },
      { d: 400, l: [{ html: '<span class="c-red">FAIL</span>  UserTable.test.tsx (1/7)' }] },
      { d: 200, l: [{ cls: 'out-err', text: '  ● "row click opens drawer" — expected 1 call, got 0' }] },
    ],
    'review': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /review — independent-perspective audit' }] },
      { d: 400, l: [{ html: '<span class="c-purple">spawn</span> code-reviewer (src/features/user)' }] },
      { d: 900, l: [{ html: '<span class="c-amber">~</span> 3 findings' }] },
      { d: 200, l: [{ html: '  • UserTable uses inline style (rules/coding-style)' },
                    { html: '  • apiClient missing @rules anchor (rules/file-docs)' },
                    { html: '  • magic number 50 in pager (rules/no-hardcode)' }] },
    ],
    'build': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /build — productization' }] },
      { d: 400, l: [{ html: '<span class="c-dim">[1/4]</span> type-check <span class="c-green">✓</span>' }] },
      { d: 500, l: [{ html: '<span class="c-dim">[2/4]</span> bundling ' }] },
      { d: 700, l: [{ html: '<span class="c-dim">[3/4]</span> minify + tree-shake' }] },
      { d: 400, l: [{ html: '<span class="c-dim">[4/4]</span> write dist/ <span class="c-green">✓</span>' }] },
      { d: 300, l: [{ cls: 'out-ok', text: '✓ 2.1 MB in 3.8s' }] },
    ],
    'deploy': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /deploy — target: production' }] },
      { d: 800, l: [{ html: '<span class="c-amber">~</span> rolling to 3 regions' }] },
      { d: 600, l: [{ html: '<span class="c-green">✓</span> us-east-1 · eu-west-1 · ap-south-1' }] },
      { d: 300, l: [{ cls: 'out-ok', text: '✓ v0.1.0 live' }] },
    ],
    'release': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /release — aggregate changelog + tag' }] },
      { d: 500, l: [{ html: '<span class="c-teal">skill</span> ext-changelog (range v0.0.9…HEAD)' }] },
      { d: 400, l: [{ html: '  + 14 commits · 3 features · 4 fixes' }] },
      { d: 400, l: [{ cls: 'out-ok', text: '✓ tagged v0.1.0 · CHANGELOG.md updated' }] },
    ],
    'fix': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /fix — bug-report → patch' }] },
      { d: 400, l: [{ html: '<span class="c-purple">spawn</span> bug-fixer × 3 (parallel)' }] },
      { d: 900, l: [{ html: '<span class="c-green">✓</span> BUG-114 race in useUserStore' }] },
      { d: 700, l: [{ html: '<span class="c-green">✓</span> BUG-115 empty-state missing' }] },
      { d: 500, l: [{ html: '<span class="c-amber">~</span> BUG-116 still reproducing' }] },
    ],
    'bug-check': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /bug-check — scan workspace for regressions' }] },
      { d: 600, l: [{ html: '<span class="c-green">✓</span> 0 stacktraces in last 24h' }] },
      { d: 400, l: [{ html: '<span class="c-amber">~</span> 2 flaky tests (see retrospectives/)' }] },
    ],
    'meta-audit': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /meta-audit — god-view health scan' }] },
      { d: 600, l: [{ html: '<span class="c-purple">spawn</span> meta-auditor (independent context)' }] },
      { d: 1200, l: [{ html: '  scanning 218 files…' }] },
      { d: 600, l: [{ html: '<span class="c-amber">drift</span> 3 files missing @prd anchor' },
                    { html: '<span class="c-amber">drift</span> 1 dead rule reference' }] },
      { d: 300, l: [{ cls: 'out-ok', text: '✓ report → docs/retrospectives/2026-04-21.md' }] },
    ],
    'start': [
      { d: 200, l: [{ cls: 'out-dim', text: '▶ /start — onboarding scan' }] },
      { d: 500, l: [{ html: '<span class="c-blue">scan</span> workspace/src/ · 218 files · 14 modules' }] },
      { d: 400, l: [{ html: '<span class="c-blue">scan</span> docs/tasks/ · 3 manifests · 14/23 done' }] },
      { d: 300, l: [{ cls: 'out-dim', text: 'awaiting next command…' }] },
    ],
    // sub-agents
    'test-writer': [
      { d: 150, l: [{ cls: 'out-dim', text: '▶ agent test-writer · isolated ctx' }] },
      { d: 300, l: [{ html: '  read <span class="c-blue">src/features/user/UserTable.tsx</span>' }] },
      { d: 400, l: [{ html: '  parse @rules → 7 bullets → 7 it() cases' }] },
      { d: 500, l: [{ cls: 'out-ok', text: '✓ UserTable.test.tsx written' }] },
    ],
    'code-reviewer': [
      { d: 150, l: [{ cls: 'out-dim', text: '▶ agent code-reviewer · read-only' }] },
      { d: 400, l: [{ html: '  scanning 18 files' }] },
      { d: 600, l: [{ html: '<span class="c-amber">~</span> 3 findings, 0 blockers' }] },
    ],
    'bug-fixer': [
      { d: 150, l: [{ cls: 'out-dim', text: '▶ agent bug-fixer · bug BUG-114' }] },
      { d: 500, l: [{ html: '  reproduce: <span class="c-green">✓</span>' }] },
      { d: 500, l: [{ html: '  patch + regression test' }] },
      { d: 300, l: [{ cls: 'out-ok', text: '✓ patched · test green' }] },
    ],
    'meta-auditor': [
      { d: 150, l: [{ cls: 'out-dim', text: '▶ agent meta-auditor · god-view' }] },
      { d: 800, l: [{ html: '  cross-check @prd ↔ @task ↔ @rules' }] },
      { d: 500, l: [{ cls: 'out-ok', text: '✓ retro written' }] },
    ],
    'ext-changelog': [
      { d: 150, l: [{ cls: 'out-dim', text: '▶ skill ext-changelog' }] },
      { d: 500, l: [{ html: '  range v0.0.9…HEAD · 14 commits' }] },
      { d: 300, l: [{ cls: 'out-ok', text: '✓ CHANGELOG fragment generated' }] },
    ],
    'ext-a11y-check': [
      { d: 150, l: [{ cls: 'out-dim', text: '▶ skill ext-a11y-check (WCAG AA)' }] },
      { d: 600, l: [{ html: '<span class="c-amber">~</span> 2 contrast warnings' }] },
    ],
    'ext-dep-audit': [
      { d: 150, l: [{ cls: 'out-dim', text: '▶ skill ext-dep-audit' }] },
      { d: 600, l: [{ html: '<span class="c-green">✓</span> no outdated critical deps' }] },
    ],
    'ext-perf-audit': [
      { d: 150, l: [{ cls: 'out-dim', text: '▶ skill ext-perf-audit' }] },
      { d: 600, l: [{ html: '  LCP 1.4s · CLS 0.02 · TTI 2.1s' }] },
    ],
    'check-hardcode': [
      { d: 150, l: [{ cls: 'out-dim', text: '▶ hook check-hardcode (silent guard)' }] },
      { d: 400, l: [{ html: '<span class="c-green">✓</span> 0 magic numbers, 0 inline strings' }] },
    ],
  };

  function WFTerminal({ cmd, autoRun, short, onStatusChange, cwd = '~/claude-code-work' }) {
    const [lines, setLines] = useState([]);
    const [input, setInput] = useState('');
    const [running, setRunning] = useState(false);
    const [history, setHistory] = useState([]);
    const [histIdx, setHistIdx] = useState(-1);
    const outRef = useRef(null);
    const inputRef = useRef(null);
    const shellRef = useRef(null);
    const timersRef = useRef([]);
    const booted = useRef(false);

    if (!shellRef.current && window.createShell) shellRef.current = window.createShell();

    useEffect(() => {
      if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
    }, [lines]);

    useEffect(() => {
      if (booted.current) return;
      booted.current = true;
      if (autoRun && cmd) {
        setTimeout(() => runClaudeCommand(cmd), 300 + Math.random() * 400);
      }
    }, []);

    const emit = useCallback((line) => {
      setLines(prev => [...prev, { type: 'out', ...line }]);
    }, []);

    const pushCmd = useCallback((raw) => {
      setLines(prev => [...prev, { type: 'cmd', text: raw }]);
    }, []);

    const runClaudeCommand = useCallback((name) => {
      const n = name.replace(/^\//, '');
      const script = CC_SCRIPTS[n];
      pushCmd('/' + n);
      if (!script) {
        emit({ cls: 'out-err', text: 'unknown command: /' + n });
        return;
      }
      setRunning(true);
      onStatusChange && onStatusChange('run');
      let t = 0;
      script.forEach((s, i) => {
        t += s.d;
        const tm = setTimeout(() => {
          s.l.forEach(line => emit(line));
          if (i === script.length - 1) {
            setRunning(false);
            const failed = s.l.some(l => (l.cls || '').includes('err'));
            onStatusChange && onStatusChange(failed ? 'err' : 'ok');
          }
        }, t);
        timersRef.current.push(tm);
      });
    }, [emit, onStatusChange, pushCmd]);

    const runShell = (raw) => {
      if (!shellRef.current) { emit({ cls: 'out-err', text: 'shell not ready' }); return; }
      pushCmd(raw);
      setHistory(h => [...h, raw]);
      const ctx = {
        emit,
        clear: () => setLines([]),
        finish: (code) => { setRunning(false); onStatusChange && onStatusChange(code === 0 ? 'ok' : 'err'); },
        cwdChanged: () => {},
        runAgent: (name) => runClaudeCommand(name),
        getHistory: () => history,
      };
      shellRef.current.execute(raw, ctx);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (running) return;
        const v = input.trim();
        setInput(''); setHistIdx(-1);
        if (!v) return;
        if (v.startsWith('/')) runClaudeCommand(v);
        else runShell(v);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!history.length) return;
        const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
        setHistIdx(next); setInput(history[next] || '');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = histIdx + 1;
        if (next >= history.length) { setHistIdx(-1); setInput(''); }
        else { setHistIdx(next); setInput(history[next] || ''); }
      } else if (e.key === 'c' && e.ctrlKey) {
        timersRef.current.forEach(clearTimeout); timersRef.current = [];
        if (running) { emit({ cls: 'out-err', text: '^C' }); setRunning(false); }
        setInput('');
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        setLines([]);
      }
    };

    const renderLine = (l, i) => {
      if (l.type === 'cmd') {
        return (
          <span className="term-line cmd" key={i}>
            <span className="prompt">claude</span>
            <span> </span>
            <span className="cwd">{cwd}</span>
            <span className="tick"> ❯ </span>
            <span>{l.text}</span>{'\n'}
          </span>
        );
      }
      if (l.html) return <span className={'term-line ' + (l.cls || '')} key={i} dangerouslySetInnerHTML={{ __html: l.html + '\n' }} />;
      return <span className={'term-line ' + (l.cls || '')} key={i}>{l.text || ''}{'\n'}</span>;
    };

    return (
      <div className={'term' + (short ? ' short' : '')} onClick={() => inputRef.current && inputRef.current.focus()}>
        <div className="term-output" ref={outRef}>{lines.map(renderLine)}</div>
        <div className="term-input-row">
          <span className="prompt">claude</span>
          <span className="cwd">{cwd}</span>
          <span style={{ color: 'var(--text-3)' }}>❯</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={running}
            spellCheck={false}
            autoComplete="off"
            placeholder={running ? 'running… (Ctrl+C)' : 'type /command or shell'}
          />
        </div>
      </div>
    );
  }

  window.WFTerminal = WFTerminal;
  window.CC_SCRIPTS = CC_SCRIPTS;
})();

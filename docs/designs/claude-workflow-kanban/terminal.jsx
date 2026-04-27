// Terminal component — renders output, handles input, history,
// runs shell commands via the createShell helper.

(function () {
  const { useState, useRef, useEffect, useCallback, useMemo } = React;

  function Terminal({ cardId, title, initialCwd, onStatusChange, autoFocus, compact, onBootCommands }) {
    const [lines, setLines] = useState([]);
    const [prompt, setPrompt] = useState({ user: 'dev', host: 'agent', cwd: initialCwd || '~/project' });
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const [histIdx, setHistIdx] = useState(-1);
    const [running, setRunning] = useState(false);
    const outRef = useRef(null);
    const inputRef = useRef(null);
    const shellRef = useRef(null);
    const runningTimers = useRef([]);
    const booted = useRef(false);

    if (!shellRef.current) shellRef.current = window.createShell();

    useEffect(() => {
      setPrompt(shellRef.current.getPrompt());
    }, []);

    useEffect(() => {
      if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
    }, [lines]);

    // Auto-run boot commands on first mount (to give each terminal personality)
    useEffect(() => {
      if (booted.current) return;
      booted.current = true;
      if (onBootCommands && onBootCommands.length) {
        let delay = 100;
        onBootCommands.forEach((c) => {
          setTimeout(() => runCommand(c, true), delay);
          delay += 400;
        });
      }
    }, []);

    const emit = useCallback((line) => {
      setLines(prev => [...prev, { type: 'out', ...line }]);
    }, []);

    const clearLines = useCallback(() => setLines([]), []);

    const runAgent = useCallback((name) => {
      const steps = window.shellAgents[name];
      if (!steps) { emit({ cls: 'out-err', text: 'agent not found: ' + name }); finishRun(1); return; }
      setRunning(true);
      onStatusChange && onStatusChange('run');
      let t = 0;
      steps.forEach((s, i) => {
        t += s.delay;
        const timer = setTimeout(() => {
          s.lines.forEach(l => emit(l));
          if (i === steps.length - 1) {
            setRunning(false);
            onStatusChange && onStatusChange(name === 'test' ? 'err' : 'ok');
          }
        }, t);
        runningTimers.current.push(timer);
      });
    }, [emit, onStatusChange]);

    const finishRun = useCallback((code) => {
      setRunning(false);
      if (onStatusChange) {
        if (code === 0) onStatusChange('ok');
        else onStatusChange('err');
      }
    }, [onStatusChange]);

    const runCommand = useCallback((raw, silent) => {
      const shell = shellRef.current;
      if (!silent) {
        setLines(prev => [...prev, { type: 'cmd', prompt, text: raw }]);
        setHistory(prev => [...prev, raw]);
      } else {
        setLines(prev => [...prev, { type: 'cmd', prompt: shell.getPrompt(), text: raw }]);
      }
      setHistIdx(-1);

      const ctx = {
        emit,
        clear: clearLines,
        finish: finishRun,
        cwdChanged: (cwd) => setPrompt(p => ({ ...p, cwd })),
        runAgent,
        getHistory: () => history,
      };
      shell.execute(raw, ctx);
    }, [prompt, emit, clearLines, finishRun, runAgent, history]);

    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (running) return;
        const v = input;
        setInput('');
        if (v.trim()) runCommand(v);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!history.length) return;
        const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
        setHistIdx(next);
        setInput(history[next] || '');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx < 0) return;
        const next = histIdx + 1;
        if (next >= history.length) { setHistIdx(-1); setInput(''); }
        else { setHistIdx(next); setInput(history[next] || ''); }
      } else if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault();
        runningTimers.current.forEach(clearTimeout);
        runningTimers.current = [];
        if (running) { emit({ cls: 'out-err', text: '^C' }); finishRun(130); }
        setInput('');
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        clearLines();
      }
    };

    const renderLine = (l, i) => {
      if (l.type === 'cmd') {
        return (
          <span className="term-line cmd" key={i}>
            <span className="prompt">{l.prompt.user}@{l.prompt.host}</span>
            <span> </span>
            <span className="cwd">{l.prompt.cwd}</span>
            <span className="tick"> $ </span>
            <span>{l.text}</span>
            {'\n'}
          </span>
        );
      }
      if (l.html) {
        return <span className={'term-line ' + (l.cls || '')} key={i} dangerouslySetInnerHTML={{ __html: l.html + '\n' }} />;
      }
      return <span className={'term-line ' + (l.cls || '')} key={i}>{l.text || ''}{'\n'}</span>;
    };

    const focusInput = () => inputRef.current && inputRef.current.focus();

    return (
      <div className="term" onClick={focusInput}>
        <div className="term-output" ref={outRef}>
          {lines.map(renderLine)}
        </div>
        <div className="term-input-row">
          <span className="prompt">{prompt.user}@{prompt.host}</span>
          <span className="cwd">{prompt.cwd}</span>
          <span className="tick" style={{ color: 'var(--text-3)' }}>$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            disabled={running}
            placeholder={running ? 'running… (Ctrl+C to cancel)' : ''}
          />
        </div>
      </div>
    );
  }

  window.Terminal = Terminal;
})();

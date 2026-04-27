// ---------------------------------------------------------------
// Fake shell simulator. Not a real shell, but convincing enough:
// supports common commands, cwd tracking, colored output, history,
// pipes as best-effort, simple redirection, and running "agents".
// ---------------------------------------------------------------

(function () {
  const FS_ROOT = {
    home: {
      dev: {
        project: {
          'README.md': '# Project\n\nAn experimental agent runner.\n',
          'package.json': '{\n  "name": "agent-runner",\n  "version": "0.1.0",\n  "scripts": {\n    "dev": "node src/index.js",\n    "build": "tsc -p .",\n    "test": "jest"\n  }\n}\n',
          '.gitignore': 'node_modules\ndist\n.env\n',
          src: {
            'index.js': '// entrypoint\nimport { run } from "./app.js";\nrun();\n',
            'app.js': 'export function run(){ console.log("hello"); }\n',
            'utils.js': 'export const now = () => new Date();\n',
          },
          logs: {
            'build.log': '[14:22:01] starting build\n[14:22:04] compiled 18 files\n[14:22:05] done in 3.8s\n',
          },
        },
      },
    },
  };

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function normalizePath(cwd, path) {
    if (!path) return cwd;
    let parts;
    if (path.startsWith('/')) parts = path.split('/').filter(Boolean);
    else if (path.startsWith('~')) parts = ['home', 'dev', ...path.slice(1).split('/').filter(Boolean)];
    else parts = [...cwd.split('/').filter(Boolean), ...path.split('/').filter(Boolean)];
    const out = [];
    for (const p of parts) {
      if (p === '.' || p === '') continue;
      if (p === '..') out.pop();
      else out.push(p);
    }
    return '/' + out.join('/');
  }

  function prettyCwd(cwd) {
    if (cwd === '/home/dev') return '~';
    if (cwd.startsWith('/home/dev/')) return '~/' + cwd.slice('/home/dev/'.length);
    return cwd;
  }

  function getNode(fs, cwd) {
    const parts = cwd.split('/').filter(Boolean);
    let node = fs;
    for (const p of parts) {
      if (node && typeof node === 'object' && p in node) node = node[p];
      else return null;
    }
    return node;
  }

  function setNode(fs, cwd, value) {
    const parts = cwd.split('/').filter(Boolean);
    let node = fs;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in node)) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }

  function isDir(node) { return node && typeof node === 'object'; }

  function tokenize(line) {
    // simple tokenizer, no escaping of quotes inside quotes
    const tokens = [];
    let buf = '', q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === q) { q = null; }
        else buf += c;
      } else {
        if (c === '"' || c === "'") q = c;
        else if (c === ' ') { if (buf) { tokens.push(buf); buf = ''; } }
        else buf += c;
      }
    }
    if (buf) tokens.push(buf);
    return tokens;
  }

  // -------- agent "programs" (long running tasks) ----------
  const agents = {
    'build': [
      { delay: 200, lines: [{ cls: 'out-dim', text: '▶ starting build pipeline' }] },
      { delay: 350, lines: [{ html: '<span class="c-dim">[1/5]</span> resolving deps <span class="c-green">✓</span>' }] },
      { delay: 500, lines: [{ html: '<span class="c-dim">[2/5]</span> type-check    <span class="c-green">✓</span>' }] },
      { delay: 700, lines: [{ html: '<span class="c-dim">[3/5]</span> transpiling 142 files' }] },
      { delay: 900, lines: [{ html: '<span class="c-dim">[4/5]</span> bundling <span class="c-blue">app.js</span>, <span class="c-blue">vendor.js</span>' }] },
      { delay: 500, lines: [{ html: '<span class="c-dim">[5/5]</span> writing <span class="c-blue">dist/</span> <span class="c-green">✓</span>' }] },
      { delay: 300, lines: [{ cls: 'out-ok', text: '✓ build finished in 3.8s · 2.1 MB → dist/' }] },
    ],
    'test': [
      { delay: 200, lines: [{ cls: 'out-dim', text: '▶ jest · 3 suites' }] },
      { delay: 500, lines: [{ html: '<span class="c-green">PASS</span>  src/utils.test.js <span class="c-dim">(0.42s)</span>' }] },
      { delay: 500, lines: [{ html: '<span class="c-green">PASS</span>  src/app.test.js <span class="c-dim">(0.81s)</span>' }] },
      { delay: 700, lines: [{ html: '<span class="c-red">FAIL</span>  src/api.test.js <span class="c-dim">(1.12s)</span>' }] },
      { delay: 200, lines: [{ cls: 'out-err', text: '  ● handles timeout' }, { cls: 'out-dim', text: '    expected 200, received 504' }] },
      { delay: 300, lines: [{ html: '<span class="c-dim">Tests:</span> <span class="c-green">14 passed</span>, <span class="c-red">1 failed</span>, 15 total' }] },
    ],
    'deploy': [
      { delay: 200, lines: [{ cls: 'out-dim', text: '▶ deploy · target: production' }] },
      { delay: 800, lines: [{ html: '<span class="c-amber">~</span> uploading artifact (2.1 MB)' }] },
      { delay: 1000, lines: [{ html: '<span class="c-amber">~</span> rolling out to 3 regions' }] },
      { delay: 700, lines: [{ html: '<span class="c-green">✓</span> us-east-1 healthy' }] },
      { delay: 400, lines: [{ html: '<span class="c-green">✓</span> eu-west-1 healthy' }] },
      { delay: 400, lines: [{ html: '<span class="c-green">✓</span> ap-south-1 healthy' }] },
      { delay: 300, lines: [{ cls: 'out-ok', text: '✓ deploy done · v0.1.0 live' }] },
    ],
    'watch': [
      { delay: 200, lines: [{ cls: 'out-dim', text: '▶ watching src/**' }] },
      { delay: 1500, lines: [{ html: '<span class="c-blue">change</span> src/app.js' }] },
      { delay: 300, lines: [{ cls: 'out-ok', text: '✓ recompiled in 184ms' }] },
      { delay: 2000, lines: [{ html: '<span class="c-blue">change</span> src/utils.js' }] },
      { delay: 300, lines: [{ cls: 'out-ok', text: '✓ recompiled in 202ms' }] },
    ],
    'ping': [
      { delay: 100, lines: [{ text: 'PING example.com (93.184.216.34): 56 data bytes' }] },
      { delay: 400, lines: [{ text: '64 bytes from 93.184.216.34: icmp_seq=0 ttl=56 time=12.4 ms' }] },
      { delay: 800, lines: [{ text: '64 bytes from 93.184.216.34: icmp_seq=1 ttl=56 time=11.9 ms' }] },
      { delay: 1200, lines: [{ text: '64 bytes from 93.184.216.34: icmp_seq=2 ttl=56 time=12.1 ms' }] },
      { delay: 1600, lines: [{ cls: 'out-dim', text: '--- example.com ping statistics ---' }, { text: '3 packets transmitted, 3 received, 0.0% loss' }] },
    ],
  };

  function createShell(opts = {}) {
    const fs = clone(FS_ROOT);
    let cwd = '/home/dev/project';
    const user = 'dev';
    const host = 'agent-441';
    const env = { USER: user, HOME: '/home/dev', SHELL: '/bin/ash', PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8' };

    function listDir(path) {
      const p = normalizePath(cwd, path || '.');
      const node = getNode(fs, p);
      if (node == null) return { err: 'ls: no such file or directory: ' + path };
      if (!isDir(node)) return { lines: [path] };
      const names = Object.keys(node).sort();
      const parts = names.map(n => isDir(node[n])
        ? `<span class="c-blue c-b">${n}/</span>`
        : `<span>${n}</span>`);
      return { lines: [{ html: parts.join('  ') }] };
    }

    function execute(raw, ctx) {
      // ctx = { emit(line), finish(code), onAgent(name, steps) }
      const line = raw.trim();
      if (!line) { ctx.finish(0); return; }

      const tokens = tokenize(line);
      const cmd = tokens[0];
      const args = tokens.slice(1);

      const emit = (x) => ctx.emit(x);
      const ok = () => ctx.finish(0);
      const fail = (msg) => { emit({ cls: 'out-err', text: msg }); ctx.finish(1); };

      switch (cmd) {
        case 'help': {
          emit({ cls: 'out-dim', text: 'builtins:' });
          emit({ html: '  <span class="c-green">help</span> · <span class="c-green">clear</span> · <span class="c-green">echo</span> <text> · <span class="c-green">ls</span> [dir] · <span class="c-green">pwd</span> · <span class="c-green">cd</span> <dir>' });
          emit({ html: '  <span class="c-green">cat</span> <file> · <span class="c-green">mkdir</span> <dir> · <span class="c-green">touch</span> <file> · <span class="c-green">rm</span> <file> · <span class="c-green">tree</span>' });
          emit({ html: '  <span class="c-green">date</span> · <span class="c-green">whoami</span> · <span class="c-green">env</span> · <span class="c-green">ps</span> · <span class="c-green">history</span>' });
          emit({ cls: 'out-dim', text: 'agents (long-running):' });
          emit({ html: '  <span class="c-amber">build</span> · <span class="c-amber">test</span> · <span class="c-amber">deploy</span> · <span class="c-amber">watch</span> · <span class="c-amber">ping</span> <host>' });
          return ok();
        }
        case 'clear': ctx.clear(); return ok();
        case 'echo': emit({ text: args.join(' ') }); return ok();
        case 'pwd': emit({ text: cwd }); return ok();
        case 'whoami': emit({ text: user }); return ok();
        case 'hostname': emit({ text: host }); return ok();
        case 'date': emit({ text: new Date().toString() }); return ok();
        case 'env': {
          Object.entries(env).forEach(([k, v]) => emit({ html: `<span class="c-amber">${k}</span>=${v}` }));
          return ok();
        }
        case 'history': {
          (ctx.getHistory() || []).forEach((h, i) => emit({ html: `<span class="c-dim">${String(i + 1).padStart(4)}</span>  ${h}` }));
          return ok();
        }
        case 'ls': {
          const r = listDir(args[0]);
          if (r.err) return fail(r.err);
          r.lines.forEach(l => emit(l));
          return ok();
        }
        case 'cd': {
          const target = args[0] || '~';
          const p = normalizePath(cwd, target);
          const node = getNode(fs, p);
          if (!node) return fail('cd: no such directory: ' + target);
          if (!isDir(node)) return fail('cd: not a directory: ' + target);
          cwd = p;
          ctx.cwdChanged(prettyCwd(cwd));
          return ok();
        }
        case 'cat': {
          if (!args[0]) return fail('cat: missing file');
          const p = normalizePath(cwd, args[0]);
          const node = getNode(fs, p);
          if (node == null) return fail('cat: no such file: ' + args[0]);
          if (isDir(node)) return fail('cat: is a directory: ' + args[0]);
          String(node).split('\n').forEach(line => emit({ text: line }));
          return ok();
        }
        case 'mkdir': {
          if (!args[0]) return fail('mkdir: missing name');
          const p = normalizePath(cwd, args[0]);
          if (getNode(fs, p)) return fail('mkdir: already exists: ' + args[0]);
          setNode(fs, p, {});
          return ok();
        }
        case 'touch': {
          if (!args[0]) return fail('touch: missing name');
          const p = normalizePath(cwd, args[0]);
          if (!getNode(fs, p)) setNode(fs, p, '');
          return ok();
        }
        case 'rm': {
          if (!args[0]) return fail('rm: missing name');
          const p = normalizePath(cwd, args[0]);
          const parts = p.split('/').filter(Boolean);
          const last = parts.pop();
          const parent = getNode(fs, '/' + parts.join('/'));
          if (!parent || !(last in parent)) return fail('rm: no such file: ' + args[0]);
          delete parent[last];
          return ok();
        }
        case 'tree': {
          function walk(node, prefix, depth) {
            if (depth > 3) return;
            const keys = Object.keys(node);
            keys.forEach((k, i) => {
              const last = i === keys.length - 1;
              const branch = last ? '└─ ' : '├─ ';
              if (isDir(node[k])) {
                emit({ html: `<span class="c-dim">${prefix}${branch}</span><span class="c-blue c-b">${k}/</span>` });
                walk(node[k], prefix + (last ? '   ' : '│  '), depth + 1);
              } else {
                emit({ html: `<span class="c-dim">${prefix}${branch}</span>${k}` });
              }
            });
          }
          emit({ html: '<span class="c-blue c-b">' + prettyCwd(cwd) + '</span>' });
          walk(getNode(fs, cwd) || {}, '', 0);
          return ok();
        }
        case 'ps': {
          emit({ html: '<span class="c-dim">  PID  USER  %CPU  CMD</span>' });
          emit({ text: '  101  dev    0.2  /bin/ash' });
          emit({ text: '  214  dev    1.8  node src/index.js' });
          emit({ text: '  302  dev    0.4  watchdog' });
          return ok();
        }
        case 'npm':
        case 'yarn':
        case 'pnpm': {
          const sub = args[0];
          if (sub === 'run' || sub === 'start') {
            const name = args[1] || 'start';
            if (name === 'build') return ctx.runAgent('build');
            if (name === 'test')  return ctx.runAgent('test');
            if (name === 'deploy') return ctx.runAgent('deploy');
            if (name === 'dev' || name === 'watch') return ctx.runAgent('watch');
            emit({ cls: 'out-err', text: `${cmd}: script not found: ${name}` });
            return ctx.finish(1);
          }
          if (sub === 'install' || sub === 'i') {
            emit({ cls: 'out-dim', text: `${cmd} install` });
            emit({ text: 'resolving...' });
            setTimeout(() => { emit({ cls: 'out-ok', text: '✓ installed 218 packages in 2.4s' }); ctx.finish(0); }, 700);
            return;
          }
          emit({ text: cmd + ' ' + args.join(' ') });
          return ok();
        }
        case 'build':
        case 'test':
        case 'deploy':
        case 'watch':
          return ctx.runAgent(cmd);
        case 'ping': {
          if (!args[0]) return fail('usage: ping <host>');
          return ctx.runAgent('ping');
        }
        case 'git': {
          const sub = args[0];
          if (sub === 'status') {
            emit({ html: 'On branch <span class="c-green">main</span>' });
            emit({ cls: 'out-dim', text: 'Changes not staged for commit:' });
            emit({ html: '  modified:   <span class="c-red">src/app.js</span>' });
            emit({ html: '  modified:   <span class="c-red">src/utils.js</span>' });
            return ok();
          }
          if (sub === 'log') {
            emit({ html: '<span class="c-amber">a1b2c3d</span> <span class="c-dim">(HEAD → main)</span> feat: kanban terminal' });
            emit({ html: '<span class="c-amber">d4e5f6a</span> fix: resize handle' });
            emit({ html: '<span class="c-amber">9f8e7d6</span> initial commit' });
            return ok();
          }
          if (sub === 'pull' || sub === 'push') {
            setTimeout(() => { emit({ cls: 'out-ok', text: '✓ ' + sub + ' complete' }); ctx.finish(0); }, 600);
            return;
          }
          emit({ text: 'git: unknown command: ' + sub });
          return ctx.finish(1);
        }
        case 'curl':
        case 'wget': {
          const url = args.find(a => !a.startsWith('-')) || 'https://example.com';
          emit({ cls: 'out-dim', text: `↻ GET ${url}` });
          setTimeout(() => {
            emit({ html: '<span class="c-green">HTTP/1.1 200 OK</span>' });
            emit({ text: 'content-type: application/json' });
            emit({ text: '{"ok":true,"ts":' + Date.now() + '}' });
            ctx.finish(0);
          }, 500);
          return;
        }
        case 'exit':
          emit({ cls: 'out-dim', text: 'logout' });
          return ok();
        default:
          emit({ cls: 'out-err', text: `${cmd}: command not found. try 'help'` });
          return ctx.finish(127);
      }
    }

    function getPrompt() {
      return { user, host, cwd: prettyCwd(cwd) };
    }

    return { execute, getPrompt, agents };
  }

  window.createShell = createShell;
  window.shellAgents = agents;
})();

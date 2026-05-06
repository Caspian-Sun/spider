/**
 * 注入 mock workspace 状态后截取看板截图，用于 Visual QA 对比。
 */
import { chromium } from 'playwright';

const mockWorkspace = {
  rootPath: '/Users/sundaotao/Desktop/AI-Automation/claude-code-workflow',
  commands: [
    { id: 'prd',       cmd: 'prd',       filePath: '.claude/commands/prd.md',       idx: 1,  title: 'PRD',       desc: 'Spoken requirement → Structured PRD with [TBD] placeholders.', inputs: [], outputs: ['PRD.md'],      gate: null,         helper: false, body: '' },
    { id: 'plan',      cmd: 'plan',      filePath: '.claude/commands/plan.md',      idx: 2,  title: 'Plan',      desc: 'PRD → Task manifest (prdRef + @rules bindings).',              inputs: ['PRD.md'],  outputs: ['tasks.json'], gate: 'prd-check',  helper: false, body: '' },
    { id: 'code',      cmd: 'code',      filePath: '.claude/commands/code.md',      idx: 3,  title: 'Code',      desc: 'Task manifest → code artifact with @prd/@task/@rules header.', inputs: ['tasks.json'], outputs: ['src/*.ts'], gate: 'plan-check', helper: false, body: '' },
    { id: 'test',      cmd: 'test',      filePath: '.claude/commands/test.md',      idx: 4,  title: 'Test',      desc: '@rules → it() cases (one per rule).',                          inputs: ['src/*.ts'], outputs: ['*.test'], gate: null,        helper: false, body: '' },
    { id: 'review',    cmd: 'review',    filePath: '.claude/commands/review.md',    idx: 5,  title: 'Review',    desc: 'Code quality gate.',                                            inputs: [], outputs: [],           gate: null,         helper: false, body: '' },
    { id: 'build',     cmd: 'build',     filePath: '.claude/commands/build.md',     idx: 6,  title: 'Build',     desc: 'Compile and bundle.',                                           inputs: [], outputs: [],           gate: null,         helper: false, body: '' },
    { id: 'deploy',    cmd: 'deploy',    filePath: '.claude/commands/deploy.md',    idx: 7,  title: 'Deploy',    desc: 'Deploy to target env.',                                         inputs: [], outputs: [],           gate: null,         helper: false, body: '' },
    { id: 'release',   cmd: 'release',   filePath: '.claude/commands/release.md',   idx: 8,  title: 'Release',   desc: 'Tag and publish release.',                                      inputs: [], outputs: [],           gate: null,         helper: false, body: '' },
    { id: 'fix',       cmd: 'fix',       filePath: '.claude/commands/fix.md',       idx: null,title:'Fix',        desc: 'Fix bugs.',                                                    inputs: [], outputs: [],           gate: null,         helper: true,  body: '' },
    { id: 'meta-audit',cmd: 'meta-audit',filePath: '.claude/commands/meta-audit.md',idx: null,title:'Meta-audit', desc: 'Meta audit.',                                                  inputs: [], outputs: [],           gate: null,         helper: true,  body: '' },
  ],
  agents: [
    { id: 'prd-check-agent',  name: 'prd-check',  desc: 'Hard gate — zero out [TBD].', filePath: '.claude/agents/prd-check.md',  boundCommands: ['prd']  },
    { id: 'plan-check-agent', name: 'plan-check', desc: 'Gate — DAG + traceability.',  filePath: '.claude/agents/plan-check.md', boundCommands: ['plan'] },
    { id: 'code-agent',       name: 'code',       desc: 'Writes code per task.',        filePath: '.claude/agents/code.md',       boundCommands: ['code'] },
    { id: 'test-writer',      name: 'test-writer',desc: 'Parallel per module.',         filePath: '.claude/agents/test-writer.md',boundCommands: ['test'] },
    { id: 'check-hardcode',   name: 'check-hardcode',desc:'Silent guard — no magic nums.',filePath:'.claude/agents/check-hardcode.md',boundCommands:['code']},
  ],
  rules: [],
  hooks: [],
  prds: [{ id: 'PRD-042', title: 'User management mo...', status: 'active', filePath: 'docs/prds/prd-042.md', prdRef: '', summary: '' }],
  tasks: [
    {
      id: 'TASKS-042',
      filePath: 'docs/tasks/tasks-042.json',
      moduleName: 'User management',
      moduleCode: 'user',
      status: 'in-progress',
      tasks: [
        { taskId: 'T001', name: 'userApi',      status: 'done',        type: 'api' },
        { taskId: 'T002', name: 'useUserStore', status: 'done',        type: 'store' },
        { taskId: 'T003', name: 'UserTable',    status: 'in-progress', type: 'component' },
        { taskId: 'T004', name: 'UserForm',     status: 'pending',     type: 'component' },
        { taskId: 'T005', name: 'UserPage',     status: 'pending',     type: 'page' },
      ],
    },
  ],
  bugReports: [],
  retrospectives: [],
  staticDocs: [],
  scanErrors: [],
};

const mockCards = [
  // Lane: prd
  { id: 'c-prd-main',   laneId: 'prd',  kind: 'main',  title: '/prd',        status: 'ok',   pinned: true,  width: 260, height: 200 },
  { id: 'c-prd-sub1',   laneId: 'prd',  kind: 'sub',   title: '/prd-check',  status: 'idle', pinned: false, width: 260, height: 160 },
  // Lane: plan
  { id: 'c-plan-main',  laneId: 'plan', kind: 'main',  title: '/plan',       status: 'ok',   pinned: true,  width: 260, height: 200 },
  { id: 'c-plan-sub1',  laneId: 'plan', kind: 'sub',   title: '/plan-check', status: 'idle', pinned: false, width: 260, height: 160 },
  // Lane: code
  { id: 'c-code-main',  laneId: 'code', kind: 'main',  title: '/code',       status: 'ok',   pinned: true,  width: 260, height: 200 },
  { id: 'c-code-sub1',  laneId: 'code', kind: 'sub',   title: 'test-writer', status: 'idle', pinned: false, width: 260, height: 160 },
  { id: 'c-code-log1',  laneId: 'code', kind: 'hook',  title: 'check-hardcode', status: 'ok', pinned: false, width: 260, height: 160 },
  // Lane: test
  { id: 'c-test-main',  laneId: 'test', kind: 'main',  title: '/test',       status: 'ok',   pinned: true,  width: 260, height: 200 },
  { id: 'c-test-sub1',  laneId: 'test', kind: 'sub',   title: 'test-writer', status: 'idle', pinned: false, width: 260, height: 160 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Mock Tauri IPC before page load
  await page.addInitScript((ws) => {
    const mockInvoke = async (cmd) => {
      if (cmd === 'get_recent_workspaces') return [ws.rootPath];
      if (cmd === 'validate_workspace') return { valid: true, detected: [] };
      if (cmd === 'scan_workspace') return ws;
      if (cmd === 'add_recent_workspace') return null;
      return null;
    };
    // @tauri-apps/api checks window.__TAURI_INTERNALS__
    window.__TAURI_INTERNALS__ = {
      invoke: mockInvoke,
      transformCallback: (cb) => { const id = Math.random(); window[`_cb_${id}`] = cb; return id; },
      convertFileSrc: (src) => src,
      metadata: { currentWindow: { label: 'main' } },
    };
    // Also mock event listen (no-op)
    window.__TAURI_INTERNALS__.listen = async () => () => {};
  }, mockWorkspace);

  await page.goto('http://localhost:1420');

  // Wait for kanban board (ActivityBar or TopBar) to appear
  try {
    await page.waitForSelector('[class*="bar"]', { timeout: 8000 });
    // Give React a moment to finish rendering
    await page.waitForTimeout(1500);
  } catch {
    console.log('Timeout waiting for board — taking screenshot of current state anyway');
  }

  const outPath = new URL('../docs/designs/screenshots/actual/actual-spider.png', import.meta.url).pathname;
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Screenshot saved to ${outPath}`);
  await browser.close();
})();

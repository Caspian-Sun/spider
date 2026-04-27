# P0: 禁止硬编码 — 详细规则

> 权重: P0 — 此规则优先级高于所有其他编码规范。任何违反此规则的代码不得提交。

## 核心原则

所有可能变化的值，必须通过配置、常量、Design Token 或国际化引入，严禁在代码中直接写死。
配置项本身不得大量重复，必须通过分层复用减少冗余。

## 禁止硬编码的范围

### 1. UI 文案与国际化

```tsx
// ❌ 禁止
<button>选择文件夹</button>
<span>暂无 PRD 文件</span>
toast.success('启动终端成功');

// ✅ 正确 — 通过 react-i18next
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
<button>{t('workspace.pickFolder')}</button>
<span>{t('prd.empty')}</span>
toast.success(t('terminal.spawnSuccess'));
```

### 2. 颜色、字号、间距 (Design Token)

设计稿 `docs/designs/claude-workflow-kanban/Workflow Kanban.html` 顶部 `:root` 定义了 CSS 变量, 必须在 `workspace/src/styles/tokens.ts` 集中映射, 再通过 CSS Modules 或 inline style 引用。

```tsx
// ❌ 禁止
<div style={{ color: '#5db075', fontSize: 14 }} />
<div className="text-[#5db075]" />  // 不要写魔法颜色到 className

// ✅ 正确
// workspace/src/styles/tokens.ts
export const tokens = {
  colorGreen: 'var(--green)',     // #5db075
  colorTeal:  'var(--teal)',
  fontSm:     'var(--font-sm)',
  laneWidth:  360,
} as const;

// 使用
import { tokens } from '@/styles/tokens';
<div style={{ color: tokens.colorGreen, fontSize: tokens.fontSm }} />
```

### 3. Tauri command 名 / event 名

前后端通过命令名字符串耦合, 一处拼错全链路断, 必须用常量。

```ts
// ❌ 禁止
await invoke('scan_workspace', { path });
listen('pty_output', handler);

// ✅ 正确 — workspace/src/ipc/contract.ts (与 Rust 端 Tauri command 名保持一一对应)
export const IPC = {
  Cmd: {
    SCAN_WORKSPACE: 'scan_workspace',
    PICK_WORKSPACE: 'pick_workspace_folder',
    PTY_SPAWN:      'pty_spawn',
    PTY_WRITE:      'pty_write',
  },
  Event: {
    PTY_OUTPUT:        'pty_output',
    WORKSPACE_CHANGED: 'workspace_changed',
    SCAN_PROGRESS:     'scan_progress',
  },
} as const;

import { invoke } from '@tauri-apps/api/core';
await invoke(IPC.Cmd.SCAN_WORKSPACE, { path });
```

> Rust 端同样不要在 `#[tauri::command]` 函数内部用魔法字符串拼 event 名, 用 `pub const PTY_OUTPUT_EVENT: &str = "pty_output";` 集中在 `src-tauri/src/events.rs`。

### 4. 文件路径与目录约定

```rust
// ❌ 禁止
let commands_dir = workspace.join(".claude/commands");
let prds_dir = workspace.join("docs/prds");

// ✅ 正确 — workspace/src-tauri/src/paths.rs
pub mod paths {
    pub const CLAUDE_DIR: &str        = ".claude";
    pub const COMMANDS_SUBDIR: &str   = "commands";
    pub const RULES_SUBDIR: &str      = "rules";
    pub const DOCS_DIR: &str          = "docs";
    pub const PRDS_SUBDIR: &str       = "prds";
    pub const TASKS_SUBDIR: &str      = "tasks";
}

let commands_dir = workspace.join(paths::CLAUDE_DIR).join(paths::COMMANDS_SUBDIR);
```

### 5. 业务枚举与状态码

```ts
// ❌ 禁止
if (card.state === 'running') { /* ... */ }
<Tag color="#5db075">running</Tag>

// ✅ 正确 — workspace/src/features/kanban/constants.ts
export const CARD_STATE = {
  IDLE:    'idle',
  RUNNING: 'running',
  WAIT:    'wait',
  PAUSED:  'paused',
  ERROR:   'error',
  DONE:    'done',
} as const;
export type CardState = typeof CARD_STATE[keyof typeof CARD_STATE];

export const CARD_STATE_COLOR: Record<CardState, string> = {
  idle:    'var(--text-mute)',
  running: 'var(--green)',
  wait:    'var(--yellow)',
  paused:  'var(--gray)',
  error:   'var(--red)',
  done:    'var(--teal)',
};
```

Rust 端用 enum + `#[serde(rename_all = "lowercase")]`:

```rust
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CardState { Idle, Running, Wait, Paused, Error, Done }
```

### 6. 时间、数量等魔法数字

```ts
// ❌ 禁止
setTimeout(fit, 200);
if (lines.length > 1000) { /* virtualize */ }

// ✅ 正确
const TERMINAL_FIT_DEBOUNCE_MS = 200;
const VIRTUAL_SCROLL_THRESHOLD = 1000;
```

### 7. PTY shell 路径与默认参数

```rust
// ❌ 禁止
let shell = "/bin/zsh";
let prompt_init = "\x1b[32m▌\x1b[0m ";

// ✅ 正确 — src-tauri/src/pty/config.rs
pub mod pty_config {
    pub const DEFAULT_SHELL_UNIX: &str = "/bin/zsh";
    pub const DEFAULT_SHELL_WIN:  &str = "powershell.exe";
    pub const FALLBACK_SHELL:     &str = "/bin/sh";
    pub const PROMPT_INIT:        &str = "\x1b[32m▌\x1b[0m ";
    pub const DEFAULT_COLS: u16 = 80;
    pub const DEFAULT_ROWS: u16 = 24;
}
```

> 如果系统已设置 `$SHELL`, 应优先用 `std::env::var("SHELL")` 而不是常量, 常量只是兜底。

### 8. 窗口尺寸 / 默认布局

写在 `tauri.conf.json` 或 Rust 端常量, 不要在前端组件里硬编。

## 配置防重复规则

```
spider/workspace/
├── src/
│   ├── styles/
│   │   └── tokens.ts                  # 唯一的 Design Token 定义源
│   ├── ipc/
│   │   └── contract.ts                # Tauri command/event 名常量
│   ├── i18n/
│   │   └── zh-CN.json                 # 全局国际化资源
│   ├── constants/                     # 全局共享常量 (分页大小 / 时间 / 正则)
│   └── features/<module>/constants.ts # 模块专属常量
└── src-tauri/src/
    ├── events.rs                      # 唯一的 event 名常量源
    ├── paths.rs                       # 文件路径常量
    ├── pty/config.rs                  # PTY 默认值
    └── commands/<module>/constants.rs # 模块专属常量
```

### 分层复用原则

| 层级           | 定义位置                                   | 示例                            |
| -------------- | ------------------------------------------ | ------------------------------- |
| Design Token   | `workspace/src/styles/tokens.ts`           | 颜色 / 字号 / 圆角 / 间距       |
| IPC 契约       | `workspace/src/ipc/contract.ts`            | command 名 / event 名           |
| 全局常量       | `workspace/src/constants/`                 | 分页大小 / 调试常量 / 正则      |
| 全局国际化     | `workspace/src/i18n/<lang>.json` 中 `common.*` | 通用文案 (确认 / 取消 / 关闭)   |
| 模块常量 (TS)  | `workspace/src/features/<m>/constants.ts`  | 业务状态码 / 下拉选项           |
| 模块常量 (Rust)| `workspace/src-tauri/src/<m>/constants.rs` | PTY 默认 / 路径 / 限制          |

### 禁止

- 多个模块各自定义相同的常量值 → 提取到全局常量层
- 多处重复定义相同的颜色 / token → 统一在 `tokens.ts`
- 前端拼字符串 + Rust 拼字符串各自维护一份 command/event 名 → IPC 契约只能有**一份**, 由 `contract.ts` 与 Rust 端 `events.rs` / `commands.rs` 通过自动生成或人工同步保证一致
- 前后端各自硬编同一个文件路径 → Rust 是真理之源 (`paths.rs`), 前端只通过 IPC 取到的 `Workspace.path` 使用, 不要自己拼

# 文件与模块说明规范

> 目的: 让任何 AI 模型或开发者接手项目时，能快速理解每个目录和文件的作用，降低维护成本。

## 核心规则

**每次创建或修改代码文件时，必须同步维护所在目录的 `README.md`。**

## 目录级 README.md

每个功能目录 (`components/`, `hooks/`, `stores/`, `utils/`, `ipc/`, `types/`, Rust 端的 `commands/`, `models/`, `pty/` 等) 都必须有一个 `README.md`，格式如下：

```markdown
# 目录名称

> 一句话描述这个目录的职责

## 文件清单

| 文件名 | 说明 | 依赖 | 最后更新 |
|--------|------|------|----------|
| AgentCard.tsx | 看板卡片, 渲染单个 PTY 终端会话 | usePtySession, AgentCard.module.css | 2026-04-27 |
| AgentCard.module.css | 卡片样式, 引用 tokens.colorGreen 等 | tokens | 2026-04-27 |

## 模块关系

> 简要描述本目录内文件之间、以及与其他模块的依赖关系
```

## 功能模块级 README.md

每个 `workspace/src/features/[module]/` 目录必须有一个顶层 `README.md`，格式如下：

```markdown
# 模块名称

> 模块的业务功能描述

## 子目录结构

| 目录 | 说明 |
|------|------|
| components/ | 模块专属 UI 组件 |
| hooks/ | 模块数据逻辑 hooks |
| ipc/ | Tauri command 调用封装 |
| stores/ | Zustand 状态管理 |
| types/ | TypeScript 类型定义 |
| utils/ | 模块工具函数 |

## 核心业务流程

> 用文字或简单流程描述核心逻辑，例如：
> 用户选择泳道命令 → spawnPty 调 Rust → 返回 sessionId → 前端订阅 pty_output event → xterm.write

## 对外暴露

> 列出本模块向外导出的主要组件、hooks、类型、IPC 调用, 供其他模块引用
```

## Rust 模块级 README

`workspace/src-tauri/src/<module>/` 下也维护 `README.md`, 字段类似, 但**依赖**列写 crate (如 `portable-pty`, `notify`) 而不是 npm 包。

## 文件头部注释 (TypeScript / TSX)

每个代码文件顶部必须包含说明注释：

```typescript
/**
 * @description 看板卡片, 渲染单个 PTY 终端会话, 支持启动/暂停/缩放
 * @module features/kanban/components
 * @dependencies usePtySession, useKanbanStore, xterm, tokens
 * @prd docs/prds/claude-workflow-kanban.md#终端卡片
 * @task docs/tasks/tasks-kanban-2026-04-27.json#T012
 * @design docs/designs/claude-workflow-kanban/Workflow Kanban.html (.agent.card 类) + wf-app.jsx AgentCard
 * @rules
 *   - 卡片状态为 idle 时, 终端区域显示「点击运行 /<cmd>」占位提示
 *   - 卡片状态切换为 running 时, 顶部状态点变绿色, 闪烁动画启动
 *   - 用户在终端输入时, 输入内容透传到 PTY (通过 invoke('pty_write'))
 *   - 双击标题栏切换紧凑/正常/扩展三档高度 (120 / 200 / 320)
 * @example
 *   <AgentCard cardId="card-001" laneCmd="/prd" />
 */
```

不同类型文件的字段需求:

- **组件 (.tsx)**: description, module, dependencies, **prd, task, design, rules**, props 说明, example
- **hooks (.ts)**: description, module, **prd, task, rules**, params, returns, example
- **stores (.ts)**: description, module, **prd, task, rules**, state 字段说明, actions 说明
- **utils (.ts)**: description, module, params, returns, example (纯工具函数通常无需 prd/rules)
- **IPC 封装 (.ts)**: description, module, **prd**, 调用的 Tauri command 名, params, returns
- **types (.ts)**: description, module, 各字段说明 + (如适用) 对应的 Rust struct 名

## 文件头部注释 (Rust)

Rust 文件用模块注释 `//\!` (放在文件最顶部, crate root 或 mod 文件):

```rust
//\! @description PTY 进程管理, 跨平台 spawn / read / write / kill
//\! @module pty
//\! @dependencies portable-pty, tokio, tracing
//\! @prd docs/prds/claude-workflow-kanban.md#终端卡片
//\! @task docs/tasks/tasks-kanban-2026-04-27.json#T020
//\! @rules
//\!   - 同一 cardId 重复 spawn 时, 先 kill 旧进程再起新进程
//\!   - PTY 输出按 chunk 通过 pty_output event 推送, 不在 Rust 端做任何过滤
//\!   - resize 失败时记 warn 日志, 不向前端报错 (用户感知不到)
//\!
//\! ## Public API
//\! - `spawn_pty(cmd, cwd, env) -> Result<SessionId, AppError>`
//\! - `write_pty(session_id, data) -> Result<(), AppError>`
//\! - `resize_pty(session_id, cols, rows) -> Result<(), AppError>`
//\! - `kill_pty(session_id) -> Result<(), AppError>`

use portable_pty::{CommandBuilder, NativePtySystem, PtySize};
// ...
```

具体公开函数用 `///` 文档注释 + 标准 Rustdoc 字段 (Arguments / Returns / Errors / Examples), `#[tauri::command]` 函数同样必写。

```rust
/// 启动一个新的 PTY 会话, 绑定到指定的 cardId.
///
/// # Arguments
/// * `card_id` - 卡片 ID, 用于后续 write/resize/kill
/// * `cmd`     - shell 命令 (会通过用户默认 shell 执行)
/// * `cwd`     - 工作目录, 必须存在
///
/// # Returns
/// `SessionId` 字符串, 前端用它订阅 `pty_output` event
///
/// # Errors
/// - `AppError::PtySpawn`   底层 spawn 失败 (cwd 不存在 / 权限不足)
/// - `AppError::Duplicate`  同 card_id 已有活动会话
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn pty_spawn(
    state: tauri::State<'_, AppState>,
    card_id: String,
    cmd: String,
    cwd: PathBuf,
) -> Result<SessionId, AppError> {
    // ...
}
```

不同类型 Rust 文件的字段需求:

- **commands/*.rs**: description, module, **prd, task, rules**, 暴露的 Tauri command 列表
- **pty/*.rs / watcher/*.rs / scan/*.rs**: description, module, dependencies, **prd, task, rules**
- **models/*.rs**: description, module, 各 struct 字段说明 + 对应的 TS interface 名
- **error.rs**: description, module, 各 AppError 变体的触发条件 + 前端处理建议
- **utils/纯函数**: description, module, 不需要 prd/rules (除非函数本身承载业务规则)

### 业务锚点字段说明 (重要)

`@prd` / `@task` / `@design` / `@rules` 是「需求 → 设计 → 代码 → 测试」可追溯链的关键, **编码时必须同步写入**:

| 字段     | 格式                                | 作用                                                  |
| -------- | ----------------------------------- | ----------------------------------------------------- |
| `@prd`   | `docs/prds/<文件>.md#<锚点>`        | 指向对应的 PRD 片段, 供查阅需求原文                   |
| `@task`  | `docs/tasks/<文件>.json#<taskId>`   | 指向 `/plan` 生成的任务条目                           |
| `@design`| Figma URL / `docs/designs/...` 路径 / 空 | 指向设计稿帧, 供对照视觉规范 (无设计稿可省略)    |
| `@rules` | 多行中文规则列表, 每行一条          | 本文件承载的**业务规则**, 是测试断言的唯一来源        |

**`@rules` 的写法原则**:
- 只写**业务规则**, 不写技术实现 (✅「卡片 idle 时显示占位提示」 ❌「使用 useState 管理状态」)
- 每条规则都应该可以转化为一个测试用例
- 如果规则来自 PRD, 尽量保留原文措辞, 便于对齐
- 无业务规则的纯工具函数可省略 (如 `formatPtyOutput`), 但测试预期必须来自函数签名 / JSDoc

**测试生成时的作用**: `/test` 命令会读取 `@rules` 作为测试用例骨架, 每条规则对应一个 `it()` (前端) 或 `#[test] fn` (Rust), 从根本上避免 AI「根据源码猜预期」的问题。详见 `.claude/commands/test.md`。

## 触发时机

以下操作必须同步更新对应 README.md：

1. **新建文件** → 在目录 README.md 的文件清单中新增一行
2. **删除文件** → 从目录 README.md 中移除对应行
3. **重命名文件** → 更新 README.md 中的文件名
4. **修改文件职责** → 更新 README.md 中的说明列
5. **新建功能模块** → 创建模块级 README.md
6. **修改模块依赖关系** → 更新模块间关系描述
7. **新增 / 改 Tauri command 或 event 名** → 更新 IPC 封装目录的 README.md, 同时检查 `workspace/src/ipc/contract.ts` 与 Rust `events.rs` 是否同步

## 全局索引

在 `workspace/src/README.md` 中维护一个项目整体索引 (前端):

```markdown
# 前端模块索引

## 功能模块 (features/)

| 模块      | 说明                              | 状态     |
| --------- | --------------------------------- | -------- |
| workspace | 工作区接入 (选目录 / 扫描 / 持久化) | 开发中   |
| kanban    | 看板与泳道渲染                    | 开发中   |
| terminal  | PTY 终端 (xterm)                  | 开发中   |
| docs      | 文档浏览器                        | 待开发   |
| prd       | PRD 预览与编辑                    | 待开发   |
| rules     | 规则抽屉                          | 待开发   |
| retro     | 回溯时间轴                        | 待开发   |

## 全局通用

| 目录          | 说明                                    |
| ------------- | --------------------------------------- |
| components/   | 通用 UI 组件 (Drawer / Modal / Toast)   |
| hooks/        | 通用 hooks                              |
| stores/       | 全局 Zustand store                      |
| ipc/          | Tauri invoke / listen 的 typed 包装     |
| types/        | 全局类型 + IPC 类型 (与 Rust struct 一一对应) |
| styles/       | tokens.ts + global.css                  |
| i18n/         | 多语言资源                              |
```

在 `workspace/src-tauri/src/README.md` 中维护后端模块索引 (Rust), 字段类似但聚焦 commands / 数据模型 / 子模块。

# 编码规范

## 命名规则

### 前端 (TypeScript / TSX)

- 组件: PascalCase (`AgentCard.tsx`, `RulesDrawer.tsx`)
- hooks: camelCase, `use` 前缀 (`usePtySession.ts`, `useWorkspaceScan.ts`)
- 工具函数: camelCase (`formatPtyOutput.ts`)
- 类型 / 接口: PascalCase, 不加 `I` 前缀 (`Workspace`, `AgentCardState`, 不要 `IWorkspace`)
- 常量: UPPER_SNAKE_CASE (`DEFAULT_LANE_WIDTH`, `PTY_SCROLLBACK_LIMIT`)
- Zustand store: `use` 前缀 + `Store` 后缀 (`useWorkspaceStore.ts`, `useKanbanStore.ts`)
- IPC 调用封装: `<verb>+<resource>` (`spawnPty.ts`, `scanWorkspace.ts`), 集中在 `features/<m>/ipc/`
- CSS Modules: 文件名 `<Component>.module.css`, 类名 camelCase

### 后端 (Rust)

- 模块文件: snake_case (`pty.rs`, `workspace_scan.rs`)
- 类型 / struct / enum: PascalCase (`Workspace`, `CardState`, `AppError`)
- 函数 / 方法 / 字段: snake_case (`scan_workspace`, `pty_handle`)
- 常量: UPPER_SNAKE_CASE (`DEFAULT_COLS`, `WATCH_DEBOUNCE_MS`)
- Tauri command 函数: snake_case, 与暴露给前端的字符串名**完全一致** (函数 `pub fn pty_spawn` ↔ 前端 `invoke('pty_spawn')`)
- 事件名: snake_case 字符串, 集中在 `src-tauri/src/events.rs`

## 注释规范

### 原则: 注释解释"为什么"，代码本身说明"是什么"

好的命名和类型就是最好的文档，不需要注释来复述代码在做什么。

### 必须写注释的场景

1. **文件头部 JSDoc / Rust doc** — 每个文件必须有（见 `file-docs.md`），这是给 AI 和新人的入口
2. **业务规则 / 领域逻辑** — 代码背后的"为什么"，不写就没人知道
   ```ts
   // 设计稿要求: 终端卡片高度有 120 / 200 / 320 三档, 不允许任意像素值
   const CARD_HEIGHT = { compact: 120, normal: 200, expanded: 320 } as const;
   ```
3. **非直觉的技术决策** — 绕过 / 兼容 / 性能 hack
   ```rust
   // notify 在 macOS 下短时间内会报多次 Modify 事件, 用 debounce 300ms 合并
   const WATCH_DEBOUNCE_MS: u64 = 300;
   ```
4. **TODO / FIXME / HACK** — 标记已知技术债, 必须带原因
   ```ts
   // TODO(M3): tauri-plugin-window-state 接入后, 窗口位置自动恢复
   // FIXME: portable-pty 在 Windows ConPTY 下 resize 偶发失败, 暂用 try_again 兜底
   ```
5. **正则 / 复杂计算 / unsafe** — 不注释就是谜语
   ```ts
   // 匹配 .claude/commands/<idx>-<name>.md 文件名, 提取 idx 用于排序
   const CMD_FILE_REG = /^(\d{2,3})-([\w-]+)\.md$/;
   ```

### 禁止写注释的场景

1. **复述代码** — 代码已经说清楚了
   ```ts
   // ❌ 启动 PTY
   spawnPty(cmd);
   ```
2. **注释掉的代码** — 直接删除, Git 有历史
3. **修改日志** — 不要写 `// 2026-04-27 改了 xxx`, 用 Git log

### 注释格式

- TS 单行 `//`, 多行 `/** */` JSDoc; 与代码空一行
- Rust 模块顶 `//\!`, 函数 `///`, 实现细节 `//`
- 中文项目用中文注释, 保持一致
- 注释跟随代码更新, 过期注释比没有注释更有害

## 组件规范 (前端)

- 所有组件使用 TypeScript 函数式组件, 不写 class component
- Props 必须定义 interface 并导出, 类型集中在组件文件顶部 (复杂的可拆 `<Component>.types.ts`)
- 复杂逻辑抽到自定义 hooks (副作用 / 异步 / 订阅 IPC event), 组件只负责渲染
- 纯展示组件用 `React.memo` 包裹
- 不允许在组件内直接调 `invoke()`, 必须通过 hook (`useXxxQuery` / `useXxxMutation`) 或 store action

## IPC 规范

- 所有 Tauri command / event 名走 `workspace/src/ipc/contract.ts` 集中管理 (见 `no-hardcode.md`)
- 前端 invoke 调用包装在 `features/<module>/ipc/` 下的函数里, 类型从 `src/types/ipc.ts` 引入
- Rust command 函数签名: 入参用 struct (而非散参数), 返回 `Result<T, AppError>`, 失败时 AppError 自动序列化为前端可读 JSON
- Tauri event payload 必须是 `Serialize` struct, 不要传裸字符串
- 事件订阅 (`listen`) 必须在 `useEffect` 的 cleanup 里 unlisten, 否则会内存泄漏
- 不要发起 HTTP 请求 (没有后端 API), 所有数据走 Tauri IPC

## 状态管理规范

- 全局共享状态用 **Zustand**, 一个领域一个 store: `useWorkspaceStore` / `useKanbanStore` / `useDrawerStore` / `useToastStore`
- store 文件以 `use` 开头, 文件路径: 全局放 `workspace/src/stores/`, 模块专属放 `features/<m>/stores/`
- 组件局部状态用 `useState` / `useReducer`
- 不要把"派生数据"放进 store (能算出来的就算出来, 用 selector + memo)
- 不要用 React Context 当状态管理 (只用于跨组件传递「不变的」依赖, 如 i18n / theme)

## 路由规范

- **本应用没有路由**, 是单页桌面端
- 主界面状态 (Welcome / Loading / Kanban / Error) 切换走 `useWorkspaceStore` 的 phase 字段, 顶层 `App.tsx` 用 switch 渲染
- 「子页面」(规则抽屉、PRD 预览、文档浏览器) 用 Drawer / Modal 组件承载, 状态由 `useDrawerStore` 管理
- 禁止安装 `react-router-dom` 或 `wouter` 等路由库

## Rust 端规范

- 不滥用 `unwrap()` / `expect()`: 启动期可以 (panic 即崩, 用户会看到错误对话框); 命令处理函数内一律用 `?` + `Result`
- `unsafe` 块需文件顶部 `//\! WARNING: contains unsafe` 标注 + 行内 `// SAFETY:` 解释
- 所有 Tauri command 函数加 `#[tracing::instrument]`, 入参 / 出参自动记日志 (敏感字段用 `skip`)
- 避免 `tokio::spawn` 内 panic 静默丢失: 用 `.await` 拿到 join handle, 错了打日志通过 event 推前端

## 测试规范概要 (详见 `testing.md`)

- 前端 Vitest 单测放 `workspace/tests/<src 镜像>/<name>.test.ts(x)`
- Rust 单测就近写在源文件 `#[cfg(test)] mod tests`, 集成测试放 `workspace/src-tauri/tests/`
- E2E 用 `tauri-driver` + Playwright, 放 `workspace/tests/e2e/`

## Git 规范

- 提交信息格式: `type(scope): description` (英文或中文均可, 项目内一致即可)
- type: `feat` | `fix` | `refactor` | `style` | `test` | `docs` | `chore` | `build` | `ci`
- scope 示例: `kanban` / `pty` / `scan` / `ipc` / `tauri` / `docs`
- 分支命名: `feature/xxx`, `fix/xxx`, `refactor/xxx`
- Rust 与 TS 字段类型变更: commit message 必须同时改双端, 否则 reviewer 退回

# 项目配置 - Spider (Tauri 桌面端)

> Claude Code 入职培训。详细规则拆分在 `.claude/rules/` 下，按需读取。
> 遇到具体场景时，先读对应规则文件再执行。

---

## 项目结构

本项目分两层:

| 层级           | 目录                                            | 职责                                                                                |
| -------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| **根目录**     | `.claude/` / `docs/` / `CLAUDE.md`              | AI 自动化框架 (命令/规则/PRD/任务) — 与 `claude-code-workflow` 主仓库共用一套八步法 |
| **workspace/** | `workspace/src/` / `workspace/src-tauri/` / ... | 实际产品代码 (Tauri 2 桌面端工程, Rust 后端 + React 前端)                           |

根目录的 `pnpm dev` / `pnpm tauri:build` 等命令通过 `pnpm --prefix workspace` 代理到 `workspace/` 执行, 用户无需手动 cd。

> 与 `claude-code-workflow` 的关系: 本仓库**镜像**了对方的目录骨架 (`.claude/` 命令、规则、hooks、agents、skills 直接搬过来), 只是把工种特化层 (`workspace/`) 从 UmiJS 前端工程换成了 Tauri 桌面端工程。详见 `docs/ADAPTING.md`。

---

## P0 禁止硬编码（最高优先级）

一切可变值通过配置/常量/Design Token/国际化引入，严禁写死。配置本身不得重复，按层级复用。
涵盖：UI 文案国际化、颜色样式、Tauri 命令名 / 事件名、业务枚举、尺寸间距、魔法数字、PTY shell 路径等。

详细规则与示例 → `.claude/rules/no-hardcode.md`

---

## 技术栈概要

**桌面端壳**: Tauri 2.x (Rust 后端 + WebView 前端) | **构建**: Vite 5 + pnpm
**前端**: React 18 + TypeScript 5 + Zustand (状态) + xterm.js 5 (终端) + react-markdown (文档预览)
**后端 (Rust)**: portable-pty (跨平台 PTY) + notify (文件 watcher) + serde / serde_yaml / gray_matter (frontmatter) + tokio
**测试**: Vitest (前端) + cargo test (Rust) + Playwright (E2E, 通过 Tauri webview 受限)
**包管理**: pnpm (前端) + cargo (Rust)
**国际化**: react-i18next (按需启用)
**注意**: 本仓库**不依赖**任何 Web 服务端框架 (UmiJS / Next.js / 等), 没有路由库 (单页 SPA, 抽屉 / 模态切换), 没有 HTTP 请求库 (Tauri command 直连 Rust)。

完整技术栈与目录结构 → `.claude/rules/tech-stack.md`

---

## 编码规范概要

- 注释只写"为什么"，不复述代码；文件头 JSDoc / Rust doc comment 必写，注释掉的代码直接删
- 前端: 组件 PascalCase / hooks `use` 前缀 / 常量 UPPER_SNAKE_CASE / 类型不加 I 前缀
- 后端: Rust 模块 snake_case / 类型 PascalCase / 常量 UPPER_SNAKE_CASE / 命令函数 snake_case
- 前端架构: 函数式组件 + Props interface 导出 + 逻辑抽 hooks + 组件只负责渲染
- IPC: 前端通过 `@tauri-apps/api` 的 `invoke()` 调 Rust command, 通过 `listen()` 订阅 Rust event
- 状态: Zustand 全局 (workspace / kanban / drawer) + 局部 useState 短生命周期
- 不使用 React Router / Redux / axios — 本应用是单页桌面端, 数据走 Tauri IPC
- Git: `type(scope): description`，分支 `feature/...` / `fix/...` / `refactor/...`

完整编码规范 → `.claude/rules/coding-style.md`

---

## 文件说明规范（必须遵守）

每次创建/修改代码文件时，必须同步维护：

1. 所在目录的 `README.md`（文件清单表格）
2. 文件顶部 JSDoc 注释（`@description` / `@module` / `@dependencies` / **`@prd` / `@task` / `@design` / `@rules`**）— Rust 文件用 `//!` 模块注释 + `///` 函数注释, 字段一致
3. 功能模块的模块级 `README.md`（业务流程 + 对外暴露）
4. `workspace/src/README.md` 全局索引

> **业务锚点 (@prd / @task / @design / @rules) 是「需求 → 设计 → 代码 → 测试」可追溯链的关键**, 让 `/test` 能根据业务规则而非源码行为生成测试, `/review` 能对照设计稿检查视觉一致性。详见 `.claude/rules/file-docs.md`。

详细格式与模板 → `.claude/rules/file-docs.md`

---

## 测试规范概要

- 测试断言的**唯一来源**是源文件 JSDoc / Rust doc 的 `@rules`, 不是 AI 推测
- 每条 `@rules` 一个 `it()` (前端) 或 `#[test] fn` (Rust), 名字完整引用规则原文
- 前端断言查询优先级: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
- Mock 策略: Tauri command 在前端测试中用 `mockIPC` (来自 `@tauri-apps/api/mocks`); Rust 单测尽量用真实数据 + tempdir, 不 mock 自己的模块
- 位置: 前端测试统一放 `workspace/tests/` 镜像 `workspace/src/`; Rust 测试就近写在模块内或 `workspace/src-tauri/tests/`; E2E 放 `workspace/tests/e2e/` (Tauri webview 自动化用 `tauri-driver`)
- 测试失败分诊顺序: 测试代码 → 环境 → 测试预期 → 源码

完整测试规范 → `.claude/rules/testing.md`

---

## 注意事项

- 不要使用 `any` / `unknown` 类型蒙混过关，必须明确类型定义；Rust 端不滥用 `unwrap()`，错误用 `Result<T, AppError>` 传递
- 不要使用 inline style，用 CSS Modules (`.module.css`) 或 Design Token 主题变量
- 静态资源 (icon / 默认头像) 放 `workspace/src-tauri/icons/` 或 `workspace/public/` (Vite 会拷贝)
- 环境变量: 前端以 `VITE_` 开头通过 `import.meta.env` 读取; Rust 端通过 `std::env::var` 读取, 在 `tauri.conf.json` 里声明
- 所有异步操作必须有 loading 和 error 状态处理 (前端 React Query / Zustand 都行, Rust 端用 `tokio::Result`)
- 表单必须有验证和错误提示
- 列表页必须处理空状态 (空 workspace / 无 PRD / 无任务)
- **页面 / 路由概念不存在**: 本应用是单页桌面端, 主界面 = 看板; 抽屉 / 模态承担「子页面」职责。**禁止**引入 react-router-dom
- mock 数据放 `workspace/mock/`, 仅在前端独立调试 (`pnpm dev:web-only`) 时用; 正常 `pnpm dev` 启 Tauri 走真实 Rust IPC
- PTY / 文件 watcher / 文件读写**只在 Rust 端实现**, 前端永远通过 Tauri command 调用
- 任何修改 `tauri.conf.json` 的 `tauri.allowlist` / `tauri.security` 必须在 PR 描述里声明原因 (安全相关)

---

## 项目工作流文档

### docs/ 目录结构

- `docs/WORKFLOW.md` — **新人/用户必读**, 从一句话需求到上线的八步法操作手册
- `docs/ADAPTING.md` — 跨工种适配清单, 解释本仓库怎么从 `claude-code-workflow` (UmiJS) 迁到 Tauri
- `docs/DECISIONS.md` — 架构决策记录 (ADR)
- `docs/tasks/` — 存放 `/plan` 命令生成的 JSON 任务清单, 每个文件对应一个功能模块
- `docs/prds/` — 存放产品需求文档 (.md 格式), 模板见 `docs/prds/_template.md`, 当前主 PRD 为 `docs/prds/claude-workflow-kanban.md`
- `docs/designs/` — 设计稿归档 (HTML / JSX 原型 / Figma 截图), 当前 `docs/designs/claude-workflow-kanban/` 存放 Claude Design 输出
- `docs/bug-reports/` — 测试端 AI 测试报告 (喂给 `/fix` 批量修)
- `docs/retrospectives/` — `/meta-audit` 产出的只读观察报告
- 详细说明见 `docs/README.md`

### 任务清单使用方式

- 编码前先读取对应的任务清单: `@docs/tasks/tasks-xxx.json`
- 按 taskId 顺序和 dependencies 依赖关系执行任务
- 每完成一个任务, 将其 status 更新为 "done"
- status 取值: pending (待开发) | in-progress (开发中) | done (已完成) | blocked (被阻塞)

### Tauri 命令契约 (代替 OpenAPI)

- 本应用没有 HTTP API, 取而代之是 Rust 端的 Tauri command 集合, 充当「前端 ↔ 后端」契约
- 命令签名集中在 `workspace/src-tauri/src/commands/` 模块, 类型通过 `serde::{Serialize, Deserialize}` 双向流动
- 前端类型从 `workspace/src/types/ipc.ts` 引入, 与 Rust 端的 struct 一一对应; 任何字段改动都必须**先改 Rust struct + Tauri command, 再用 `cargo run --bin gen-types` 或手动同步 TS 类型**, 严禁前端单边改类型
- 详细命令清单见 `docs/prds/claude-workflow-kanban.md` 附录 C

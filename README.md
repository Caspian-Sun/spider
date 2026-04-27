# Claude Workflow Kanban (代号: spider)

Tauri 2 桌面端工具，把 [`claude-code-workflow`](../claude-code-workflow) 仓库的 `.claude/` + `docs/` 可视化成可操作的看板。每条泳道 = 一个工作流命令，每张卡片 = 一个真实 PTY 终端会话。

## 仓库结构

| 路径               | 职责                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `.claude/`         | AI 自动化框架 (命令 / 规则 / hooks / agents / skills) — 与 `claude-code-workflow` 同源 |
| `docs/`            | PRD / tasks / 设计稿 / 回溯报告                                       |
| `workspace/`       | 实际产品代码 (Tauri 2 工程, Rust 后端 + React 前端)                   |
| `CLAUDE.md`        | Claude Code 入职培训, 链接到 `.claude/rules/*` 详细规则               |
| `package.json`     | 仅放代理脚本 (`pnpm dev` 等转发到 `workspace/`)                       |

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动 Tauri dev (前端 vite + Rust 后端)
pnpm dev

# 仅前端 (mock 模式, 用 mockIPC, 不启 Rust)
pnpm dev:web

# 运行 Vitest
pnpm test

# 运行 Rust 测试
pnpm cargo:test

# 打包桌面端二进制
pnpm tauri:build
```

## 文档导航

| 看哪个                                          | 看什么                                  |
| ----------------------------------------------- | --------------------------------------- |
| `docs/WORKFLOW.md`                              | 八步法工作流操作手册 (新人必读)         |
| `docs/prds/claude-workflow-kanban.md`           | 产品需求文档 (13 个功能点 + 6 milestone) |
| `docs/designs/claude-workflow-kanban/`          | 设计稿原型 (HTML + JSX)                 |
| `docs/ADAPTING.md`                              | 跨工种适配清单 (从 UmiJS → Tauri)       |
| `docs/DECISIONS.md`                             | 架构决策记录 (ADR)                      |
| `.claude/rules/*.md`                            | 编码 / 测试 / 文档 / 硬编码规范         |

## 开发约束 (摘要)

- **P0 禁止硬编码** — 所有可变值走 Design Token / `IPC.Cmd.*` 常量 / i18n key, 详见 `.claude/rules/no-hardcode.md`
- **可追溯链** — 每个源文件 JSDoc / Rust doc 必写 `@prd / @task / @design / @rules`, 详见 `.claude/rules/file-docs.md`
- **测试断言来源唯一** — 来自源文件的 `@rules`, 不靠 AI 推测; 详见 `.claude/rules/testing.md`
- **单页桌面端** — 没有路由库, 没有 HTTP 请求, 所有数据走 Tauri IPC

## License

MIT (见 `LICENSE`)

# 技术栈与目录约定

## 桌面端壳层

- **Tauri 2.x** — Rust 后端 + WebView 前端, 单二进制分发
- **构建工具**: Tauri CLI (`@tauri-apps/cli`) + Vite 5 (前端 dev server / bundler)
- **配置**: `workspace/src-tauri/tauri.conf.json` (窗口尺寸 / 安全白名单 / 应用元信息)

## 前端

- **React 18** + **TypeScript 5.x** (严格模式, 禁 any)
- **状态管理**: Zustand (全局 store, 文件名 `useXxxStore.ts`) + React 内置 useState/useReducer (局部)
- **终端**: `xterm` 5.x + `@xterm/addon-fit` + `@xterm/addon-web-links`
- **Markdown 预览**: `react-markdown` + `remark-gfm` + 代码块高亮 (`shiki` 按需)
- **样式**: CSS Modules (`*.module.css`) + 主题 token 集中在 `workspace/src/styles/tokens.ts` (颜色 / 字号 / 间距, 与设计稿 `Workflow Kanban.html` 中 `:root` CSS 变量一一对应)
- **图标**: `lucide-react`
- **国际化**: `react-i18next` (按需启用, 默认中文)
- **测试**: Vitest + @testing-library/react + jsdom

> **不使用** 的常见库, 不要安装:
> - react-router-dom (单页, 不需要前端路由)
> - axios / ky (Tauri command 直连 Rust, 没有 HTTP)
> - antd / mui (UI 风格按设计稿手写, 仅引入 lucide-react 图标)
> - redux / mobx (用 Zustand)
> - umi / next.js (本仓库不是 web 服务)

## 后端 (Rust, src-tauri)

- **Rust 2021 edition**, MSRV 1.78+
- **PTY**: `portable-pty` (跨平台 spawn / read / write / resize / kill)
- **文件 watcher**: `notify` 6.x (debounce 300ms 后通过 Tauri event 推前端)
- **Frontmatter**:
  - YAML frontmatter (md 文件): `gray_matter` crate
  - 纯 JSON 元数据: `serde_json`
  - YAML 配置: `serde_yaml`
- **异步运行时**: `tokio` (Tauri 自带)
- **错误处理**: `thiserror` 定义 `AppError` 枚举, 命令返回 `Result<T, AppError>`, 自动序列化为前端可读 JSON
- **日志**: `tracing` + `tracing-subscriber` (输出到 stderr, dev 模式打 DEBUG, 生产 INFO)
- **测试**: 内置 `#[test]`, `tempfile` 写文件操作单测, `assert_cmd` 跑集成测试

## 包管理

- **前端**: `pnpm`, monorepo 根目录用 `pnpm --prefix workspace <script>` 代理
- **Rust**: `cargo`, `Cargo.toml` 在 `workspace/src-tauri/`

## 项目结构

```
spider/                          # 本仓库根
├── .claude/                     # AI 命令 / 规则 / hooks (与 claude-code-workflow 同源)
├── docs/                        # PRD / tasks / designs / retrospectives
├── CLAUDE.md                    # 入职培训
├── package.json                 # 根目录, 仅放代理脚本
├── pnpm-workspace.yaml          # 声明 workspace/ 是子包
└── workspace/                   # 实际产品代码
    ├── package.json             # 前端依赖与 Tauri scripts
    ├── pnpm-lock.yaml
    ├── vite.config.ts           # Vite 配置 (root: ., 别名 @ → src/)
    ├── tsconfig.json
    ├── index.html               # SPA 入口 (Tauri WebView 加载这个)
    ├── src/                     # 前端源码 (React)
    │   ├── main.tsx             # ReactDOM.createRoot
    │   ├── App.tsx              # 根组件 (路由替代: 抽屉 / 模态)
    │   ├── pages/               # 「主界面级」组件 (Welcome / Loading / KanbanShell / Error)
    │   ├── features/            # 业务模块 (workspace / kanban / terminal / docs / prd / rules / retro)
    │   │   └── <module>/
    │   │       ├── components/  # 模块专属组件
    │   │       ├── hooks/       # 模块专属 hooks (useXxx.ts)
    │   │       ├── stores/      # 模块 Zustand store (useXxxStore.ts)
    │   │       ├── ipc/         # Tauri command 调用封装 (替代 api/)
    │   │       ├── types/       # TS 类型 (与 src/types/ipc.ts 共享 IPC 类型)
    │   │       └── utils/
    │   ├── components/          # 全局通用组件 (Drawer / Modal / Toast / Icon)
    │   ├── hooks/               # 全局 hooks
    │   ├── stores/              # 全局 store (workspace 根 / theme / locale)
    │   ├── ipc/                 # 全局 IPC 封装 (invoke / listen 的 typed 包装)
    │   ├── types/
    │   │   └── ipc.ts           # 与 Rust struct 一一对应的 TS 类型
    │   ├── styles/
    │   │   ├── tokens.ts        # Design Token (颜色/字号/间距)
    │   │   └── global.css
    │   ├── i18n/                # 多语言资源
    │   └── utils/
    ├── src-tauri/               # Rust 后端
    │   ├── Cargo.toml
    │   ├── tauri.conf.json
    │   ├── build.rs
    │   ├── icons/
    │   └── src/
    │       ├── main.rs          # Tauri builder + handler 注册
    │       ├── lib.rs
    │       ├── commands/        # Tauri command 模块 (workspace / pty / fs / scan)
    │       ├── watcher/         # notify 封装
    │       ├── pty/             # portable-pty 封装
    │       ├── scan/            # 一次性扫描 + frontmatter 解析
    │       ├── models/          # serde struct (Workspace / Command / Rule / ...)
    │       └── error.rs         # AppError 枚举
    ├── public/                  # Vite 静态资源 (打包到 dist/)
    ├── mock/                    # 前端独立调试时的假数据
    └── tests/
        ├── features/            # 镜像 src/features/
        ├── e2e/                 # Tauri E2E (tauri-driver)
        └── mocks/               # mockIPC handlers
```

## 关键约束

### 不要乱用 Tauri 能力
- 文件读写、PTY、watcher 全部走 Rust command, 前端**禁止**调 Node-like API 或浏览器 File API 操作磁盘
- `tauri.conf.json` 的 `allowlist` 默认收紧, 不要为了图方便打开 `"all": true`

### Rust ↔ TS 类型同步
- Rust struct 加 `#[derive(Serialize, Deserialize)]`, 后续启用 `ts-rs` 自动生成 `workspace/src/types/ipc.ts`
- 当前阶段 (M1-M2) 手动同步, 但**必须先改 Rust 再改 TS**, 否则 PR 不予合并
- 字段命名: Rust 端 snake_case, 用 `#[serde(rename_all = "camelCase")]` 序列化为前端友好的 camelCase

### 单页应用约定
- 没有 `pages/` 路由, 主界面状态切换走 store + 顶层 `App.tsx` 的 switch
- 「子页面」(规则抽屉、PRD 预览、文档浏览器) 用 Drawer / Modal 组件承载
- 浏览器后退 / 前进按钮**没有意义** (Tauri webview 不显示导航), 不要依赖 history API

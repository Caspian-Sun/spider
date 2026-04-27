# 测试规范

> 本文件规定**测试写什么、怎么写**, 不涉及具体执行流程 (那是 `/test` 命令的事)。

## 核心原则

**测试断言的唯一来源是源文件的 `@rules` (前端 JSDoc / Rust doc comment), 不是 AI 读源码的推测**。

```
PRD 业务规则  →  @rules (源文件头注释)  →  测试 it() / #[test] fn 断言
    一一对应, 不跳跃, 不扩展
```

违反这条 = 测试会「测试源码现状」而不是「验证业务规则」, 源码有 bug 时测试会跟着错。

---

## 测试工具分工

| 工具                  | 用途                                                 | 位置                                               |
| --------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Vitest                | 前端单元测试 / 组件测试 (jsdom)                       | `workspace/tests/` 下镜像 `workspace/src/`         |
| @testing-library/react| 组件渲染 + 用户交互模拟                              | 配合 Vitest 使用                                   |
| `cargo test`          | Rust 单元 / 集成测试                                 | 单元测试就近写, 集成测试放 `workspace/src-tauri/tests/` |
| `tempfile` (crate)    | 写文件 / 文件 watcher / scan 测试用临时目录          | Rust 测试中用                                      |
| `mockIPC`             | 前端测试中 mock Tauri command 返回值                 | 来自 `@tauri-apps/api/mocks`                       |
| Playwright + tauri-driver | E2E 真实窗口自动化                              | `workspace/tests/e2e/*.spec.ts`                   |

**怎么选**:

| 场景                                       | 用什么                                |
| ------------------------------------------ | ------------------------------------- |
| 纯函数 (utils / formatPtyOutput)           | Vitest 单测                           |
| 组件渲染 + 点击 / 输入                     | Vitest + testing-library              |
| 跨组件交互 (drawer 打开 / 卡片状态切换)    | Vitest + testing-library + mockIPC    |
| Rust 工具函数 / 解析逻辑                   | `#[cfg(test)] mod tests` 就近写       |
| Rust 文件 IO / scan / frontmatter 解析     | 集成测试 + tempfile                   |
| Rust PTY 真实进程交互                      | 集成测试 (CI 跑 sleep/echo 等小命令)  |
| 跨「Rust ↔ 前端」端到端流程                | Playwright + tauri-driver             |
| 视觉回归                                   | Playwright screenshot (按需)          |

---

## 测试文件位置

### 前端

所有测试**统一放 `workspace/tests/` 下**, 目录结构**镜像** `workspace/src/`, 不允许放源文件同目录或 `__tests__/` 子目录。

```
workspace/src/features/kanban/components/AgentCard.tsx
workspace/tests/features/kanban/components/AgentCard.test.tsx   ← 镜像源文件路径

workspace/src/features/terminal/hooks/usePtySession.ts
workspace/tests/features/terminal/hooks/usePtySession.test.ts

workspace/src/pages/KanbanShell.tsx
workspace/tests/pages/KanbanShell.test.tsx

workspace/tests/e2e/workspace-pickup.spec.ts                    ← E2E 单独目录
workspace/tests/mocks/ipc-handlers.ts                           ← mockIPC handlers 集中
```

### Rust

```
workspace/src-tauri/src/scan/parser.rs                          ← 单元测试就近: #[cfg(test)] mod tests
workspace/src-tauri/tests/scan_integration.rs                   ← 集成测试: 用 tempfile 跑真目录
workspace/src-tauri/tests/pty_integration.rs                    ← 集成测试: spawn echo
```

**规则**:
- 前端单元 / 组件测试: `workspace/tests/<src 镜像路径>/<name>.test.ts(x)`
- 前端 E2E: `workspace/tests/e2e/`, 文件名 `<流程>.spec.ts`
- mockIPC handlers: `workspace/tests/mocks/`, 按模块拆文件
- 前端测试引用业务代码**一律用 `@/` 别名** (如 `import { AgentCard } from '@/features/kanban/components/AgentCard'`), 不要写相对路径 `../../../src/...`
- Rust 单元测试: 在源文件末尾 `#[cfg(test)] mod tests { use super::*; ... }`
- Rust 集成测试: `workspace/src-tauri/tests/<feature>_integration.rs`, 不依赖 Tauri runtime 的部分单独跑

---

## Mock 策略

### 优先级: 真 > 假, 少 > 多

能用真的就别 mock。能不 mock 就不 mock (函数签名对的就直接跑)。

### 分类

| 场景                                     | 工具                                   | 原因                                          |
| ---------------------------------------- | -------------------------------------- | --------------------------------------------- |
| Tauri `invoke()` 调用                    | **mockIPC** (`@tauri-apps/api/mocks`)  | 单元测试不能跑 Rust runtime, 必须 mock        |
| Tauri event (`listen`) 触发              | mockIPC + 手动 emit                    | 同上                                          |
| 项目内部模块 (utils / formatters)        | **不 mock**                            | 真跑就好, 除非真的有副作用                    |
| 第三方库 (`xterm` / `react-markdown`)    | **不 mock**                            | 集成测试要测真实行为, mock 掉等于白测         |
| Rust 文件系统操作                        | **tempfile**, 不 mock std::fs         | 临时目录是真目录, 测真实行为                  |
| Rust PTY                                 | 起 `sh -c "echo hi"` 这类小命令       | 真 PTY, 不 mock portable-pty                  |
| 时间 (`new Date` / `setTimeout`)         | `vi.useFakeTimers()` / `tokio::time::pause()` | 确定性                                |
| 随机数 / UUID                            | `vi.spyOn(crypto, 'randomUUID')` / Rust 端注入 trait | 确定性                              |

### 禁止

- ❌ 手写 `vi.mock('@/features/...')` 整个内部模块 — 真跑就行
- ❌ Mock 后又去断言 mock 被调用几次 — 大部分时候这是在测 mock 而不是业务
- ❌ 为了让测试通过去 mock — 说明测试设计错了, 不是 mock 不够
- ❌ Rust 端用 `mockall` 给自己的 trait 做 mock — 优先重构成可注入依赖, 真跑

---

## 断言规范

### 每条 `@rules` 一个 `it()` / `#[test]`

```ts
/**
 * @rules
 *   - R1: 卡片状态为 idle 时, 终端区域显示「点击运行 /<cmd>」占位提示
 *   - R2: 卡片状态切换为 running 时, 顶部状态点变绿色, 闪烁动画启动
 *   - R3: 用户在终端输入时, 输入内容透传到 PTY (通过 invoke('pty_write'))
 */

// workspace/tests/features/kanban/components/AgentCard.test.tsx
describe('AgentCard', () => {
  it('R1: 卡片状态为 idle 时, 终端区域显示「点击运行 /<cmd>」占位提示', () => { ... });
  it('R2: 卡片状态切换为 running 时, 顶部状态点变绿色, 闪烁动画启动', () => { ... });
  it("R3: 用户在终端输入时, 输入内容透传到 PTY (通过 invoke('pty_write'))", () => { ... });
});
```

```rust
// workspace/src-tauri/src/scan/parser.rs
//\! 解析 .claude/commands/*.md 的 frontmatter
//\!
//\! @rules
//\!   - R1: frontmatter 缺失 idx 字段时, 命令归入 helper lane
//\!   - R2: idx 字段非数字时, 返回 ParseError 而不是默认 0

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn r1_missing_idx_falls_into_helper_lane() { /* ... */ }

    #[test]
    fn r2_non_numeric_idx_returns_parse_error() { /* ... */ }
}
```

- `it()` / `#[test] fn` 名字**完整引用规则原文**, 带 R1/R2 编号对上 (Rust 函数名用 `r1_xxx_xxx` snake_case)
- 每条规则独立一个测试, 不合并, 不拆碎
- 断言是规则的**技术化翻译**, 不是规则的改写

### 前端断言要「用户可见」

```ts
// ❌ 测内部实现 (state 名一变就挂)
expect(useKanbanStore.getState().cards[0].state).toBe('running');

// ✅ 测用户看到的
expect(screen.getByRole('status', { name: /running/i })).toBeInTheDocument();
expect(screen.getByTestId('agent-card-status-dot')).toHaveClass(styles.running);
```

### 优先级: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`

- `getByRole` 检查 a11y, 顺便测语义
- `getByTestId` 是兜底, 源码加 `data-testid="agent-card-status-dot"` 不影响样式

### Rust 断言

- 优先 `assert_eq\!` / `assert_matches\!` (来自 `assert_matches` crate, Rust 1.78 nightly 才稳定, 暂用 `if let` 配 `panic\!`)
- 错误路径用 `assert\!(matches\!(result, Err(AppError::Parse(_))))` 验证错误**类型**, 不要断言错误**消息字符串**
- 文件操作测试用 `tempfile::tempdir()`, 自动清理

---

## 不要测什么

- ❌ **TypeScript / Rust 类型** — `tsc` / `cargo check` 会报错, 不用测
- ❌ **框架内部行为** — 别测 React 的 useState 有没有触发重渲, 那是 React 的事
- ❌ **Tauri runtime 行为** — 别测 `invoke()` 能不能传参数, 那是 Tauri 的事 (E2E 才覆盖这层)
- ❌ **第三方库** — 别测 xterm 能不能渲染字符
- ❌ **实现细节** — 组件内部用 `useState` 还是 `useReducer` 不应该影响测试; Rust 用 `Vec` 还是 `HashMap` 不应该影响测试
- ❌ **纯样式** — CSS 对不对靠视觉回归或人眼看, 不靠断言

---

## 覆盖率目标

**不追求行覆盖率 %, 追求 `@rules` 覆盖率 100%**。

```
所有 @rules 是否都有对应 it() / #[test] fn ← 这是 /test 命令的验收标准
```

行覆盖率只是副产品:
- 组件类通常 70-80% 行覆盖率 (分支 / 边界覆盖是硬仗)
- Rust 工具函数 / 解析器应该 ~100% 行覆盖率
- Tauri command 入口函数靠 E2E 兜底, 单测覆盖率不要求

---

## 测试失败的分诊

红的时候按这个顺序看, 不要第一反应改源码:

| 失败类型              | 现象                                           | 处理                       |
| --------------------- | ---------------------------------------------- | -------------------------- |
| **1. 测试代码错**     | selector 找不到 / mockIPC handler 未注册 / async 未 await | 改测试代码 |
| **2. 环境缺配置**     | 缺 `@testing-library/jest-dom` / 缺 mock setup | 补环境                     |
| **3. 测试预期错**     | AI 之前猜的预期, 和规则对不上                   | 改预期 (对照 @rules 原文)  |
| **4. 源码真有 bug**   | 规则要求 X, 代码做了 Y                         | **改源码** (这时才动)      |

80% 的红是 1-3, 不是 4。

---

## Tauri 特有的坑

- **mockIPC 不能拦截 event listen**: 用 `mockIPC + emit + window.__TAURI_INTERNALS__` 手动模拟 event, 或用 utility wrapper
- **invoke 抛错的序列化**: Rust 端 `AppError` 必须 derive `Serialize`, 不然前端 catch 到 `[object Object]`
- **PTY 集成测试**: CI 上要确认有 `/bin/sh`, Windows runner 用 `cmd.exe` 兜底
- **E2E 启动慢**: 每次 `tauri-driver` 启动 ~5-10s, 同一文件内多个 spec 共享一个 driver instance
- **Rust 异步测试**: 用 `#[tokio::test]`, 别用 `block_on` 写一坨

---

## 和其他规则的关系

- 禁止硬编码 ([no-hardcode.md](no-hardcode.md)): 测试文件同样适用, 不要硬编文案 / 颜色 / command 名 (用 i18n key 或 `IPC.Cmd.*` 常量)
- 文件说明规范 ([file-docs.md](file-docs.md)): `.test.ts(x)` 也要有文件头 JSDoc, `@rules` 可省略 (测试本身不承载业务规则, 断言来源是被测文件的 @rules)

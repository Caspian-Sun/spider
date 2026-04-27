# ipc

> Tauri command / event 名常量 + invoke / listen 的 typed 包装。所有跨 Rust 调用都从这里走。

## 文件清单

| 文件        | 说明                                     | 依赖 | 最后更新 |
|-------------|------------------------------------------|------|----------|
| contract.ts | Tauri command/event 名常量, 与 Rust 端 events.rs 保持一致 | -    | 2026-04-27 |

## 模块关系

`features/<m>/ipc/*.ts` 调 `@tauri-apps/api` 的 `invoke()` / `listen()`, 入参用 `IPC.Cmd.*` / `IPC.Event.*` 引用本目录的常量, 严禁拼字符串。

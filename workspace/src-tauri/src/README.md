# src-tauri/src

> Rust 后端模块索引. M1 阶段只有最小骨架 (lib / main / commands::ping / error / events), M2+ 按下表填实。

## 模块清单

| 模块 / 文件   | 说明                                                | 依赖 crate                         | 状态     |
|---------------|-----------------------------------------------------|------------------------------------|----------|
| lib.rs        | Tauri Builder 入口, 注册插件 / 命令 / 全局状态      | tauri, tracing                     | M1       |
| main.rs       | 二进制入口, 调用 lib::run()                         | -                                  | M1       |
| commands.rs   | Tauri command 集合 (M1: ping)                       | tauri                              | M1       |
| error.rs      | AppError 枚举 (统一错误类型, 自动序列化)            | thiserror, serde                   | M1       |
| events.rs     | Tauri event 名常量, 与前端 ipc/contract.ts 同步     | -                                  | M1       |
| commands/     | 后续按域拆模块 (workspace / pty / fs / scan)        | -                                  | 待开发   |
| scan/         | 一次性扫描 + frontmatter 解析                       | gray_matter, walkdir               | 待开发   |
| pty/          | portable-pty 封装 (spawn / read / write / kill)     | portable-pty, tokio                | 待开发   |
| watcher/      | notify 文件 watcher (debounce 后 emit event)        | notify, notify-debouncer-mini      | 待开发   |
| models/       | serde struct (Workspace / Command / Rule / ...)     | serde                              | 待开发   |

//! @description Tauri event 名常量集中地, 必须与前端 src/ipc/contract.ts 保持一致
//! @module src-tauri/events
//! @prd docs/prds/claude-workflow-kanban.md#工作区接入
//! @rules
//!   - 任何新增 event 必须在此声明常量, 不允许散落字符串字面量
//!   - 修改常量值必须同步更新前端 IPC.Event 常量

#![allow(dead_code)] // M1 占位, 命令使用后移除

pub const PTY_OUTPUT: &str = "pty_output";
pub const PTY_EXIT: &str = "pty_exit";
pub const WORKSPACE_CHANGED: &str = "workspace_changed";
pub const SCAN_PROGRESS: &str = "scan_progress";

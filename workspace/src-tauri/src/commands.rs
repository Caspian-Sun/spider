//! @description Tauri command 集合, M1 阶段仅有联通性自检
//! @module src-tauri/commands
//! @prd docs/prds/claude-workflow-kanban.md#工作区接入
//! @rules
//!   - ping 命令必须返回固定字符串 "pong", 用于前端确认 IPC 通路

use crate::error::AppError;

/// 联通性自检. 前端调用 invoke('ping') 应得到 "pong"
#[tauri::command]
#[tracing::instrument]
pub async fn ping() -> Result<String, AppError> {
    Ok("pong".to_string())
}

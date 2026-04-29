//! @description Tauri command 模块入口，按功能域拆子模块
//! @module src-tauri/commands

pub mod workspace;
pub mod fs;
pub mod app_state;
pub mod generic_board;

// ── 联通性自检 ─────────────────────────────────────────────────────────────────

use crate::error::AppError;

/// 联通性自检，前端 invoke('ping') 应得到 "pong"
#[tauri::command]
#[tracing::instrument]
pub async fn ping() -> Result<String, AppError> {
    Ok("pong".to_string())
}

//! @description 通用看板持久化 Tauri commands: read / write / get_layout / set_layout
//! @module src-tauri/commands/generic_board
//! @dependencies models::generic_board, fs::atomic, error
//! @prd docs/prds/claude-workflow-kanban.md#通用看板视图
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T048
//! @rules
//!   - 首次进入无 .kanban-board.json 时, 用系统预置 4 列 + 0 卡片初始化, 写入新文件
//!   - .kanban-board.json 损坏 (JSON parse fail) 时备份原文件为 .kanban-board.json.bak.<ts>, 用预置初始化, 顶栏 toast「Board reset due to corrupt file」
//!   - 整张 GenericBoard 序列化为 JSON 写到 workspace 内的 .claude/.kanban-board.json

use std::{path::PathBuf, time::SystemTime};

use tauri::{AppHandle, Emitter};

use crate::{
    error::AppError,
    events::BOARD_RESET_EVENT,
    fs::atomic::atomic_write,
    models::generic_board::GenericBoard,
};

const BOARD_FILE: &str = ".kanban-board.json";

fn board_path(workspace_root: &str) -> PathBuf {
    PathBuf::from(workspace_root).join(".claude").join(BOARD_FILE)
}

/// 读取 GenericBoard；不存在则返回预置 4 列初始数据；损坏则备份并重置。
#[tauri::command]
#[tracing::instrument(skip(app))]
pub async fn read_generic_board(
    app:            AppHandle,
    workspace_root: String,
) -> Result<GenericBoard, AppError> {
    let path = board_path(&workspace_root);

    if !path.exists() {
        let board = GenericBoard::default();
        persist(&path, &board)?;
        return Ok(board);
    }

    let raw = std::fs::read_to_string(&path).map_err(AppError::Io)?;
    match serde_json::from_str::<GenericBoard>(&raw) {
        Ok(board) => Ok(board),
        Err(_) => {
            // backup corrupt file
            let ts = SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let bak = path.with_extension(format!("json.bak.{ts}"));
            let _ = std::fs::rename(&path, &bak);

            let board = GenericBoard::default();
            persist(&path, &board)?;
            let _ = app.emit(BOARD_RESET_EVENT, "Board reset due to corrupt file");
            Ok(board)
        }
    }
}

/// 将整张 GenericBoard 原子写回 .claude/.kanban-board.json。
#[tauri::command]
#[tracing::instrument(skip(app, board))]
pub async fn write_generic_board(
    app:            AppHandle,
    workspace_root: String,
    board:          GenericBoard,
) -> Result<(), AppError> {
    let path = board_path(&workspace_root);
    let _ = app; // app available for future events
    persist(&path, &board)
}

/// 读取当前 layout 配置 (从 app_state.json)。
#[tauri::command]
#[tracing::instrument(skip(app))]
pub async fn get_layout(app: AppHandle) -> Result<String, AppError> {
    let state = super::app_state::load_state(&app)?;
    let layout = match state.layout {
        crate::models::Layout::Workflow => "workflow",
        crate::models::Layout::Generic  => "generic",
    };
    Ok(layout.to_string())
}

/// 设置 layout 配置 (写入 app_state.json)。
#[tauri::command]
#[tracing::instrument(skip(app))]
pub async fn set_layout(app: AppHandle, layout: String) -> Result<(), AppError> {
    super::app_state::patch_state(&app, "layout", serde_json::Value::String(layout))
}

fn persist(path: &PathBuf, board: &GenericBoard) -> Result<(), AppError> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(AppError::Io)?;
    }
    let json = serde_json::to_string_pretty(board).map_err(|e| AppError::Json(e.to_string()))?;
    atomic_write(path, &json)
}

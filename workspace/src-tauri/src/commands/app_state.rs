//! @description app_state 持久化 Tauri command：read / write (patch 语义)
//! @module src-tauri/commands/app_state
//! @dependencies tauri::Manager, models, error
//! @prd docs/prds/claude-workflow-kanban.md#工作区接入
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T029
//! @rules
//!   - 所有面板改动都写入 Rust 端 app_state.json (键 tweaks.<field>), 下次启动保留; 不写 localStorage
//!   - Layout Toggle 选择持久化到 Rust 端 app_state.json (键 layout)

use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::{
    error::AppError,
    models::AppPersistentState,
};

/// 读取完整 app_state。
#[tauri::command]
#[tracing::instrument(skip(app))]
pub async fn read_app_state(app: AppHandle) -> Result<AppPersistentState, AppError> {
    load_state(&app)
}

/// Patch 写入 app_state：`key` 支持点号路径 (e.g. "tweaks.density")，`value` 为 JSON 值。
#[tauri::command]
#[tracing::instrument(skip(app))]
pub async fn write_app_state(
    app:   AppHandle,
    key:   String,
    value: serde_json::Value,
) -> Result<(), AppError> {
    let state = load_state(&app)?;
    let mut json: serde_json::Value =
        serde_json::to_value(&state).map_err(|e| AppError::Json(e.to_string()))?;

    // Navigate dot-separated key path and set value
    set_nested(&mut json, &key, value);

    let updated: AppPersistentState =
        serde_json::from_value(json).map_err(|e| AppError::Json(e.to_string()))?;

    save_state(&app, &updated)
}

// ─── 内部工具 ──────────────────────────────────────────────────────────────────

fn state_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app.path().app_data_dir()
        .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    Ok(dir.join("app_state.json"))
}

pub fn load_state(app: &AppHandle) -> Result<AppPersistentState, AppError> {
    let path = state_path(app)?;
    if !path.exists() {
        return Ok(AppPersistentState::default());
    }
    let raw = std::fs::read_to_string(&path)?;
    serde_json::from_str(&raw).map_err(|e| AppError::Json(e.to_string()))
}

fn save_state(app: &AppHandle, state: &AppPersistentState) -> Result<(), AppError> {
    let path = state_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(state).map_err(|e| AppError::Json(e.to_string()))?;
    std::fs::write(&path, json)?;
    Ok(())
}

/// Patch a single key in app_state, used by other commands (e.g. generic_board::set_layout).
pub fn patch_state(app: &AppHandle, key: &str, value: serde_json::Value) -> Result<(), AppError> {
    let state = load_state(app)?;
    let mut json: serde_json::Value =
        serde_json::to_value(&state).map_err(|e| AppError::Json(e.to_string()))?;
    set_nested(&mut json, key, value);
    let updated: AppPersistentState =
        serde_json::from_value(json).map_err(|e| AppError::Json(e.to_string()))?;
    save_state(app, &updated)
}

/// Set a value at a dot-separated path in a JSON object.
fn set_nested(obj: &mut serde_json::Value, path: &str, value: serde_json::Value) {
    let parts: Vec<&str> = path.splitn(2, '.').collect();
    if parts.len() == 1 {
        if let Some(map) = obj.as_object_mut() {
            map.insert(parts[0].to_string(), value);
        }
    } else if let Some(map) = obj.as_object_mut() {
        let child = map
            .entry(parts[0])
            .or_insert_with(|| serde_json::Value::Object(Default::default()));
        set_nested(child, parts[1], value);
    }
}

//! @description 工作区相关 Tauri command：选择目录、校验、扫描、最近历史
//! @module src-tauri/commands/workspace
//! @dependencies tauri-plugin-dialog, models, scan, error
//! @prd docs/prds/claude-workflow-kanban.md#工作区接入
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T007
//! @rules
//!   - 选中文件夹后先调用 validate_workspace, 若返回 valid: false 则进入 invalid 状态并列出缺失项 (至少要缺 .claude)
//!   - 用户在系统对话框里取消选择时, 保持当前状态不变, 不报错
//!   - scan 完成后自动进入 ready 状态, 并把 rootPath 写入 recentWorkspaces 头部
//!   - invalid 状态下点击 Pick another 回到 empty 状态, 当前路径不写入 recentWorkspaces

use std::path::PathBuf;

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

use crate::{
    error::AppError,
    models::{AppPersistentState, ValidateResult, Workspace},
    scan::scanner::scan_workspace_dir,
};

const MAX_RECENT: usize = 5;

/// 弹出系统文件夹选择对话框，返回用户选中路径；取消时返回 Err。
///
/// # Errors
/// - 用户取消 → `AppError::Io`（前端 catch 后保持当前状态）
#[tauri::command]
#[tracing::instrument(skip(app))]
pub async fn pick_workspace_folder(app: AppHandle) -> Result<String, AppError> {
    let file_path = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .ok_or_else(|| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, "cancelled")))?;

    // FilePath is an enum (Path | Url); on desktop only Path is returned
    let path_buf = file_path.into_path()
        .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    path_buf.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, "invalid path")))
}

/// 校验目录是否含有合法 workspace（检查 .claude/ 是否存在）。
///
/// # Arguments
/// * `path` - 待校验的绝对路径
///
/// # Returns
/// `ValidateResult { valid, detected }` — detected 列出找到的子目录
#[tauri::command]
#[tracing::instrument]
pub async fn validate_workspace(path: String) -> Result<ValidateResult, AppError> {
    let root = PathBuf::from(&path);
    let mut detected = Vec::new();

    if root.join(".claude").is_dir() {
        detected.push(".claude".to_string());
    }

    Ok(ValidateResult {
        valid: !detected.is_empty(),
        detected,
    })
}

/// 扫描工作区，返回完整 Workspace 数据结构。
/// 扫描过程中每处理一个文件，通过 scan_progress 事件推进度给前端。
///
/// # Arguments
/// * `path` - workspace 根目录绝对路径
#[tauri::command]
#[tracing::instrument(skip(app))]
pub async fn scan_workspace(app: AppHandle, path: String) -> Result<Workspace, AppError> {
    scan_workspace_dir(&app, PathBuf::from(path)).await
}

/// 读取最近工作区列表（最多 5 条，失效路径自动剔除）。
#[tauri::command]
#[tracing::instrument(skip(app))]
pub async fn get_recent_workspaces(app: AppHandle) -> Result<Vec<String>, AppError> {
    let state = load_app_state(&app)?;
    let valid: Vec<String> = state
        .recent_workspaces
        .into_iter()
        .filter(|p| PathBuf::from(p).exists())
        .take(MAX_RECENT)
        .collect();
    Ok(valid)
}

/// 把路径插入 recentWorkspaces 头部，去重后保留最多 5 条。
///
/// # Arguments
/// * `path` - 要写入的工作区绝对路径
#[tauri::command]
#[tracing::instrument(skip(app))]
pub async fn add_recent_workspace(app: AppHandle, path: String) -> Result<(), AppError> {
    let mut state = load_app_state(&app)?;
    state.recent_workspaces.retain(|p| p != &path);
    state.recent_workspaces.insert(0, path);
    state.recent_workspaces.truncate(MAX_RECENT);
    save_app_state(&app, &state)
}

// ─── 内部工具：读写 app_state.json ────────────────────────────────────────────

fn app_state_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app.path().app_data_dir()
        .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    Ok(dir.join("app_state.json"))
}

fn load_app_state(app: &AppHandle) -> Result<AppPersistentState, AppError> {
    let path = app_state_path(app)?;
    if !path.exists() {
        return Ok(AppPersistentState::default());
    }
    let raw = std::fs::read_to_string(&path)?;
    serde_json::from_str(&raw).map_err(|e| AppError::Json(e.to_string()))
}

fn save_app_state(app: &AppHandle, state: &AppPersistentState) -> Result<(), AppError> {
    let path = app_state_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(state).map_err(|e| AppError::Json(e.to_string()))?;
    std::fs::write(&path, json)?;
    Ok(())
}

// ─── 单元测试 ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use std::fs;
    use tempfile::tempdir;

    use super::*;

    #[tokio::test]
    async fn validate_workspace_valid() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join(".claude")).unwrap();

        let result = validate_workspace(dir.path().to_str().unwrap().to_string())
            .await
            .unwrap();

        assert!(result.valid);
        assert!(result.detected.contains(&".claude".to_string()));
    }

    #[tokio::test]
    async fn validate_workspace_invalid() {
        let dir = tempdir().unwrap();

        let result = validate_workspace(dir.path().to_str().unwrap().to_string())
            .await
            .unwrap();

        assert!(!result.valid);
        assert!(result.detected.is_empty());
    }
}

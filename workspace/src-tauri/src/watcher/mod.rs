//! @description notify-debouncer-mini 文件 watcher，聚合事件推 workspace_changed
//! @module src-tauri/watcher
//! @dependencies notify, notify-debouncer-mini, tokio
//! @prd docs/prds/claude-workflow-kanban.md#文件系统集成
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T035
//! @rules
//!   - Watcher 基于 Rust notify crate, 监听整个 rootPath 递归, 排除 .git / node_modules / dist / target
//!   - 事件 300ms debounce 聚合, 同一批变化合并成一个 workspace_changed event

pub mod constants;

use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};

use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode, DebouncedEventKind, DebounceEventResult};
use tauri::{AppHandle, Emitter};

use crate::{error::AppError, events, models::{WatcherDiff, WorkspaceChangedPayload}};
use constants::WATCH_DEBOUNCE_MS;

const EXCLUDE_DIRS: &[&str] = &[".git", "node_modules", "dist", "target"];

/// 活跃 watcher 句柄（drop 时停止监听）
pub struct WatcherHandle {
    _debouncer: notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>,
}

/// 全局 watcher 状态，通过 Tauri managed state 注入
pub type WatcherState = Arc<Mutex<Option<WatcherHandle>>>;

/// 启动文件 watcher，旧 watcher 自动停止。
#[tauri::command]
#[tracing::instrument(skip(app, state))]
pub async fn start_watcher(
    app:   AppHandle,
    state: tauri::State<'_, WatcherState>,
    path:  String,
) -> Result<(), AppError> {
    let root = PathBuf::from(&path);
    let app_clone = app.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(WATCH_DEBOUNCE_MS),
        move |result: DebounceEventResult| {
            if let Ok(events) = result {
                let mut added    = Vec::new();
                let mut modified = Vec::new();
                let mut deleted  = Vec::new();

                for ev in events {
                    if should_exclude(&ev.path) { continue; }
                    let p = ev.path.to_string_lossy().to_string();
                    // notify-debouncer-mini collapses all events into Any/AnyContinuous;
                    // we treat both as modified since we can't distinguish create/delete
                    match ev.kind {
                        DebouncedEventKind::Any | DebouncedEventKind::AnyContinuous => modified.push(p),
                        _ => {}
                    }
                }

                if added.is_empty() && modified.is_empty() && deleted.is_empty() { return; }

                let kind = classify_kind(&added, &modified, &deleted);
                let _ = app_clone.emit(
                    events::WORKSPACE_CHANGED,
                    WorkspaceChangedPayload {
                        kind,
                        diff: WatcherDiff { added, modified, deleted },
                    },
                );
            }
        },
    ).map_err(|e| AppError::WatcherInit(e.to_string()))?;

    debouncer
        .watcher()
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| AppError::WatcherInit(e.to_string()))?;

    *state.lock().unwrap() = Some(WatcherHandle { _debouncer: debouncer });
    Ok(())
}

/// 停止文件 watcher。
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn stop_watcher(state: tauri::State<'_, WatcherState>) -> Result<(), AppError> {
    *state.lock().unwrap() = None;
    Ok(())
}

fn should_exclude(p: &Path) -> bool {
    p.components().any(|c| {
        EXCLUDE_DIRS.contains(&c.as_os_str().to_str().unwrap_or(""))
    })
}

fn classify_kind(added: &[String], modified: &[String], deleted: &[String]) -> String {
    let all: Vec<&str> = added.iter().chain(modified.iter()).chain(deleted.iter())
        .map(String::as_str).collect();
    if all.iter().any(|p| p.contains(".claude/commands")) { return "commands".into(); }
    if all.iter().any(|p| p.contains("docs/prds"))        { return "prds".into(); }
    if all.iter().any(|p| p.contains("docs/tasks"))       { return "tasks".into(); }
    if all.iter().any(|p| p.contains(".claude/rules"))    { return "rules".into(); }
    "generic".into()
}

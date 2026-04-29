//! @description portable-pty 封装：spawn / write / resize / kill，输出推 pty_output event
//! @module src-tauri/pty
//! @dependencies portable-pty, tokio, tracing
//! @prd docs/prds/claude-workflow-kanban.md#终端卡片
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T037
//! @rules
//!   - 卡片创建时立即调用 pty_spawn(cwd, cols, rows) 拿到 ptyId, status 初始设为 idle
//!   - PTY 输出按 chunk 通过 pty_output event 推送, 不在 Rust 端做任何过滤
//!
//! ## Public API
//! - `pty_spawn(cwd, cols, rows) -> Result<String, AppError>` — 返回 ptyId
//! - `pty_write(pty_id, data) -> Result<(), AppError>`
//! - `pty_resize(pty_id, cols, rows) -> Result<(), AppError>`
//! - `pty_kill(pty_id) -> Result<(), AppError>`

pub mod config;

use std::{
    collections::HashMap,
    io::{Read, Write},
    path::PathBuf,
    sync::{Arc, Mutex},
};

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tauri::{AppHandle, Emitter};

use crate::{
    error::AppError,
    events,
    models::{PtyExitPayload, PtyOutputPayload},
};
use config::pty_config;

// ─── 会话句柄 ──────────────────────────────────────────────────────────────────

pub struct PtySession {
    writer: Box<dyn std::io::Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child:  Box<dyn portable_pty::Child + Send + Sync>,
}

pub type PtyMap = Arc<Mutex<HashMap<String, PtySession>>>;

// ─── Commands ─────────────────────────────────────────────────────────────────

/// 启动 PTY 会话，返回 ptyId。
#[tauri::command]
#[tracing::instrument(skip(app, state))]
pub async fn pty_spawn(
    app:   AppHandle,
    state: tauri::State<'_, PtyMap>,
    cwd:   String,
    cols:  u16,
    rows:  u16,
) -> Result<String, AppError> {
    let shell = std::env::var("SHELL")
        .unwrap_or_else(|_| pty_config::DEFAULT_SHELL_UNIX.to_string());

    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize { cols, rows, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| AppError::PtySpawn(e.to_string()))?;

    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(PathBuf::from(&cwd));

    let child = pair.slave.spawn_command(cmd)
        .map_err(|e| AppError::PtySpawn(e.to_string()))?;

    let master = pair.master;
    let writer = master.take_writer()
        .map_err(|e| AppError::PtySpawn(e.to_string()))?;
    let mut reader = master.try_clone_reader()
        .map_err(|e| AppError::PtySpawn(e.to_string()))?;

    let pty_id = uuid_v4();
    let app_clone = app.clone();
    let id_clone  = pty_id.clone();

    // Spawn reader task — pushes pty_output events
    tokio::task::spawn_blocking(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(events::PTY_OUTPUT, PtyOutputPayload {
                        pty_id: id_clone.clone(),
                        data,
                    });
                }
                Err(_) => break,
            }
        }
        // Notify exit
        let _ = app_clone.emit(events::PTY_EXIT, PtyExitPayload {
            pty_id: id_clone,
            code: 0,
        });
    });

    state.lock().unwrap().insert(pty_id.clone(), PtySession { writer, master, child });
    Ok(pty_id)
}

/// 向 PTY 写入用户输入。
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn pty_write(
    state:  tauri::State<'_, PtyMap>,
    pty_id: String,
    data:   String,
) -> Result<(), AppError> {
    let mut map = state.lock().unwrap();
    let session = map.get_mut(&pty_id)
        .ok_or_else(|| AppError::PtyWrite(format!("session {} not found", pty_id)))?;
    session.writer.write_all(data.as_bytes())
        .map_err(|e| AppError::PtyWrite(e.to_string()))?;
    session.writer.flush()
        .map_err(|e| AppError::PtyWrite(e.to_string()))?;
    Ok(())
}

/// 调整 PTY 终端尺寸。
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn pty_resize(
    state:  tauri::State<'_, PtyMap>,
    pty_id: String,
    cols:   u16,
    rows:   u16,
) -> Result<(), AppError> {
    let map = state.lock().unwrap();
    let session = map.get(&pty_id)
        .ok_or_else(|| AppError::PtyWrite(format!("session {} not found", pty_id)))?;
    // warn-only on resize failure per rules
    if let Err(e) = session.master.resize(PtySize { cols, rows, pixel_width: 0, pixel_height: 0 }) {
        tracing::warn!("pty_resize failed: {}", e);
    }
    Ok(())
}

/// 终止 PTY 会话。
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn pty_kill(
    state:  tauri::State<'_, PtyMap>,
    pty_id: String,
) -> Result<(), AppError> {
    let mut map = state.lock().unwrap();
    if let Some(mut session) = map.remove(&pty_id) {
        let _ = session.child.kill();
    }
    Ok(())
}

// ─── helpers ──────────────────────────────────────────────────────────────────

static PTY_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let seq = PTY_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    format!("pty-{}-{}", t.as_millis(), seq)
}

//! @description Tauri 应用入口 lib，注册命令 / 插件 / 全局状态
//! @module src-tauri
//! @prd docs/prds/claude-workflow-kanban.md#工作区接入
//! @rules
//!   - 新增命令必须在 invoke_handler 中注册，否则前端 invoke 会报 command not found

use std::sync::Mutex;
use tracing_subscriber::EnvFilter;

pub mod commands;
pub mod error;
pub mod events;
pub mod fs;
pub mod models;
pub mod scan;
pub mod watcher;
pub mod pty;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(watcher::WatcherState::new(Mutex::new(None)))
        .manage(pty::PtyMap::new(Mutex::new(std::collections::HashMap::new())))
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::workspace::pick_workspace_folder,
            commands::workspace::validate_workspace,
            commands::workspace::scan_workspace,
            commands::workspace::get_recent_workspaces,
            commands::workspace::add_recent_workspace,
            commands::fs::read_file_raw,
            commands::fs::write_file,
            commands::fs::create_file,
            commands::fs::delete_file,
            commands::fs::rename_file,
            commands::fs::update_frontmatter,
            commands::fs::update_task_status,
            commands::app_state::read_app_state,
            commands::app_state::write_app_state,
            commands::generic_board::read_generic_board,
            commands::generic_board::write_generic_board,
            commands::generic_board::get_layout,
            commands::generic_board::set_layout,
            watcher::start_watcher,
            watcher::stop_watcher,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

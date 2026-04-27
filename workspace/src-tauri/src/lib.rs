//! @description Tauri 应用入口 lib, 注册命令 / 插件 / 全局状态
//! @module src-tauri
//! @prd docs/prds/claude-workflow-kanban.md#工作区接入
//! @rules
//!   - M1 阶段只暴露 `ping` 命令用于联通性自检, 实际命令在 M2+ 添加

use tracing_subscriber::EnvFilter;

mod commands;
mod error;
mod events;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![commands::ping])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

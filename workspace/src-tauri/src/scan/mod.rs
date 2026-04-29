//! @description workspace 文件系统扫描模块
//! @module src-tauri/scan
//!
//! ## Public API
//! - `scanner::scan_workspace_dir(app, root) -> Result<Workspace, AppError>`

pub mod scanner;
pub mod parser;

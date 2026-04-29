//! @description 文件系统辅助模块：路径安全校验 + 原子写
//! @module src-tauri/fs
//!
//! ## Public API
//! - `atomic::safe_path(path, root) -> Result<PathBuf, AppError>`
//! - `atomic::atomic_write(path, content) -> Result<(), AppError>`

pub mod atomic;

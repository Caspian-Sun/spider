//! @description 应用统一错误类型，所有 Tauri command 返回 Result<T, AppError>，自动序列化为前端可读 JSON
//! @module src-tauri/error
//! @prd docs/prds/claude-workflow-kanban.md#文件系统集成
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T005
//! @rules
//!   - 写失败时 toast 必须展示具体原因 (PermissionDenied / DiskFull / NotFound / Other)，不能只说 Failed
//!   - 命令处理函数内一律用 ? + Result，不用 unwrap

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML 解析错误: {0}")]
    Yaml(String),

    #[error("JSON 解析错误: {0}")]
    Json(String),

    #[error("路径越权: {0}")]
    PathOutOfWorkspace(String),

    #[error("PTY 启动失败: {0}")]
    PtySpawn(String),

    #[error("PTY 写入失败: {0}")]
    PtyWrite(String),

    #[error("PTY 会话重复: {0}")]
    PtyDuplicate(String),

    #[error("Watcher 初始化失败: {0}")]
    WatcherInit(String),

    #[error("写入冲突: {0}")]
    Conflict(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 2)?;
        let kind = match self {
            AppError::Io(e) => {
                // 细化 IO 错误原因供前端 toast 展示
                match e.kind() {
                    std::io::ErrorKind::PermissionDenied => "permission_denied",
                    std::io::ErrorKind::NotFound         => "not_found",
                    std::io::ErrorKind::Other            => "disk_full",
                    _                                    => "io",
                }
            }
            AppError::Yaml(_)               => "yaml",
            AppError::Json(_)               => "json",
            AppError::PathOutOfWorkspace(_) => "path_out_of_workspace",
            AppError::PtySpawn(_)           => "pty_spawn",
            AppError::PtyWrite(_)           => "pty_write",
            AppError::PtyDuplicate(_)       => "pty_duplicate",
            AppError::WatcherInit(_)        => "watcher_init",
            AppError::Conflict(_)           => "conflict",
        };
        s.serialize_field("kind", kind)?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

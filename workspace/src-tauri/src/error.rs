//! @description 应用统一错误类型, 自动序列化为前端可读 JSON
//! @module src-tauri/error
//! @prd docs/prds/claude-workflow-kanban.md#工作区接入
//! @rules
//!   - 所有 Tauri command 返回 Result<T, AppError>, 不要返回 anyhow::Error
//!   - 前端 catch 到的 error 必须是结构化对象 ({ kind: "...", message: "..." })

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("解析错误: {0}")]
    Parse(String),

    #[error("无效的工作区: {0}")]
    InvalidWorkspace(String),

    #[error("PTY 启动失败: {0}")]
    PtySpawn(String),

    #[error("会话不存在: {0}")]
    SessionNotFound(String),

    #[error("内部错误: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 2)?;
        let kind = match self {
            AppError::Io(_) => "io",
            AppError::Parse(_) => "parse",
            AppError::InvalidWorkspace(_) => "invalid_workspace",
            AppError::PtySpawn(_) => "pty_spawn",
            AppError::SessionNotFound(_) => "session_not_found",
            AppError::Internal(_) => "internal",
        };
        s.serialize_field("kind", kind)?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

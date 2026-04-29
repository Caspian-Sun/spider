//! @description 路径安全校验 + 原子写
//! @module src-tauri/fs/atomic
//! @prd docs/prds/claude-workflow-kanban.md#文件系统集成
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T027
//! @rules
//!   - 所有写操作先对 path 做 canonicalize, 然后校验结果是否以 workspace rootPath 开头, 否则拒绝
//!   - write_file 必须原子写: 写临时文件 → fsync → rename 覆盖原文件; 禁止 truncate + write

use std::path::{Path, PathBuf};

use crate::error::AppError;

/// 校验 `path` 在 `root` 内部，返回规范化绝对路径；越界则 PathOutOfWorkspace。
pub fn safe_path(path: impl AsRef<Path>, root: impl AsRef<Path>) -> Result<PathBuf, AppError> {
    let root = root.as_ref().canonicalize().map_err(AppError::Io)?;

    // If the target doesn't exist yet, canonicalize its parent and reconstruct
    let target = path.as_ref();
    let canonical = if target.exists() {
        target.canonicalize().map_err(AppError::Io)?
    } else {
        let parent = target
            .parent()
            .ok_or_else(|| AppError::PathOutOfWorkspace(target.display().to_string()))?;
        let canonical_parent = if parent.as_os_str().is_empty() {
            std::env::current_dir().map_err(AppError::Io)?
        } else {
            parent.canonicalize().map_err(AppError::Io)?
        };
        canonical_parent.join(target.file_name().unwrap_or_default())
    };

    if !canonical.starts_with(&root) {
        return Err(AppError::PathOutOfWorkspace(canonical.display().to_string()));
    }
    Ok(canonical)
}

/// 原子写：写临时文件 → fsync → rename 覆盖。
pub fn atomic_write(path: impl AsRef<Path>, content: &str) -> Result<(), AppError> {
    let path = path.as_ref();
    let dir = path.parent().unwrap_or(Path::new("."));

    // Ensure parent directory exists
    std::fs::create_dir_all(dir)?;

    let tmp_path = path.with_extension(format!(
        "{}.tmp",
        path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("tmp")
    ));

    // Write to temp file
    std::fs::write(&tmp_path, content)?;

    // fsync the temp file
    {
        let f = std::fs::OpenOptions::new()
            .write(true)
            .open(&tmp_path)?;
        f.sync_all()?;
    }

    // Atomic rename
    std::fs::rename(&tmp_path, path)?;

    Ok(())
}

// ─── 单元测试 ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn r1_safe_path_rejects_traversal() {
        let root = tempdir().unwrap();
        let escape = root.path().join("../../etc/passwd");
        assert!(safe_path(escape, root.path()).is_err());
    }

    #[test]
    fn r2_atomic_write_creates_file() {
        let root = tempdir().unwrap();
        let target = root.path().join("output.md");
        atomic_write(&target, "hello").unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "hello");
    }
}

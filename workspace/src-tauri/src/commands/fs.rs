//! @description FS 相关 Tauri command：读写文件、frontmatter 更新、task 状态更新
//! @module src-tauri/commands/fs
//! @dependencies fs::atomic, scan::parser, error
//! @prd docs/prds/claude-workflow-kanban.md#文件系统集成
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T028
//! @rules
//!   - update_frontmatter 解析 YAML 时保留键顺序、注释、空行, 仅改动目标字段; 正文 markdown 不重写
//!   - update_task_status 打开 tasks.json 后, 只改目标 task 对象的目标字段, 其他 key 顺序不变

use std::path::PathBuf;

use crate::{
    error::AppError,
    fs::atomic::{atomic_write, safe_path},
};

/// 读取文件原始内容（UTF-8）。
#[tauri::command]
#[tracing::instrument]
pub async fn read_file_raw(path: String, root: String) -> Result<String, AppError> {
    let safe = safe_path(&path, &root)?;
    Ok(std::fs::read_to_string(safe)?)
}

/// 写入文件（原子写）。
#[tauri::command]
#[tracing::instrument]
pub async fn write_file(path: String, root: String, content: String) -> Result<(), AppError> {
    let safe = safe_path(&path, &root)?;
    atomic_write(safe, &content)
}

/// 创建新文件（含可选模板内容）。
#[tauri::command]
#[tracing::instrument]
pub async fn create_file(
    path:     String,
    root:     String,
    template: Option<String>,
) -> Result<(), AppError> {
    let safe = safe_path(&path, &root)?;
    if safe.exists() {
        return Err(AppError::Conflict(format!("{} already exists", safe.display())));
    }
    let content = template.unwrap_or_default();
    atomic_write(safe, &content)
}

/// 删除文件。
#[tauri::command]
#[tracing::instrument]
pub async fn delete_file(path: String, root: String) -> Result<(), AppError> {
    let safe = safe_path(&path, &root)?;
    std::fs::remove_file(safe)?;
    Ok(())
}

/// 重命名文件（源 / 目标都必须在 root 内）。
#[tauri::command]
#[tracing::instrument]
pub async fn rename_file(from: String, to: String, root: String) -> Result<(), AppError> {
    let safe_from = safe_path(&from, &root)?;
    let safe_to   = safe_path(PathBuf::from(&root).join(&to), &root)?;
    std::fs::rename(safe_from, safe_to)?;
    Ok(())
}

/// 更新 markdown 文件 YAML frontmatter 中的单个字段，保留其他内容。
///
/// Strategy: extract raw frontmatter block, use regex to replace/insert key=value,
/// then rewrite. This preserves comments and key order in surrounding content.
#[tauri::command]
#[tracing::instrument]
pub async fn update_frontmatter(
    path:  String,
    root:  String,
    key:   String,
    value: String,
) -> Result<(), AppError> {
    let safe = safe_path(&path, &root)?;
    let original = std::fs::read_to_string(&safe)?;

    let updated = patch_frontmatter_field(&original, &key, &value);
    atomic_write(safe, &updated)
}

/// 更新 tasks.json 中指定 task 的 status 字段，保留其他 key 顺序。
#[tauri::command]
#[tracing::instrument]
pub async fn update_task_status(
    manifest_path: String,
    root:          String,
    task_id:       String,
    status:        String,
) -> Result<(), AppError> {
    let safe = safe_path(&manifest_path, &root)?;
    let raw  = std::fs::read_to_string(&safe)?;

    let mut v: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| AppError::Json(e.to_string()))?;

    let tasks = v["tasks"]
        .as_array_mut()
        .ok_or_else(|| AppError::Json("tasks is not an array".into()))?;

    let task = tasks
        .iter_mut()
        .find(|t| t["taskId"].as_str() == Some(&task_id))
        .ok_or_else(|| AppError::Json(format!("task {} not found", task_id)))?;

    task["status"] = serde_json::Value::String(status);

    let out = serde_json::to_string_pretty(&v).map_err(|e| AppError::Json(e.to_string()))?;
    atomic_write(safe, &out)
}

// ─── 内部工具 ──────────────────────────────────────────────────────────────────

/// Replace or insert a single YAML key inside a `---` frontmatter block.
/// Preserves comments, blank lines, and all other keys.
fn patch_frontmatter_field(content: &str, key: &str, value: &str) -> String {
    // Does the file start with "---"?
    if !content.starts_with("---") {
        // No frontmatter — prepend a new block
        return format!("---\n{}: {}\n---\n{}", key, value, content);
    }

    // Find closing "---" (or "...")
    let after_open = &content[3..];
    let close_pos = after_open.find("\n---").or_else(|| after_open.find("\n..."));

    let (fm_block, rest) = match close_pos {
        Some(p) => {
            let fm = &after_open[..p];
            let rest = &after_open[p + 4..]; // skip "\n---"
            (fm, rest)
        }
        None => (after_open, ""),
    };

    // Try to replace existing key
    let key_prefix = format!("{}:", key);
    let mut found = false;
    let new_fm: String = fm_block
        .lines()
        .map(|line| {
            let trimmed = line.trim_start();
            if trimmed.starts_with(&key_prefix) {
                found = true;
                format!("{}: {}", key, value)
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    let new_fm = if found {
        new_fm
    } else {
        format!("{}\n{}: {}", new_fm, key, value)
    };

    let rest_str = if rest.is_empty() {
        String::new()
    } else {
        format!("\n---{}", rest)
    };

    format!("---{}\n---{}", new_fm, rest_str)
}

// ─── 单元测试 ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn patch_replaces_existing_key() {
        let md = "---\nstatus: draft\ntitle: foo\n---\n# Body";
        let out = patch_frontmatter_field(md, "status", "active");
        assert!(out.contains("status: active"));
        assert!(out.contains("title: foo"));
        assert!(out.contains("# Body"));
    }

    #[test]
    fn patch_inserts_missing_key() {
        let md = "---\ntitle: foo\n---\n# Body";
        let out = patch_frontmatter_field(md, "status", "active");
        assert!(out.contains("status: active"));
        assert!(out.contains("title: foo"));
    }
}

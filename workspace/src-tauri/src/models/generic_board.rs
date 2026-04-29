//! @description 通用看板数据模型，与 workspace/src/types/ipc.ts GenericBoard 系列一一对应
//! @module src-tauri/models/generic_board
//! @dependencies serde, serde_json
//! @prd docs/prds/claude-workflow-kanban.md#通用看板视图
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T047
//! @rules
//!   - GenericBoard 持久化到 workspace 根目录的 .claude/.kanban-board.json
//!   - GenericBoard.version: 1 用于 schema 迁移

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GenericBoard {
    pub columns: Vec<GenericColumn>,
    pub cards:   Vec<GenericCard>,
    pub version: u32,   // schema version, always 1
}

impl Default for GenericBoard {
    fn default() -> Self {
        Self {
            columns: vec![
                GenericColumn { id: "backlog".into(),  title: "Backlog".into(),  color: "var(--line-2)".into() },
                GenericColumn { id: "ready".into(),    title: "Ready".into(),    color: "var(--blue)".into() },
                GenericColumn { id: "running".into(),  title: "Running".into(),  color: "var(--green)".into() },
                GenericColumn { id: "done".into(),     title: "Done".into(),     color: "var(--teal)".into() },
            ],
            cards:   Vec::new(),
            version: 1,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GenericColumn {
    pub id:    String,
    pub title: String,
    pub color: String,   // CSS 变量名, 如 "var(--green)"
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GenericCard {
    pub id:            String,
    pub col:           String,
    pub title:         String,
    pub desc:          String,
    pub status:        CardStatus,
    pub boot_commands: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size:          Option<CardSize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pty_id:        Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CardSize {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub w: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CardStatus {
    Idle,
    Run,
    Ok,
    Err,
}

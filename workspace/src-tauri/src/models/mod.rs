//! @description Workspace 核心数据模型，与 workspace/src/types/ipc.ts 字段一一对应
//! @module src-tauri/models
//! @dependencies serde, serde_json
//! @prd docs/prds/claude-workflow-kanban.md#文件扫描
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T006
//! @rules
//!   - 遍历 .claude/commands/*.md, 每个文件对应一条 Command, 解析 YAML frontmatter
//!   - Command 按 idx 升序排主 pipeline; idx 为 null 或 helper: true 的进入 helper 区

pub mod generic_board;
pub use generic_board::{GenericBoard, GenericCard, GenericColumn};

use serde::{Deserialize, Serialize};

// ─── 工作区根 ─────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub root_path:      String,
    pub commands:       Vec<Command>,
    pub agents:         Vec<SubAgent>,
    pub rules:          Vec<Rule>,
    pub hooks:          Vec<Hook>,
    pub prds:           Vec<Prd>,
    pub tasks:          Vec<TaskManifest>,
    pub bug_reports:    Vec<BugReport>,
    pub retrospectives: Vec<Retrospective>,
    pub static_docs:    Vec<StaticDoc>,
    pub scan_errors:    Vec<ScanError>,
}

// ─── 工作流命令 ────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Command {
    pub id:        String,
    pub cmd:       String,
    pub file_path: String,
    pub idx:       Option<u32>,
    pub title:     String,
    pub desc:      String,
    pub inputs:    Vec<String>,
    pub outputs:   Vec<String>,
    pub gate:      Option<String>,
    pub helper:    bool,
    pub body:      String,
}

// ─── 子代理 ────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SubAgent {
    pub id:             String,
    pub name:           String,
    pub desc:           String,
    pub file_path:      String,
    pub bound_commands: Vec<String>,
}

// ─── 规则 ──────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id:        String,
    pub priority:  RulePriority,
    pub title:     String,
    pub desc:      String,
    pub file_path: String,
    pub lanes:     Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum RulePriority {
    P0, P1, P2,
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Hook {
    pub id:             String,
    pub name:           String,
    pub trigger:        HookTrigger,
    pub bound_commands: Vec<String>,
    pub file_path:      String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum HookTrigger {
    Pre, Post, OnChange,
}

// ─── PRD ───────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Prd {
    pub id:         String,
    pub title:      String,
    pub status:     PrdStatus,
    pub author:     String,
    pub updated_at: String,
    pub tbd_count:  u32,
    pub summary:    String,
    pub anchors:    PrdAnchors,
    pub file_path:  String,
    pub body:       String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum PrdStatus {
    Draft, Active, Archived,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct PrdAnchors {
    pub tasks: u32,
    pub code:  u32,
    pub tests: u32,
}

// ─── 任务清单 ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskManifest {
    pub prd_ref:   String,
    pub file_path: String,
    pub tasks:     Vec<Task>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id:     String,
    pub title:  String,
    pub status: TaskStatus,
    pub prd_ref: String,
    pub rules:  Vec<String>,
    pub deps:   Vec<String>,
    pub lane:   String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum TaskStatus {
    Pending,
    InProgress,
    Done,
    Blocked,
}

// ─── Bug 报告 ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BugReport {
    pub id:         String,
    pub title:      String,
    pub priority:   Priority,
    pub status:     BugStatus,
    pub reporter:   String,
    pub created_at: String,
    pub file_path:  String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Priority {
    P0, P1, P2,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum BugStatus {
    Triage, Reproducing, Fixing, Fixed,
}

// ─── 回溯记录 ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Retrospective {
    pub id:        String,
    pub date:      String,
    pub drift:     u32,
    pub dead:      u32,
    pub commits:   u32,
    pub file_path: String,
}

// ─── 静态文档 ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StaticDoc {
    pub id:        String,
    pub file:      String,
    pub desc:      String,
    pub file_path: String,
    pub body:      String,
}

// ─── 扫描错误 ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanError {
    pub file_path: String,
    pub reason:    String,
}

// ─── 应用持久化状态 ────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppPersistentState {
    pub layout:            Layout,
    pub recent_workspaces: Vec<String>,
    pub tweaks:            AppTweaks,
}

impl Default for AppPersistentState {
    fn default() -> Self {
        Self {
            layout:            Layout::Workflow,
            recent_workspaces: Vec::new(),
            tweaks:            AppTweaks::default(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Layout {
    Workflow,
    Generic,
}

impl Default for Layout {
    fn default() -> Self { Layout::Workflow }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppTweaks {
    pub density:           Density,
    pub show_helper_lanes: bool,
    pub show_descriptions: bool,
    pub column_width:      ColumnWidth,
    pub accent:            Accent,
    pub theme:             Theme,
}

impl Default for AppTweaks {
    fn default() -> Self {
        Self {
            density:           Density::Comfortable,
            show_helper_lanes: true,
            show_descriptions: true,
            column_width:      ColumnWidth::Standard,
            accent:            Accent::Green,
            theme:             Theme::Dark,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Density { Compact, Comfortable }

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum ColumnWidth { Narrow, Standard, Wide }

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Accent { Green, Blue, Purple }

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Theme { Dark, Light }

// ─── 工作区校验结果 ────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ValidateResult {
    pub valid:    bool,
    pub detected: Vec<String>,
}

// ─── scan_progress event payload ──────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressPayload {
    pub current_file: String,
    pub progress:     f32,     // 0.0 ~ 1.0
}

// ─── workspace_changed event payload ─────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceChangedPayload {
    pub kind: String,
    pub diff: WatcherDiff,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct WatcherDiff {
    pub added:    Vec<String>,
    pub modified: Vec<String>,
    pub deleted:  Vec<String>,
}

// ─── PTY event payloads ───────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PtyOutputPayload {
    pub pty_id: String,
    pub data:   String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PtyExitPayload {
    pub pty_id: String,
    pub code:   i32,
}

//! @description scan_workspace 主流程：遍历文件系统，解析 frontmatter，推 scan_progress 事件
//! @module src-tauri/scan/scanner
//! @dependencies gray_matter, serde_yaml, tokio
//! @prd docs/prds/claude-workflow-kanban.md#文件扫描
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T008
//! @rules
//!   - 遍历 .claude/commands/*.md, 每个文件对应一条 Command, 解析 YAML frontmatter
//!   - Command 无 frontmatter 时降级: id = 文件名, title = 文件首个 # 标题, idx = null, helper = true
//!   - 解析失败的单个文件不阻断整个扫描, 错误记入 scan_errors 数组
//!   - 扫描目录时必须排除 node_modules / .git / dist / target / .DS_Store
//!   - 遍历 docs/prds/*.md, tbdCount = 正文中 [TBD] 字符串的出现次数

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter};
use tokio::io::AsyncReadExt;

use crate::{
    error::AppError,
    events,
    models::{
        BugReport, BugStatus, Command, Hook, HookTrigger, Prd, PrdAnchors, PrdStatus, Priority,
        Retrospective, Rule, RulePriority, ScanError, ScanProgressPayload, StaticDoc, SubAgent,
        Task, TaskManifest, TaskStatus, Workspace,
    },
    scan::parser::{self, CommandFrontmatter, PrdFrontmatter, RuleFrontmatter, try_parse_fm},
};

const EXCLUDE_DIRS: &[&str] = &["node_modules", ".git", "dist", "target", ".DS_Store"];

#[derive(Clone, Copy)]
enum ScanKind {
    Command, Agent, Rule, Hook, Prd, Tasks, Bug, Retro, StaticDoc,
}

/// 扫描 workspace 根目录，返回完整 Workspace。
pub async fn scan_workspace_dir(app: &AppHandle, root: PathBuf) -> Result<Workspace, AppError> {
    let mut workspace = Workspace {
        root_path: root.to_string_lossy().to_string(),
        ..Default::default()
    };

    let mut files: Vec<(ScanKind, PathBuf)> = Vec::new();

    collect_md(&root.join(".claude/commands"),      ScanKind::Command,   &mut files).await;
    collect_md(&root.join(".claude/agents"),        ScanKind::Agent,     &mut files).await;
    collect_md(&root.join(".claude/rules"),         ScanKind::Rule,      &mut files).await;
    collect_md(&root.join(".claude/hooks"),         ScanKind::Hook,      &mut files).await;
    collect_md(&root.join("docs/prds"),             ScanKind::Prd,       &mut files).await;
    collect_json(&root.join("docs/tasks"),          ScanKind::Tasks,     &mut files).await;
    collect_md(&root.join("docs/bug-reports"),      ScanKind::Bug,       &mut files).await;
    collect_md(&root.join("docs/retrospectives"),   ScanKind::Retro,     &mut files).await;
    // docs/ 直接子 .md 作为静态文档（read_dir 本身不递归）
    collect_md(&root.join("docs"),                  ScanKind::StaticDoc, &mut files).await;

    let total = files.len().max(1) as f32;

    for (idx, (kind, path)) in files.iter().enumerate() {
        let rel = path
            .strip_prefix(&root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        emit_progress(app, &rel, (idx as f32 + 1.0) / total);

        if let Err(e) = process_file(*kind, path, &root, &mut workspace).await {
            workspace.scan_errors.push(ScanError {
                file_path: rel,
                reason:    e.to_string(),
            });
        }
    }

    workspace.commands.sort_by(|a, b| match (a.idx, b.idx) {
        (Some(ai), Some(bi)) => ai.cmp(&bi),
        (Some(_), None)      => std::cmp::Ordering::Less,
        (None, Some(_))      => std::cmp::Ordering::Greater,
        (None, None)         => a.id.cmp(&b.id),
    });

    emit_progress(app, "", 1.0);
    Ok(workspace)
}

async fn collect_md(dir: &Path, kind: ScanKind, out: &mut Vec<(ScanKind, PathBuf)>) {
    let Ok(mut entries) = tokio::fs::read_dir(dir).await else { return };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let p = entry.path();
        if should_exclude(&p) || !p.is_file() { continue; }
        if p.extension().map_or(false, |e| e == "md") {
            out.push((kind, p));
        }
    }
}

async fn collect_json(dir: &Path, kind: ScanKind, out: &mut Vec<(ScanKind, PathBuf)>) {
    let Ok(mut entries) = tokio::fs::read_dir(dir).await else { return };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let p = entry.path();
        if should_exclude(&p) || !p.is_file() { continue; }
        if p.extension().map_or(false, |e| e == "json") {
            out.push((kind, p));
        }
    }
}

fn should_exclude(p: &Path) -> bool {
    p.file_name()
        .and_then(|n| n.to_str())
        .map_or(false, |n| EXCLUDE_DIRS.contains(&n))
}

async fn process_file(
    kind: ScanKind,
    path: &Path,
    root: &Path,
    ws: &mut Workspace,
) -> Result<(), AppError> {
    let content  = read_to_string(path).await?;
    let rel      = path.strip_prefix(root).unwrap_or(path).to_string_lossy().to_string();
    let stem     = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();

    match kind {
        ScanKind::Command => {
            let (fm_str, body) = parser::parse_md(&content);
            let fm: CommandFrontmatter = fm_str.as_deref().map(|s| try_parse_fm(s)).unwrap_or_default();

            let id     = fm.id.unwrap_or_else(|| stem.clone());
            let helper = fm.helper.unwrap_or(false) || fm.idx.is_none();
            let title  = fm.title.unwrap_or_else(|| {
                parser::extract_first_h1(&body).unwrap_or_else(|| id.clone())
            });

            ws.commands.push(Command {
                id:        id.clone(),
                cmd:       fm.cmd.unwrap_or_else(|| id.clone()),
                file_path: rel,
                idx:       fm.idx,
                title,
                desc:      fm.desc.unwrap_or_default(),
                inputs:    fm.inputs.unwrap_or_default(),
                outputs:   fm.outputs.unwrap_or_default(),
                gate:      fm.gate,
                helper,
                body,
            });
        }

        ScanKind::Agent => {
            ws.agents.push(SubAgent {
                id: stem.clone(), name: stem.clone(),
                desc: String::new(), file_path: rel, bound_commands: Vec::new(),
            });
        }

        ScanKind::Rule => {
            let (fm_str, _) = parser::parse_md(&content);
            let fm: RuleFrontmatter = fm_str.as_deref().map(|s| try_parse_fm(s)).unwrap_or_default();
            let priority = match fm.priority.as_deref() {
                Some("P0") => RulePriority::P0,
                Some("P1") => RulePriority::P1,
                _          => RulePriority::P2,
            };
            ws.rules.push(Rule {
                id:        fm.id.unwrap_or_else(|| stem.clone()),
                priority,
                title:     fm.title.unwrap_or_else(|| stem.clone()),
                desc:      fm.desc.unwrap_or_default(),
                file_path: rel,
                lanes:     fm.lanes.unwrap_or_default(),
            });
        }

        ScanKind::Hook => {
            ws.hooks.push(Hook {
                id: stem.clone(), name: stem.clone(),
                trigger: HookTrigger::Post, bound_commands: Vec::new(), file_path: rel,
            });
        }

        ScanKind::Prd => {
            let (fm_str, body) = parser::parse_md(&content);
            let fm: PrdFrontmatter = fm_str.as_deref().map(|s| try_parse_fm(s)).unwrap_or_default();
            let tbd_count = parser::count_tbd(&body);
            ws.prds.push(Prd {
                id:         fm.id.unwrap_or_else(|| stem.clone()),
                title:      fm.title.unwrap_or_else(|| stem.clone()),
                status:     parse_prd_status(fm.status.as_deref()),
                author:     fm.author.unwrap_or_default(),
                updated_at: fm.updated_at.unwrap_or_default(),
                tbd_count,
                summary:    fm.summary.unwrap_or_default(),
                anchors:    PrdAnchors::default(),
                file_path:  rel,
                body,
            });
        }

        ScanKind::Tasks => {
            let v: serde_json::Value =
                serde_json::from_str(&content).map_err(|e| AppError::Json(e.to_string()))?;
            let tasks = v["tasks"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|t| Some(Task {
                    id:      t["taskId"].as_str()?.to_string(),
                    title:   t["name"].as_str().unwrap_or("").to_string(),
                    status:  parse_task_status(t["status"].as_str()),
                    prd_ref: t["prdRef"].as_str().unwrap_or("").to_string(),
                    rules:   t["businessRules"].as_array().unwrap_or(&vec![])
                        .iter().filter_map(|r| r.as_str().map(String::from)).collect(),
                    deps:    t["dependencies"].as_array().unwrap_or(&vec![])
                        .iter().filter_map(|d| d.as_str().map(String::from)).collect(),
                    lane:    t["type"].as_str().unwrap_or("code").to_string(),
                }))
                .collect();
            ws.tasks.push(TaskManifest {
                prd_ref:   v["prdRef"].as_str().unwrap_or("").to_string(),
                file_path: rel,
                tasks,
            });
        }

        ScanKind::Bug => {
            ws.bug_reports.push(BugReport {
                id: stem.clone(), title: stem.clone(),
                priority: Priority::P2, status: BugStatus::Triage,
                reporter: String::new(), created_at: String::new(), file_path: rel,
            });
        }

        ScanKind::Retro => {
            ws.retrospectives.push(Retrospective {
                id: stem.clone(), date: String::new(),
                drift: 0, dead: 0, commits: 0, file_path: rel,
            });
        }

        ScanKind::StaticDoc => {
            ws.static_docs.push(StaticDoc {
                id:        stem.clone(),
                file:      path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                desc:      String::new(),
                file_path: rel,
                body:      content,
            });
        }
    }
    Ok(())
}

async fn read_to_string(path: &Path) -> Result<String, AppError> {
    let mut file = tokio::fs::File::open(path).await?;
    let mut buf  = String::new();
    file.read_to_string(&mut buf).await?;
    Ok(buf)
}

fn emit_progress(app: &AppHandle, current_file: &str, progress: f32) {
    let _ = app.emit(
        events::SCAN_PROGRESS,
        ScanProgressPayload { current_file: current_file.to_string(), progress },
    );
}

fn parse_prd_status(s: Option<&str>) -> PrdStatus {
    match s {
        Some("active")   => PrdStatus::Active,
        Some("archived") => PrdStatus::Archived,
        _                => PrdStatus::Draft,
    }
}

fn parse_task_status(s: Option<&str>) -> TaskStatus {
    match s {
        Some("in-progress") => TaskStatus::InProgress,
        Some("done")        => TaskStatus::Done,
        Some("blocked")     => TaskStatus::Blocked,
        _                   => TaskStatus::Pending,
    }
}

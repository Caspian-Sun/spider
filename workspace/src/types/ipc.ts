/**
 * @description 与 Rust struct 一一对应的 TypeScript IPC 类型，字段 camelCase（Rust 端 serde rename_all）
 * @module src/types
 * @prd docs/prds/claude-workflow-kanban.md#文件扫描
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T004
 * @rules
 *   - TypeScript 类型必须与 Rust struct 一一对应，任何字段改动必须先改 Rust 再改 TS
 */

// ─── 工作区状态机 ──────────────────────────────────────────────────────────────

export type WorkspaceState = 'empty' | 'scanning' | 'invalid' | 'ready';

export interface Workspace {
  rootPath:       string;
  commands:       Command[];
  agents:         SubAgent[];
  rules:          Rule[];
  hooks:          Hook[];
  prds:           PRD[];
  tasks:          TaskManifest[];
  bugReports:     BugReport[];
  retrospectives: Retrospective[];
  staticDocs:     StaticDoc[];
  scanErrors:     ScanError[];
}

// ─── 工作流命令 ────────────────────────────────────────────────────────────────

export interface Command {
  id:       string;         // 文件名去掉 .md
  cmd:      string;         // 斜杠命令名，默认 = id
  filePath: string;         // 相对 rootPath
  idx:      number | null;
  title:    string;
  desc:     string;
  inputs:   string[];       // artifact 文件名
  outputs:  string[];
  gate:     string | null;  // 下游 gate 命令 id
  helper:   boolean;
  body:     string;         // 正文
}

// ─── 子代理 ────────────────────────────────────────────────────────────────────

export interface SubAgent {
  id:            string;
  name:          string;
  desc:          string;
  filePath:      string;
  boundCommands: string[];  // frontmatter bindTo
}

// ─── 规则 ──────────────────────────────────────────────────────────────────────

export interface Rule {
  id:       string;
  priority: 'P0' | 'P1' | 'P2';
  title:    string;
  desc:     string;
  filePath: string;
  lanes:    string[];
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export interface Hook {
  id:            string;
  name:          string;
  trigger:       'pre' | 'post' | 'on-change';
  boundCommands: string[];
  filePath:      string;
}

// ─── PRD ───────────────────────────────────────────────────────────────────────

export interface PRD {
  id:        string;        // 如 PRD-042
  title:     string;
  status:    'draft' | 'active' | 'archived';
  author:    string;
  updatedAt: string;
  tbdCount:  number;        // 正文 [TBD] 出现次数
  summary:   string;
  anchors:   { tasks: number; code: number; tests: number };
  filePath:  string;
  body:      string;
}

// ─── 任务清单 ──────────────────────────────────────────────────────────────────

export interface TaskManifest {
  prdRef:   string;
  filePath: string;
  tasks:    Task[];
}

export type TaskStatus = 'pending' | 'in-progress' | 'done' | 'blocked';

export interface Task {
  id:     string;           // T001 等
  title:  string;
  status: TaskStatus;
  prdRef: string;
  rules:  string[];
  deps:   string[];
  lane:   string;           // 默认 'code'
}

// ─── Bug 报告 ──────────────────────────────────────────────────────────────────

export type BugPriority = 'P0' | 'P1' | 'P2';
export type BugStatus   = 'triage' | 'reproducing' | 'fixing' | 'fixed';

export interface BugReport {
  id:        string;        // BUG-17
  title:     string;
  priority:  BugPriority;
  status:    BugStatus;
  reporter:  string;
  createdAt: string;
  filePath:  string;
}

// ─── 回溯记录 ──────────────────────────────────────────────────────────────────

export interface Retrospective {
  id:       string;
  date:     string;
  drift:    number;
  dead:     number;
  commits:  number;
  filePath: string;
}

// ─── 静态文档 ──────────────────────────────────────────────────────────────────

export interface StaticDoc {
  id:       string;
  file:     string;         // WORKFLOW.md 等
  desc:     string;
  filePath: string;
  body:     string;
}

// ─── 扫描错误 ──────────────────────────────────────────────────────────────────

export interface ScanError {
  filePath: string;
  reason:   string;
}

// ─── 看板卡片状态 ──────────────────────────────────────────────────────────────

export type CardKind   = 'main' | 'sub' | 'skill' | 'hook';
export type CardStatus = 'idle' | 'run' | 'ok' | 'err';

export interface AgentCardState {
  id:        string;        // 运行时生成
  kind:      CardKind;
  commandId: string;
  laneId:    string;
  title:     string;
  status:    CardStatus;
  ptyId:     string | null;
}

// ─── 通用看板视图 ──────────────────────────────────────────────────────────────

export type Layout = 'workflow' | 'generic';

export interface GenericBoard {
  columns: GenericColumn[];
  cards:   GenericCard[];
  version: 1;               // schema 版本，升级时迁移
}

export interface GenericColumn {
  id:    string;            // backlog / ready / running / done / 用户自定义
  title: string;
  color: string;            // Design Token CSS 变量名，如 'var(--blue)'
}

export interface GenericCard {
  id:           string;     // nanoid(8)
  col:          string;     // 命中 GenericColumn.id
  title:        string;
  desc:         string;
  status:       CardStatus;
  bootCommands: string[];   // 进入 'running' 列时按序 inject
  size?:        { w?: number; h?: number };
  ptyId?:       string | null;
}

// ─── 应用持久化状态 ────────────────────────────────────────────────────────────

export interface AppPersistentState {
  layout:           Layout;
  recentWorkspaces: string[];
  tweaks: {
    density:          'compact' | 'comfortable';
    showHelperLanes:  boolean;
    showDescriptions: boolean;
    columnWidth:      'narrow' | 'standard' | 'wide';
    accent:           'green' | 'blue' | 'purple';
    theme:            'dark' | 'light';
  };
}

// ─── Tauri command 返回值 ──────────────────────────────────────────────────────

export interface ValidateResult {
  valid:    boolean;
  detected: string[];       // 找到的子目录列表，如 ['.claude']
}

export interface ScanProgressPayload {
  currentFile: string;
  progress:    number;      // 0.0 ~ 1.0
}

export interface WorkspaceChangedPayload {
  kind: string;             // 'commands' | 'prds' | 'tasks' | ...
  diff: {
    added:    string[];
    modified: string[];
    deleted:  string[];
  };
}

export interface PtyOutputPayload {
  ptyId: string;
  data:  string;
}

export interface PtyExitPayload {
  ptyId: string;
  code:  number;
}

// ─── 错误类型 (与 Rust AppError 对应) ─────────────────────────────────────────

export interface AppError {
  kind:    'io' | 'yaml' | 'json' | 'path_out_of_workspace' | 'pty_spawn' | 'pty_write' | 'pty_duplicate' | 'watcher_init' | 'conflict';
  message: string;
}

/**
 * @description Tauri command / event 名常量，与附录 C Rust 端签名一一对应
 * @module src/ipc
 * @prd docs/prds/claude-workflow-kanban.md#文件系统集成
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T003
 * @rules
 *   - Tauri command 名 / event 名必须用常量管理，一处拼错全链路断
 *   - 修改任何值必须同步更新 Rust 端 src-tauri/src/events.rs 或对应 command 函数名
 */

export const IPC = {
  Cmd: {
    // ── 工作区 ────────────────────────────────────────────
    PICK_WORKSPACE_FOLDER:  'pick_workspace_folder',
    VALIDATE_WORKSPACE:     'validate_workspace',
    SCAN_WORKSPACE:         'scan_workspace',
    GET_RECENT_WORKSPACES:  'get_recent_workspaces',
    ADD_RECENT_WORKSPACE:   'add_recent_workspace',

    // ── 文件 watcher ──────────────────────────────────────
    START_WATCHER:          'start_watcher',
    STOP_WATCHER:           'stop_watcher',

    // ── PTY ───────────────────────────────────────────────
    PTY_SPAWN:              'pty_spawn',
    PTY_WRITE:              'pty_write',
    PTY_RESIZE:             'pty_resize',
    PTY_KILL:               'pty_kill',

    // ── 文件读写 ──────────────────────────────────────────
    READ_FILE_RAW:          'read_file_raw',
    WRITE_FILE:             'write_file',
    CREATE_FILE:            'create_file',
    DELETE_FILE:            'delete_file',
    RENAME_FILE:            'rename_file',
    UPDATE_FRONTMATTER:     'update_frontmatter',
    UPDATE_TASK_STATUS:     'update_task_status',

    // ── 通用看板 / 持久化状态 ─────────────────────────────
    READ_GENERIC_BOARD:     'read_generic_board',
    WRITE_GENERIC_BOARD:    'write_generic_board',
    GET_LAYOUT:             'get_layout',
    SET_LAYOUT:             'set_layout',
    READ_APP_STATE:         'read_app_state',
    WRITE_APP_STATE:        'write_app_state',
  },

  Event: {
    // ── Rust → JS ─────────────────────────────────────────
    SCAN_PROGRESS:      'scan_progress',
    WORKSPACE_CHANGED:  'workspace_changed',
    PTY_OUTPUT:         'pty_output',
    PTY_EXIT:           'pty_exit',
    BOARD_RESET:        'board_reset',
  },
} as const;

export type IpcCmd   = typeof IPC.Cmd[keyof typeof IPC.Cmd];
export type IpcEvent = typeof IPC.Event[keyof typeof IPC.Event];

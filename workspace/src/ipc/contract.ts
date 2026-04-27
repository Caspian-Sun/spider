/**
 * @description Tauri command / event 名常量, 必须与 Rust 端 events.rs / commands.rs 保持一致
 * @module src/ipc
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 * @rules
 *   - 任何新增 command/event 必须在此声明, 不允许在 invoke()/listen() 处直接拼字符串
 *   - 修改值必须同步更新 Rust 端常量
 */
export const IPC = {
  Cmd: {
    PING: 'ping',
    // M2+: SCAN_WORKSPACE, PICK_WORKSPACE, PTY_SPAWN, PTY_WRITE, PTY_RESIZE, PTY_KILL, ...
  },
  Event: {
    PTY_OUTPUT: 'pty_output',
    PTY_EXIT: 'pty_exit',
    WORKSPACE_CHANGED: 'workspace_changed',
    SCAN_PROGRESS: 'scan_progress',
  },
} as const;

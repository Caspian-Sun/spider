//! PTY 默认配置常量
pub mod pty_config {
    pub const DEFAULT_SHELL_UNIX: &str = "/bin/zsh";
    pub const DEFAULT_SHELL_WIN:  &str = "powershell.exe";
    pub const FALLBACK_SHELL:     &str = "/bin/sh";
    pub const DEFAULT_COLS: u16 = 80;
    pub const DEFAULT_ROWS: u16 = 24;
}

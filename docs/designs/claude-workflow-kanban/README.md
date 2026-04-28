# claude-workflow-kanban 设计稿归档

> 来源: Claude Design 工具一次性导出, 不再增量维护。
> 最后同步: 2026-04-28 (基于 spider (2) 原型)

## 文件清单

| 文件 | 类型 | 用途 | 对应 PRD 锚点 |
|------|------|------|---------------|
| `Workflow Kanban.html` | HTML 原型 | **流水线泳道**视觉 (主 MVP), 顶栏 / pipeline / 看板 / 抽屉的 CSS 变量与排版规范 | #顶栏, #流水线条, #看板与泳道, #规则抽屉, #文档浏览器, #PRD-预览与编辑 |
| `Terminal Kanban.html` | HTML 原型 | **通用看板** (Backlog/Ready/Running/Done) 视觉, MVP 内通过顶栏 layout toggle 切换 | #通用看板视图, #终端卡片 |
| `wf-app.jsx` | React 原型 | Workflow Kanban 的 Board / Lane / AgentCard / TopBar / Pipeline / 各抽屉 React 结构 | #顶栏 — #回溯时间轴 |
| `wf-terminal.jsx` | React 原型 | 终端卡片内 slash 命令脚本 / 装饰性 PTY 行为 | #终端卡片 |
| `app.jsx` | React 原型 | Terminal Kanban 通用看板的拖拽 / 选择 / Tweaks 面板 | #通用看板视图 |
| `terminal.jsx` | React 原型 | Terminal Kanban 内单卡片的终端实现 | #终端卡片 |
| `shell.jsx` | React 原型 | Fake shell 命令解析参考 (仅交互参考, 真实实现走 Rust PTY) | #终端卡片 |
| `card.jsx` | React 原型 | 卡片拖拽 / resize / 右键菜单行为参考 | #终端卡片, #通用看板视图 |

## 视觉规范 (源 = `Workflow Kanban.html` 的 `:root`)

颜色 / 字号 / 间距全部以 CSS 变量定义, 工程实现需在 `workspace/src/styles/tokens.ts` 集中映射, 详见 `.claude/rules/no-hardcode.md` 第 2 条。

| Token | 值 | 用途 |
|-------|----|------|
| `--bg` | `#07080a` | 整体背景 |
| `--bg-1` | `#0c0d10` | 顶栏 / pipeline 背景 |
| `--bg-2` | `#121418` | 卡片 / chip 背景 |
| `--bg-3` | `#171a1f` | hover 态 |
| `--line` | `#23262d` | 默认描边 |
| `--text` | `#e6e9ef` | 主文字 |
| `--text-2` | `#a5acba` | 次要文字 |
| `--text-3` | `#6b7280` | 提示文字 |
| `--green` | `#6ee77f` | running / ok 状态 / brand |
| `--amber` | `#ffb547` | wait / warning |
| `--red` | `#ff6b6b` | error |
| `--blue` | `#7aa2ff` | ready |
| `--teal` | `#5eead4` | brand 渐变 |
| `--mono` | `'JetBrains Mono', ...` | 等宽字体 |
| `--sans` | `'Inter', system-ui, ...` | 正文字体 |

## 注意事项

- 原型里的 `SEED_*` / `INITIAL` 常量**仅供视觉参考**, 工程实现必须接入 `scan_workspace` 真实数据。
- 原型用了 `localStorage` 持久化 (`tk-state-v1`), 工程实现禁止使用浏览器存储, 状态走 Rust 端 + Tauri command。
- 所有 `<input value="…">`, `<button>文案</button>` 等硬编码字符串, 工程实现必须改 i18n key (见 `.claude/rules/no-hardcode.md`)。

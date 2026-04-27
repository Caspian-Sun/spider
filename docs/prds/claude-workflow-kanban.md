# Claude Code Workflow Kanban PRD

> 写 PRD 的核心原则: **小标题即锚点**, 后续 `@prd docs/prds/claude-workflow-kanban.md#<锚点>` 全靠这些标题定位。小标题命名要稳定、明确, 不要随意改动。

## 元信息

| 项       | 值                                                                            |
| -------- | ----------------------------------------------------------------------------- |
| 模块代号 | `claude-workflow-kanban`                                                      |
| 负责人   | Tommy (suntao0518@gmail.com)                                                  |
| 创建日期 | 2026-04-24                                                                    |
| 最后更新 | 2026-04-24                                                                    |
| 状态     | draft                                                                         |
| 关联产物 | 旧稿 `PRD.md` (Claude Design 输出, 本 PRD 为官方重组版本, 见下方设计稿章节) |

## 背景与目标

`claude-code-workflow` 仓库把 AI 协作的知识沉淀成了两类文件: `.claude/` (命令 / 子代理 / 规则 / hooks) 和 `docs/` (PRD / tasks / bug-reports / retrospectives). 目前研发、产品、设计要查看或改动这些文件, 必须在 VSCode + 终端之间反复横跳, 很难一眼看清整个工作流状态, 也很难在看板里直接改 status 或启动 AI 命令。

本工具是一个**桌面端 GUI**, 把这两个目录的内容可视化成**看板 (Kanban)**: 每条泳道 = 一个工作流命令, 泳道里每张卡片 = 一个**真实的终端会话 (PTY)**, 用来运行 Claude Code 命令。所有看板内容**动态来自文件系统**, 不写死任何 seed 数据。UI 上对文件的改动立即回写磁盘, 外部编辑器改动经 watcher 实时刷新 UI, 做到「桌面端」和「VSCode」双向无感同步。

目标用户: 使用 `claude-code-workflow` 方法论开发前端项目的**研发 / 产品 / 设计** (三方共用一份看板对齐状态)。

> ⚠️ 本模块的技术栈**与 `claude-code-workflow` 主仓库的 UmiJS 栈无关**, 本工具是独立的 Tauri 桌面端应用, 见下文「附录 B · 技术栈与目录结构」。

## 名词解释

| 术语             | 含义                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------ |
| workspace        | 被打开的目标仓库根目录, 必须有 `.claude/` 子目录才算合法                             |
| workflow         | `.claude/commands/` 下一组命令按 `idx` 升序排成的流水线                              |
| lane (泳道)      | 看板上一列, 对应 `.claude/commands/` 下一个命令文件                                  |
| helper lane      | frontmatter `helper: true` 的命令, 不进主 pipeline, 放辅助区 (虚线边框)              |
| AgentCard (卡片) | 泳道内一张终端卡片, 绑定一个 PTY 进程, 用于运行 Claude Code 命令                     |
| gate             | 命令 frontmatter 的 `gate` 字段, 指向它的下游审查命令                                |
| artifact         | 一条命令的输入 / 输出文件 (`inputs` / `outputs` frontmatter 字段)                    |
| PTY              | pseudo-terminal, 通过 `portable-pty` 创建的跨平台伪终端                              |
| frontmatter      | `.md` 文件头部的 YAML 或 `.json` 文件的元数据字段                                    |
| TBD              | PRD 正文里的占位符 `[TBD]`, 工具会统计其数量提醒待补充                                |
| scan             | Rust 端一次性扫描整个 workspace 文件系统, 产出完整 `Workspace` 数据                  |
| watcher          | 文件变化监听器, 基于 Rust `notify` crate, 通过 Tauri event 把增量 diff 推给前端     |

## 设计稿

> 设计稿是视觉规范的唯一来源, 与 PRD 的业务规则互补: PRD 管「做什么」, 设计稿管「长什么样」。

| 项         | 值                                                                              |
| ---------- | ------------------------------------------------------------------------------- |
| 来源类型   | file (本地 HTML + JSX 原型, 已归档到 `docs/designs/claude-workflow-kanban/`)   |
| Figma 链接 | (无)                                                                            |
| 本地文件   | `docs/designs/claude-workflow-kanban/Workflow Kanban.html` (主设计文件 + CSS 变量源) |
|            | `docs/designs/claude-workflow-kanban/wf-app.jsx` (Board / Lane / AgentCard / 各抽屉的 React 结构) |
|            | `docs/designs/claude-workflow-kanban/wf-terminal.jsx` (终端卡片与 slash 命令脚本) |
|            | `docs/designs/claude-workflow-kanban/shell.jsx` (Fake shell 原型, 仅供交互参考) |
|            | `docs/designs/claude-workflow-kanban/card.jsx` (卡片拖拽 / resize / 右键菜单行为) |
| MCP 配置   | 未接入 (Figma 无资源, 不需要 figma-mcp)                                          |

### 功能点与设计帧映射

| 功能点 (PRD 锚点)   | 设计引用                                                             |
| ------------------- | -------------------------------------------------------------------- |
| #工作区接入         | `wf-app.jsx` → `WorkspaceShell` + 4 种 state 组件                    |
| #文件扫描           | `wf-app.jsx` 中 `SEED_*` 常量 (将被真实扫描结果替换)                 |
| #顶栏               | `Workflow Kanban.html` `.topbar` + `wf-app.jsx` `TopBar` / `PRDSelector` |
| #流水线条           | `Workflow Kanban.html` `.pipeline`                                   |
| #看板与泳道         | `Workflow Kanban.html` `.board` + `.lane` + `.connector`             |
| #终端卡片           | `wf-terminal.jsx` + `wf-app.jsx` `AgentCard` + `card.jsx` 拖拽行为   |
| #规则抽屉           | `wf-app.jsx` `RulesDrawer`                                           |
| #文档浏览器         | `wf-app.jsx` `DocsViewer`                                            |
| #PRD-预览与编辑     | `wf-app.jsx` `PRDSelector` 下拉 + `PRDPreview` 模态                  |
| #任务与-Bug         | `wf-app.jsx` `TaskRow` + `/fix` 泳道里的 `BugList`                   |
| #回溯时间轴         | `wf-app.jsx` `RetroTimeline`                                         |
| #文件系统集成       | (无视觉帧, 后端能力为主)                                             |
| #工具面板           | `Workflow Kanban.html` `.tweaks`                                     |

> **归档**: 设计稿已按规范放入 `docs/designs/claude-workflow-kanban/`, 路径为本仓库根目录的相对路径。原始来源是 Claude Design 工具一次性导出的 HTML + JSX 原型, 不再增量维护。

---

## 功能点 1: 工作区接入

### 用户故事

作为开发者, 我希望首次启动能选择本地仓库, 并自动打开最近一次使用的 workspace, 以便工具对接到我的 `claude-code-workflow` 项目。

### 字段定义

| 字段              | 类型              | 必填 | 校验规则                         | 默认值 |
| ----------------- | ----------------- | ---- | -------------------------------- | ------ |
| rootPath          | string (绝对路径) | 是   | 目录存在 + 可读                  | -      |
| recentWorkspaces  | string[]          | 否   | 最多 5 条, 去重, 按最近打开排序 | []     |
| workspaceState    | enum              | 是   | `empty` / `scanning` / `invalid` / `ready` | `empty` |

### 业务规则

1. 应用启动后, 若 `get_recent_workspaces` 返回空数组, 进入 `empty` 状态并显示欢迎页
2. 应用启动后, 若有最近工作区记录, 默认打开最近一个并自动进入 `scanning` 状态
3. `empty` 状态下点击 "Open folder" 按钮, 调用 `pick_workspace_folder` 弹出系统文件夹选择对话框
4. 选中文件夹后先调用 `validate_workspace`, 若返回 `valid: false` 则进入 `invalid` 状态并列出缺失项 (至少要缺 `.claude`)
5. 校验通过后进入 `scanning` 状态, 实时消费 `scan_progress` 事件并展示当前文件名 + 百分比进度条
6. `scan` 完成后自动进入 `ready` 状态, 并把 `rootPath` 写入 `recentWorkspaces` 头部
7. `ready` 状态下顶栏右侧的 "Close workspace" 按钮返回 `empty` 状态, 保留 `recentWorkspaces`
8. `invalid` 状态下点击 "Pick another" 回到 `empty` 状态, 当前路径不写入 `recentWorkspaces`
9. 用户在系统对话框里取消选择时, 保持当前状态不变, 不报错

### 数据契约 (Tauri command)

> 本模块是桌面端 Tauri 应用, 前后端交互走 `tauri::command` 而非 HTTP, 故不走 OpenAPI。完整命令签名见「附录 C · Tauri command 签名」。

#### 调用的命令

| 业务操作       | command                   | 参数           | 返回                                              |
| -------------- | ------------------------- | -------------- | ------------------------------------------------- |
| 选文件夹       | `pick_workspace_folder`   | -              | `string` (取消时 reject)                          |
| 校验           | `validate_workspace`      | `path: string` | `{ valid: boolean, detected: string[] }`          |
| 扫描           | `scan_workspace`          | `path: string` | `Workspace` (见附录 A)                            |
| 最近历史       | `get_recent_workspaces`   | -              | `string[]`                                        |

#### 事件

| 事件            | 方向         | payload                                    |
| --------------- | ------------ | ------------------------------------------ |
| `scan_progress` | Rust → JS    | `{ currentFile: string, progress: number }` (progress 0-1) |

### 交互流程

```
启动 → get_recent_workspaces
  ├─ 空 → empty
  └─ 有值 → 自动选第一个 → scanning (skip validate, 因为上次已通过)
empty → [Open folder] → pick_workspace_folder → validate_workspace
  ├─ valid → scanning → (scan_progress 事件流) → ready
  └─ invalid → invalid (显示缺失项) → [Pick another] → empty
```

### 异常场景

| 场景                          | 预期行为                                                    |
| ----------------------------- | ----------------------------------------------------------- |
| 用户取消文件夹对话框          | 保持当前状态, 不报错                                        |
| 选中路径不存在 / 不可读       | `empty` 状态 toast「路径不可用」, 不切换状态                |
| scan 过程中路径被外部删除     | 终止 scan, 切到 `invalid`, 提示「Workspace disappeared」    |
| scan 耗时 > 5s                | UI 显示「Still scanning, large workspace...」提示, 不中断  |
| 最近工作区记录已失效 (路径消失) | 自动从 `recentWorkspaces` 中剔除该条, 进入 `empty` 状态     |

---

## 功能点 2: 文件扫描

### 用户故事

作为开发者, 我希望工具能把 `.claude/` + `docs/` 下所有约定文件自动解析成结构化数据, 用作看板的唯一真相源。

### 字段定义

完整数据模型见「附录 A · Workspace 数据模型」。扫描产物是一个 `Workspace` 对象, 包含: `commands` / `agents` / `rules` / `hooks` / `prds` / `tasks` / `bugReports` / `retrospectives` / `staticDocs` 九大数组。

### 业务规则

1. 遍历 `.claude/commands/*.md`, 每个文件对应一条 `Command`, 解析 YAML frontmatter
2. `Command` 无 frontmatter 时降级: `id` = 文件名, `title` = 文件首个 `#` 标题, `idx` = null, `helper` = true (放辅助区)
3. `Command` 按 `idx` 升序排主 pipeline; `idx` 为 null 或 `helper: true` 的进入 helper 区
4. 遍历 `.claude/agents/*.md`, frontmatter 里 `bindTo: [cmd_id]` 决定 `SubAgent` 归属哪条泳道, 支持多个绑定
5. `SubAgent` 没有 `bindTo` 时进入浮动区, MVP 隐藏该区域 (不渲染)
6. 遍历 `.claude/rules/*.md`, frontmatter 必须同时有 `priority` 和 `lanes` 两个字段, 否则该规则无效并记入 `scan_errors`
7. 遍历 `.claude/hooks/*.md`, frontmatter 需要 `trigger` (`pre` / `post` / `on-change`) 和 `boundCommands`
8. 遍历 `docs/prds/*.md`, `id` = 文件名, `tbdCount` = 正文中 `[TBD]` 字符串的出现次数
9. PRD 的 `anchors` (tasks / code / tests 引用数) MVP 返回全 0, v2 再接入全仓库 grep
10. 遍历 `docs/tasks/*.json`, 每个文件 = 一个 `TaskManifest`, 任务按自身 `lane` 字段归到对应泳道
11. 遍历 `docs/bug-reports/*.md` 和 `docs/retrospectives/*.md`, 按各自 frontmatter schema 解析
12. 扫描 `WORKFLOW.md` / `DECISIONS.md` / `docs/**/README.md` 生成 `StaticDoc`
13. 扫描结果不做持久化 (文件少, 每次启动重新扫)
14. 解析失败的单个文件不阻断整个扫描, 错误记入 `scan_errors` 数组, 前端可在顶栏小徽章里看到「N 个文件解析失败」
15. 扫描目录时必须排除 `node_modules` / `.git` / `dist` / `target` / `.DS_Store`

### 数据契约

| 操作       | command            | 参数           | 返回        |
| ---------- | ------------------ | -------------- | ----------- |
| 扫描全量   | `scan_workspace`   | `path: string` | `Workspace` |

frontmatter schema 见「附录 D · frontmatter 最小 schema」。

### 异常场景

| 场景                        | 预期行为                                           |
| --------------------------- | -------------------------------------------------- |
| YAML 语法错                 | 该文件降级处理 + 记入 `scan_errors`, 其他文件继续   |
| 文件编码非 UTF-8            | 该文件跳过 + 记入 `scan_errors`                    |
| 权限不足读某文件            | 记入 `scan_errors`, 继续其他文件                   |
| `.claude/` 下混入子目录     | 递归扫描, 但只认 `.md` 后缀                         |
| `Command.idx` 有重复值      | 后扫到的保持原序, 前端不报错, `scan_errors` 里记录 |

---

## 功能点 3: 顶栏

### 用户故事

作为使用者, 我希望顶栏始终显示当前 workspace 状态, 快速切换 PRD, 并能一键打开规则 / 文档面板。

### 字段定义

顶栏全部只读展示, 无独立表单。各 chip 的数据来自 `workspaceStore` selector:

| 展示项        | 来源                                                                |
| ------------- | ------------------------------------------------------------------- |
| brand         | 静态常量                                                            |
| path chip     | `Workspace.rootPath` 最后 2 段 + `…` 前缀                           |
| PRDSelector   | `Workspace.prds` 数组 + 当前 `activePrdId`                          |
| stats chip    | 实时计算: `cards.filter(c => c.status === 'run').length`            |
| Rules 按钮    | `Workspace.rules.length` + violations 数                            |
| Docs 按钮     | 静态                                                                |

### 业务规则

1. 顶栏固定高度 46px, 吸顶, 不随看板横向滚动
2. 路径 chip 显示 `rootPath` 的最后两段 + 省略号前缀, 悬停 tooltip 显示完整路径
3. 点击路径 chip 复制完整 `rootPath` 到剪贴板, 并 toast「Path copied」
4. PRDSelector 展示当前激活 PRD 的 `id` + `status` badge + `tbdCount` (若 > 0 显示 amber 小气泡)
5. PRDSelector 下拉列出所有 PRD, 每条可直接点 `status` badge 切换状态 (draft / active / archived)
6. 下拉末尾有 `+ new PRD`, 点击调 `create_file(docs/prds/PRD-{nextId}.md, template='prd')`, 新文件立即成为激活 PRD
7. stats chip 显示「● N running」, N 为实时 `run` 状态的 PTY 数; N = 0 时显示灰色点
8. Rules 按钮文案格式「Rules(N)」, 若存在 violation, 文案后追加红色小数字徽章
9. 点 Rules 按钮打开 RulesDrawer; 点 Docs 按钮打开 DocsViewer
10. Reset 按钮点击弹二次确认「这会重新扫描 workspace, 丢失未保存的 UI 状态」, 确认后清 localStorage 并重新扫描, 不删任何用户文件
11. Run 按钮 MVP 灰化禁用, v2 实现「一键跑全流水线」

### 数据契约

| 操作                 | command              |
| -------------------- | -------------------- |
| 新建 PRD             | `create_file`        |
| 切 PRD status        | `update_frontmatter` |
| Reset workflow       | `scan_workspace` (重新调一次)  |

### 异常场景

| 场景                    | 预期行为                                |
| ----------------------- | --------------------------------------- |
| 切 PRD 时该文件被外部删除 | toast 错误 + 自动选列表第一项          |
| 无任何 PRD              | PRDSelector 显示「No PRD yet」, 下拉只有 `+ new` |
| 剪贴板 API 不可用       | toast「Clipboard unavailable」, 不中断   |

---

## 功能点 4: 流水线条

### 用户故事

作为开发者, 我希望一眼看懂整个工作流命令顺序, 以及当前处于哪一步。

### 业务规则

1. PipelineStrip 固定高度 38px, 位于顶栏下方, 跨屏吸顶
2. 每个主命令 (`helper: false` 且有 `idx`) 渲染为一个 step, 按 `idx` 升序
3. gate 命令 (上游 `Command.gate` 字段指向它) 以小菱形 step 形式嵌在其上游 step 之后
4. helper 命令 (`helper: true`) 放在流水线末端 `helpers:` 区, 与主流水线用 `|` 分隔
5. 点击 step 高亮对应泳道, 并让 Board 自动横向滚动到该泳道居中位置
6. 当前选中泳道对应 step 使用 `.active` 样式 (绿色边框 + 浅绿底)
7. 若一个泳道下所有归属 Task 的 `status` 都是 `done`, 则其 step 使用 `.done` 样式 (teal 小方块填满)
8. PipelineStrip 独立横向滚动 (滚动条隐藏), 滚动不影响 Board
9. step 右键菜单提供「Edit command source」选项, 点击弹内嵌 md 编辑器改对应 `.claude/commands/*.md`

### 数据契约

由 `Workspace.commands` + `Workspace.tasks` 派生, 无独立接口。

### 异常场景

| 场景                  | 预期行为                              |
| --------------------- | ------------------------------------- |
| 只有 helper 没有主命令 | pipeline 区显示「No main commands」   |
| step 对应文件外部删除 | step 消失; 若当前选中的是它, 自动选第一个 |

---

## 功能点 5: 看板与泳道

### 用户故事

作为开发者, 我希望在一个看板里同时看到每条命令的 tasks、sub-agents、rules、hooks, 以及运行中的终端会话。

### 字段定义

`Lane` 组件 props 由 `Workspace` 派生, 不持有独立状态。`AgentCardState` 独立存于 `workspaceStore.cards`。

### 业务规则

1. Board 区域横向滚动, 纵向固定高度 `100vh - 84px - 28px` (顶栏 46 + pipeline 38 = 84; 底部 retro timeline 28)
2. 主泳道宽度 360px, helper 泳道宽度 320px 且边框改虚线
3. lane-head 分两行: 第一行 idx 徽章 + 斜杠命令名 + count chip + gate-badge (若有); 第二行 `desc` + artifact tags
4. artifact tag 分两色: 输入 (蓝色, 来自 `Command.inputs`)、输出 (绿色, 来自 `Command.outputs`)
5. lane-body 纵向分四区, 顺序固定: `tasks` → `MAIN` agents → `SUB` agents → `SKILL` → `HOOK`; 该区无数据时对应 label 隐藏
6. 每个分区顶端有一条 section label (小圆点 + 字母色分类), 颜色严格对应 `kind` (main 绿 / sub 紫 / skill teal / hook amber)
7. lane-foot 是一个 `+ add terminal` 虚线按钮, 点击在本泳道底部新建一张 `kind: 'main'` 的 AgentCard, 并自动 `pty_spawn`
8. 泳道之间 connector 占 52px, SVG 箭头从上一泳道右侧中段指向下一泳道左侧中段
9. connector 中央浮动 `arrow-label` 显示下游命令 `inputs` 数组首个 artifact (无 inputs 则省略 label)
10. gate 类 connector (下游命令是 gate) 用 amber 色 + 菱形前缀符号 ◆
11. 卡片跨泳道拖拽时: PTY 保留 (`ptyId` 不变), 仅修改 `AgentCardState.laneId` 并刷新 UI; 不动任何文件
12. 拖拽过程中目标泳道 lane-body 应用 `.drop-active` 样式 (浅绿底 + inset 边框)
13. 空泳道 (无 tasks + 无 cards) 在 lane-body 中显示自定义空态占位 (lucide `Inbox` 图标 + 灰色提示), 文案「No cards yet, drop here or + add terminal」
14. 水平滚动条使用暗色主题样式 (高 10px, 轨道透明, thumb `--line` 色)

### 数据契约

纯前端 store 派生, 无后端接口。跨泳道拖拽的写入操作 (绑定到 Command) MVP **只修改内存状态**, 不回写文件。

### 交互流程

```
拖拽 → onDragStart 在 dataTransfer 写入 cardId
     → onDragOver 在所有 lane-body 上高亮 .drop-active
     → onDrop 目标 lane 读取 cardId, 调 store.rebindCard(cardId, newLaneId)
     → 箭头消失, 卡片出现在新泳道底部
```

### 异常场景

| 场景                           | 预期行为                                                |
| ------------------------------ | ------------------------------------------------------- |
| 命令文件被外部删除             | 泳道消失, 其中所有卡片迁移到「默认泳道」(第一个主命令), PTY 保留 |
| 拖拽松手在 Board 外            | 动作忽略, 卡片回到原泳道                                |
| 卡片被拖入 gate 泳道 (非主命令) | 允许, 但顶部 toast「This lane is a gate; content here is informational」 |

---

## 功能点 6: 终端卡片

### 用户故事

作为开发者, 我希望在看板上直接开启真实的终端会话, 在里面运行 `claude /prd "..."` 等 Claude Code 命令, 并实时看到输出。

### 字段定义

| 字段    | 类型                                     | 说明                                     |
| ------- | ---------------------------------------- | ---------------------------------------- |
| id      | string                                   | 运行时生成 `aXXXXX`, 非持久化            |
| kind    | `'main'` / `'sub'` / `'skill'` / `'hook'` | 决定左侧彩色条和 kind-tag 颜色           |
| status  | `'idle'` / `'run'` / `'ok'` / `'err'`   | PTY 运行状态                              |
| title   | string                                   | 卡片标题, 默认 = 绑定命令 / agent 名      |
| ptyId   | string (nullable)                        | 对应的 PTY 进程 id, null 表示未启动      |
| cwd     | string                                   | PTY 工作目录, 默认 = workspace `rootPath` |
| size    | `{ width: number, height: number }`      | 自定义尺寸, 最小 220×160, 持久化到 localStorage |

### 业务规则

1. 卡片创建时立即调用 `pty_spawn(cwd, cols, rows)` 拿到 `ptyId`, `status` 初始设为 `idle`
2. 卡片左侧 3px 彩色条颜色严格按 `kind`: main 绿 / sub 紫 / skill teal / hook amber
3. kind-tag 文字 uppercase 展示 (MAIN / SUB / SKILL / HOOK), 字号 9px
4. 卡片头高 30px 左右, 从左到右: 红黄绿三灯 (macOS 样式) + kind-tag + title (可省略) + status badge + `⋯` 菜单
5. status badge 颜色映射: idle 灰 / run amber / ok 绿 / err 红, 字号 9px
6. 订阅 `pty_output` 事件, `data` 段用 `xterm.write(data)` 写入终端
7. xterm 的 `onData` 回调调 `pty_write(ptyId, data)` 把用户输入发回
8. 收到 `pty_exit` 事件后, 根据 `code`: 0 → `ok`, 非 0 → `err`
9. 卡片销毁时 (移出 DOM / 泳道删除 / 手动 delete) 必须调 `pty_kill(ptyId)`, 否则 Rust 端资源泄漏
10. `⋯` 菜单项顺序: Open fullscreen (F) / Duplicate (⌘D) / Rename / Kill / Delete (⌫)
11. Delete 菜单: 若 `status = run` 弹二次确认「PTY is running, kill and delete?」
12. Duplicate 新建一张卡片绑定同一 `commandId`, 开独立 PTY, `cwd` 与源卡片一致
13. 双击卡片头切换 `collapsed` 状态, 折叠后只显示卡片头 (隐藏 `.term` 和 `.agent-desc`)
14. Fullscreen 弹系统模态 (focus-veil + focus-box), 900×620 或 90vw/85vh 取小, 同一 PTY 实例不重开
15. 模态内 Esc 或点遮罩关闭; 关闭后卡片回到原位置, PTY 不断
16. Shift / Cmd + 点击实现多选, 顶栏浮出批量操作条 (Kill all / Delete all)
17. 鼠标按住空白区拖框实现框选, 矩形内所有卡片加入选中集
18. 卡片右下角有一个 SVG resize handle, 鼠标拖动改 `size`, 最小 220×160, 最大 900×800
19. 窗口 resize 时按 `size.cols = Math.floor(width / 8)`, `size.rows = Math.floor(height / 20)` 调 `pty_resize`
20. PTY 启动前若收到 `pty_output` 事件, 前端要缓存 data 队列, 等 xterm 实例挂载后一次性 flush

### 数据契约

#### 调用的 Tauri command

| 操作         | command       | 参数                                   |
| ------------ | ------------- | -------------------------------------- |
| 启动 PTY     | `pty_spawn`   | `cwd: string, cols: u16, rows: u16`   |
| 写入键盘输入 | `pty_write`   | `ptyId: string, data: string`         |
| 调整尺寸     | `pty_resize`  | `ptyId: string, cols: u16, rows: u16` |
| 杀死进程     | `pty_kill`    | `ptyId: string`                        |

#### 事件

| 事件          | 方向      | payload                        |
| ------------- | --------- | ------------------------------ |
| `pty_output`  | Rust → JS | `{ ptyId: string, data: string }` |
| `pty_exit`    | Rust → JS | `{ ptyId: string, code: number }` |

### 异常场景

| 场景                            | 预期行为                                         |
| ------------------------------- | ------------------------------------------------ |
| `pty_spawn` 失败 (shell 不存在) | `status = err`, 卡片正文区显示 stderr            |
| PTY 被系统杀死                  | 收到 `pty_exit code ≠ 0`, `status = err`        |
| 卡片未挂载就收到 `pty_output`   | 缓存到队列, xterm 挂载后一次性 flush            |
| `cwd` 已被删除                  | `pty_spawn` 返回 err, 卡片显示「cwd missing」    |
| 同时发起大量 `pty_write`        | 前端按 300ms debounce 聚合后再发, 避免 IPC 拥塞 |

---

## 功能点 7: 规则抽屉

### 用户故事

作为开发者, 我希望快速查看项目里所有规则, 含优先级、触发泳道, 以及当前已知的违规情况。

### 业务规则

1. RulesDrawer 从屏幕右侧滑入, 宽 400px, 外层加背景模糊遮罩 (`backdrop-filter: blur(3px)`)
2. Drawer header 显示「Rules (N)」, N = `Workspace.rules.length`, 右侧关闭按钮 `×`
3. 规则列表按 `priority` 分组并排序 P0 → P1 → P2, 每组可折叠 (默认全展开)
4. 每条 Rule 显示: priority badge (P0 红 / P1 橙 / P2 灰) + title + 一行 desc + lanes chip 列表
5. 点击 lane chip 关闭 Drawer 并让 Board 滚动到该泳道并高亮 2s
6. 每条 Rule 右侧有 `View source` 按钮, 点击弹 md 编辑器 (脱离 Drawer, 层级更高)
7. 每条 Rule 的 priority badge 点击可就地切换 (P0 ↔ P1 ↔ P2 循环), 保存调 `update_frontmatter(path, { priority: 'P0' })`
8. Drawer 底部固定 Violations 折叠区, 徽章数 > 0 时红色显眼
9. MVP 的 Violations 数据源为 Rust 端硬编码 seed (3 条), v2 接入真实静态扫描
10. 点击 Violation 条目跳对应源文件 md 编辑器 (MVP 只打开文件, v2 定位到行)
11. Drawer 打开时禁用看板的拖拽事件, 避免双 drag context 冲突

### 数据契约

| 操作         | command              | 参数                     |
| ------------ | -------------------- | ------------------------ |
| 改 priority  | `update_frontmatter` | `path, { priority }`     |
| 读 rule 源码 | `read_file_raw`      | `path`                   |

### 异常场景

| 场景                              | 预期行为                                 |
| --------------------------------- | ---------------------------------------- |
| priority 枚举外的值               | 自动归为 P2 + 记 `scan_errors`           |
| lanes 里引用不存在的 `cmd_id`     | chip 显示 `?cmd_id?` 样式 + 警告色边框  |

---

## 功能点 8: 文档浏览器

### 用户故事

作为开发者, 我希望在工具里直接翻阅 `WORKFLOW.md` / `DECISIONS.md` / 目录 README, 不用切到 VSCode。

### 业务规则

1. 点顶栏 Docs 按钮弹模态, 尺寸 800×600 或 90vw/85vh 取小
2. 模态内左侧 1/3 宽是文件树, 按路径层级排列所有 `StaticDoc`; 右侧 2/3 宽是 markdown 渲染区
3. markdown 渲染使用 `react-markdown` + `remark-gfm`, 支持 table / task list / code fence
4. markdown 内相对链接 (`./xxx.md` 或 `../xxx.md`) 点击在本模态内切换文档, 不跳系统浏览器
5. markdown 内 workspace 绝对路径链接 (`workspace/xxx` 或 `.claude/xxx`) 解析为 workspace 内文件, 弹 md 编辑器
6. 外链 (http/https) 点击调 Tauri shell API 打开系统浏览器
7. 文件树右键菜单: 「Open in VSCode」 (调外部 shell) / 「Reveal in Finder/Explorer」
8. 顶部搜索框做全文搜索, 命中时高亮关键词, Enter 跳下一条
9. Esc 关闭模态, 但下次打开保留最后浏览的文档路径 (存 localStorage)

### 数据契约

| 操作     | command            | 参数     |
| -------- | ------------------ | -------- |
| 读内容   | `read_file_raw`    | `path`   |

### 异常场景

| 场景                | 预期行为                                      |
| ------------------- | --------------------------------------------- |
| 文件大小 > 1MB      | 只渲染前 1MB, banner 提示「File truncated」  |
| 链接目标不存在      | toast 错误 + 留在当前文档                     |
| 搜索关键词过短 (<2) | 不执行搜索, 提示「至少输入 2 个字符」        |

---

## 功能点 9: PRD 预览与编辑

### 用户故事

作为产品 / 研发, 我希望在看板里直接改 PRD 正文, 不用切到 VSCode, 保证 PRD 是真实可编辑的活文档。

### 字段定义 (编辑态)

| 字段   | 类型                                       | 必填 | 校验                  |
| ------ | ------------------------------------------ | ---- | --------------------- |
| body   | string (markdown)                          | 是   | 非空                  |
| status | `'draft'` / `'active'` / `'archived'`     | 是   | 枚举                  |

### 业务规则

1. 在 PRDSelector 下拉点某条 PRD → 打开 PRDPreview 模态, 默认只读渲染 markdown
2. PRDPreview 顶部右侧有 `Edit` 按钮, 点击切到编辑态 (左 textarea, 右实时预览双栏)
3. MVP 编辑器使用 `<textarea>` + 实时 `react-markdown` 预览, v2 换 CodeMirror 6
4. 编辑态 `⌘S` / `Ctrl+S` 调 `write_file(filePath, content)`, 成功 toast「Saved」, 失败 toast「Save failed: {reason}」
5. 编辑态 `⌘Enter` / `Ctrl+Enter` 保存并关闭模态
6. Esc 键: 无 dirty 直接关模态; 有 dirty 弹确认「Discard changes?」, 确认后关闭
7. 打开 PRD 时记录文件 mtime; 每次写回前先重读 mtime, 若与记录值不一致 (外部改过), 弹三选一对话框:「Keep mine / Use disk / Merge」, MVP 只实现前两个
8. 写回时自动把 frontmatter 的 `updatedAt` 字段改为当前 ISO 时间
9. 写回成功后重算 `tbdCount`, 顶栏 chip 和 PRDSelector 同步刷新
10. 新建 PRD 调 `create_file(docs/prds/PRD-{nextId}.md, template='prd')`, 新 id = 现有最大数字 id + 1 (首次 = PRD-001)
11. 删除 PRD 走右键 → Delete, 二次确认后 `delete_file`; 若当前激活 PRD 被删, 自动切到列表第一项 PRD
12. 模态关闭前发现 dirty 且用户选 Discard, 前端 store 回滚 `body` 到打开时的快照
13. 正文内检测到 git merge conflict 标记 (`<<<<<<<` / `=======` / `>>>>>>>`), 编辑器切换只读, 顶部横条提示「Resolve conflict first」

### 数据契约

| 操作         | command              | 参数                           |
| ------------ | -------------------- | ------------------------------ |
| 读内容       | `read_file_raw`      | `path`                         |
| 保存         | `write_file`         | `path, content`                |
| 新建         | `create_file`        | `path, template='prd'`         |
| 删除         | `delete_file`        | `path`                         |
| 改 status    | `update_frontmatter` | `path, { status }`             |

### 异常场景

| 场景                       | 预期行为                                          |
| -------------------------- | ------------------------------------------------- |
| 保存时磁盘满               | toast 错误 + 保留编辑内容不关闭                    |
| 保存时权限不足             | toast 错误 + 保留编辑内容                          |
| 保存时文件被外部删除       | 弹对话框「File was deleted, save as new?」         |
| 打开后文件被外部删除       | 编辑器顶栏横条「File missing, 'Save' will recreate」 |
| 合并 merge conflict 标记   | 只读模式, 禁止编辑, 引导先解决冲突                |

---

## 功能点 10: 任务与 Bug 管理

### 用户故事

作为开发者, 我希望在看板上看到每条命令对应的任务和缺陷, 并能直接切换 status 而无需手改 JSON / markdown。

### 字段定义

| 字段               | 类型                                                              | 说明            |
| ------------------ | ----------------------------------------------------------------- | --------------- |
| Task.status        | `'pending'` / `'in-progress'` / `'done'` / `'blocked'`           | 任务状态        |
| BugReport.status   | `'triage'` / `'reproducing'` / `'fixing'` / `'fixed'`            | 缺陷处理状态    |
| BugReport.priority | `'P0'` / `'P1'` / `'P2'`                                          | 缺陷优先级      |

### 业务规则

1. `Task` 按 `lane` 字段归到对应泳道 tasks 分区顶部, 按 `id` 字典序升序
2. `TaskRow` 单行展示: id + title + status-badge + rules-chips + deps-chips
3. 点 status-badge 弹枚举下拉, 选完调 `update_task_status(manifestPath, taskId, status)`, 写回对应 `docs/tasks/*.json`
4. 写 JSON 时必须保持原文件 key 顺序和数组顺序, 只改动目标 task 对象的 `status` 字段
5. deps-chip 点击高亮被依赖的 Task 所在 `TaskRow` (同步滚动定位)
6. rules-chip 点击打开 RulesDrawer 并滚动到该规则
7. `+ task` 按钮在泳道 tasks 分区底部, 点击弹简单 input 填 title, id 自动生成 (当前 manifest 中最大数字 + 1)
8. `BugReport` 全部汇集到 `/fix` 泳道, 按 `priority` 降序 (P0 > P1 > P2), 同 priority 按 `createdAt` 降序
9. `BugReport` 的 status 切换同样调 `update_frontmatter(path, { status })`
10. `BugReport` 左侧显示 reporter 头像占位 (姓名首字母 + 随机背景色, 悬停 tooltip 显示全名)
11. `Task` 删除: 右键 → Delete, 二次确认, 在 `docs/tasks/*.json` 里移除数组项, 其他字段顺序不变
12. `BugReport` 删除: 右键 → Delete, 二次确认, 调 `delete_file`
13. 编辑 Task title (双击 title 文字进入编辑态): Enter 保存调 `update_task_status` 的扩展版本 (同一命令多字段 patch), Esc 取消

### 数据契约

| 操作              | command                  | 参数                                                |
| ----------------- | ------------------------ | --------------------------------------------------- |
| 改 task status    | `update_task_status`     | `manifestPath: string, taskId: string, status: string` |
| 改 bug status     | `update_frontmatter`     | `path, { status }`                                  |
| 改 bug priority   | `update_frontmatter`     | `path, { priority }`                                |
| 新建 bug          | `create_file`            | `path, template='bug'`                              |
| 删除 bug          | `delete_file`            | `path`                                              |

### 异常场景

| 场景                           | 预期行为                                      |
| ------------------------------ | --------------------------------------------- |
| `tasks.json` 被外部改动        | watcher 触发 reload, UI 自动刷新              |
| 改 task status 时文件被锁      | 重试一次, 仍失败 toast 错误并回滚 UI         |
| Task `deps` 引用不存在的 id    | chip 显示 `?id?` 警告色                       |
| Bug 文件 frontmatter 缺 priority | 降级为 P2, 排序时置于同状态末尾              |

---

## 功能点 11: 回溯时间轴

### 用户故事

作为 tech lead, 我希望看到历次 `/meta-audit` 的结果, 追踪代码漂移趋势。

### 业务规则

1. RetroTimeline 固定在 Board 底部, 默认高度 28px (仅显示一行摘要: 「Last audit: 2026-04-21 · drift 2 · dead 0」)
2. 点击展开到 120px, 横向列出所有 `Retrospective` 节点 (圆点 + 日期 + 三个小徽章 drift/dead/commits)
3. 节点按日期升序从左往右排, 最新的在右
4. 点击节点弹模态展示该 retro 详情 (markdown 渲染)
5. 右侧有 `+ new retro` 按钮, 点击在 `/meta-audit` 泳道新建一张 AgentCard 并自动 auto-run (`pty_write('claude /meta-audit\n')`)
6. `drift` 数字颜色: 0 绿 / 1-3 amber / >3 红
7. `commits` 字段显示为 `git log` 风格的小胶囊, 悬停 tooltip 显示最近 3 条 commit 摘要
8. 鼠标悬停节点显示 tooltip, 含日期 + drift + dead + commits 四项摘要
9. 键盘 Left/Right 切换选中节点 (展开态下)

### 数据契约

由 `Workspace.retrospectives` 派生, 无独立接口。

### 异常场景

| 场景                     | 预期行为                                                |
| ------------------------ | ------------------------------------------------------- |
| retrospectives 为空       | 时间轴显示「No retros yet, run /meta-audit to generate」 |
| retro 文件 frontmatter 缺 date | 用文件 mtime 替代 date                            |

---

## 功能点 12: 文件系统集成

### 用户故事

作为产品 / 研发, 我希望在工具里改东西能像改 VSCode 一样立刻生效, 也能接收来自 VSCode 的改动, 双向无感同步。

### 业务规则 (写入)

1. 所有写操作只能由 Rust 端执行, 前端通过 Tauri command 调用, 禁止前端直接 fs.write
2. 所有写操作先对 `path` 做 `canonicalize`, 然后校验结果是否以 workspace `rootPath` 开头, 否则拒绝
3. `write_file` 必须原子写: 写临时文件 → `fsync` → `rename` 覆盖原文件; 禁止 truncate + write
4. `update_frontmatter` 解析 YAML 时保留键顺序、注释、空行, 仅改动目标字段; 正文 markdown 不重写
5. `update_task_status` 打开 `tasks.json` 后, 只改目标 task 对象的目标字段, 其他 key 顺序不变; 使用保顺序的 JSON 解析库 (Rust 端 `serde_json::Map` + 显式顺序)
6. 写入前把目标文件加入 watcher 白名单, 写入完成 300ms 后再移除, 避免「自己写 → 自己触发 reload」循环
7. UI 采用乐观更新: 改动即刻反映到 UI, 后台写入; 写失败 toast 错误 + 回滚 UI
8. 写失败时 toast 必须展示具体原因 (PermissionDenied / DiskFull / NotFound / Other), 不能只说 Failed

### 业务规则 (监听)

1. Watcher 基于 Rust `notify` crate, 监听整个 `rootPath` 递归, 排除 `.git` / `node_modules` / `dist` / `target`
2. 事件 300ms debounce 聚合, 同一批变化合并成一个 `workspace_changed` event
3. event payload 包含 `kind` (`commands` / `prds` / `tasks` / `agents` / `rules` / `hooks` / `bug-reports` / `retros` / `static-docs`) 和 `diff` (`added` / `modified` / `deleted` 三个文件列表)
4. 前端根据 `diff` 做增量更新, 只刷新受影响的 store 切片, 不触发全表重绘
5. 从 Rust 发事件到 DOM 可见变化必须在 500ms 内完成 (性能目标)
6. 写入自己时被白名单过滤, 不触发 reload (见写入规则 6)

### 业务规则 (冲突处理)

1. 当前 UI 有 dirty (编辑器) 的文件被外部修改时, 弹冲突对话框「Keep mine / Use disk」(MVP 二选一)
2. 当前 UI 无 dirty 的文件被外部修改时, 静默 reload UI
3. 当前编辑的文件被外部删除时, toast「File deleted externally」, 编辑器切「Save as new」模式 (Save 会重新创建)
4. 文件出现 git merge conflict 标记时, 编辑器切只读 + banner「Resolve conflict first」
5. Watcher 启动失败时, 顶栏显示红色徽章「Watch offline」, 工具仍可用但需手动点 Reset 刷新

### 数据契约

#### 写入类 command

| 命令                   | 参数                                         | 返回                  |
| ---------------------- | -------------------------------------------- | --------------------- |
| `read_file_raw`        | `path: string`                               | `Result<string>`      |
| `write_file`           | `path, content`                              | `Result<()>`          |
| `create_file`          | `path, template?: string`                    | `Result<()>`          |
| `delete_file`          | `path`                                       | `Result<()>`          |
| `rename_file`          | `from, to`                                   | `Result<()>`          |
| `update_frontmatter`   | `path, patch: serde_json::Value`             | `Result<()>`          |
| `update_task_status`   | `manifestPath, taskId, status`               | `Result<()>`          |

#### 监听类 command / event

| 名称                 | 类型     | 参数 / payload                                                                 |
| -------------------- | -------- | ------------------------------------------------------------------------------ |
| `start_watcher`      | command  | `path: string`                                                                 |
| `stop_watcher`       | command  | -                                                                              |
| `workspace_changed`  | event    | `{ kind: string, diff: { added: string[], modified: string[], deleted: string[] } }` |

### 异常场景

| 场景                         | 预期行为                                                  |
| ---------------------------- | --------------------------------------------------------- |
| Watcher 启动失败             | 顶栏红徽章「Watch offline」, 禁用实时刷新, 手动 Reset 可用 |
| 外部同时多文件改动           | 300ms debounce 聚合, 一次性刷新                          |
| 前端收到未识别的 `kind`      | 忽略该事件 + console warn                                 |
| 前端连续 IPC 失败 > 3 次     | 弹系统级 banner「Backend unresponsive, restart suggested」 |

---

## 功能点 13: 工具面板

### 用户故事

作为开发者, 我希望能调整看板密度和辅助泳道显隐, 以及在需要时一键 Reset。

### 业务规则

1. Tweaks 面板固定在右下角 14px, 宽 260px, 默认折叠为一个小圆钮 (24×24, 绿色发光点)
2. 点小圆钮展开为面板, 顶部标题「TWEAKS」, 面板关闭按钮 `×`
3. 面板包含三个分组, 顺序固定: Density / Helper lanes / Theme / Reset
4. Density 段控件 (comfortable / compact 互斥), 选中态绿色, 改动后立即切换所有 lane-body 的 padding / font-size
5. Helper lanes (Show / Hide 互斥), 隐藏时 Board 只渲染主 pipeline 泳道
6. Theme (Dark / Light 互斥), Light 标「v2」灰化禁用, MVP 只有 Dark
7. 所有面板改动都写入 localStorage, key 形如 `wfkanban.tweaks.{field}`, 下次启动保留
8. Reset workflow 按钮点击弹二次确认「Clear all UI state and rescan?」, 确认后清 localStorage 并调 `scan_workspace`
9. 面板任何改动立即生效, 无 Apply 按钮

### 数据契约

纯本地, 无后端接口。

### 异常场景

| 场景               | 预期行为                                       |
| ------------------ | ---------------------------------------------- |
| localStorage 被禁  | 改动仍生效本次会话, 下次启动回默认             |
| Reset 期间 scan 失败 | 保留旧 Workspace 数据 + toast「Reset failed, keeping old state」 |

---

## 验收清单

> 分 6 个里程碑 (M1 ~ M6), 总计 17 天; 每个里程碑有独立验收点。

### 里程碑 1 · 壳与扫描 (M1, 3d)

- [ ] Tauri 项目初始化, 启动弹窗口
- [ ] `empty` 状态 UI + 文件夹选择弹窗
- [ ] `validate_workspace` + `scan_workspace` 跑通
- [ ] `scanning` 状态能看到进度条
- [ ] `invalid` 状态显示缺失项
- [ ] **验收**: 选中 `claude-code-workflow` 仓库 → 所有命令被扫出来, 能在 console 打印完整 `Workspace` 结构

### 里程碑 2 · 看板渲染 (M2, 3d)

- [ ] TopBar / PipelineStrip / Board / Lane / AgentCard 基础 UI (不含终端)
- [ ] 数据从 Zustand store 驱动
- [ ] PRDSelector / RulesDrawer / DocsViewer 开关交互可用
- [ ] 泳道间 Connector 箭头渲染正确
- [ ] **验收**: 与设计稿 `Workflow Kanban.html` 做像素级对比, 相似度 ≥ 95%

### 里程碑 2.5 · 写入能力 (M2.5, 2d)

- [ ] Rust 端实现全部写命令 (`write_file` / `create_file` / `update_frontmatter` / `update_task_status` / `delete_file` / `rename_file`)
- [ ] 原子写 (tmp + rename + fsync) 到位
- [ ] Path 越权校验到位, 越权测试用例能被正确拒绝
- [ ] 内嵌 Markdown 编辑器 (textarea + 实时预览) 可用
- [ ] PRD 正文 / task status / bug status 的 UI → 写回链路跑通
- [ ] Watcher 白名单去重能力验证 (写自己改动不触发自己 reload)
- [ ] 外部修改冲突对话框 (Keep mine / Use disk)
- [ ] **验收**: 在桌面端改 PRD 正文, VSCode 能看到改动; 反之 VSCode 改, 桌面端 UI 在 500ms 内自动刷新

### 里程碑 3 · 终端接入 (M3, 3d)

- [ ] xterm.js 集成到 AgentCard
- [ ] Rust 侧 `pty_spawn` / `pty_write` / `pty_output` / `pty_exit` 链路全通
- [ ] 每张卡独立 PTY, 能正常跑 `ls` / `npm -v` / `claude --version`
- [ ] 卡片销毁时正确 `pty_kill`, 无进程泄漏
- [ ] **验收**: 在卡片里运行 `claude /prd "做一个登录页"` 能正常交互, 输入输出不丢

### 里程碑 4 · 实时性 (M4, 2d)

- [ ] `notify` watcher 启动 + 事件推送
- [ ] 新增 / 修改 / 删除 `.claude/commands/*.md` 看板实时变化
- [ ] PRD 正文改动 → Preview 自动刷新
- [ ] Tasks JSON 改 status → 对应行颜色实时变
- [ ] **验收**: 外部编辑器改文件, 桌面端 UI 在 500ms 内更新

### 里程碑 5 · 交互完善 (M5, 2d)

- [ ] 终端卡片跨泳道拖拽
- [ ] 多选框选 + 批量操作 (Kill all / Delete all)
- [ ] RetroTimeline 展开 / 收起 + 节点点击弹详情
- [ ] Bug reports 在 `/fix` 泳道正确列出, 状态切换可用
- [ ] 全屏终端模态
- [ ] **验收**: 设计稿里所有交互都能跑

### 里程碑 6 · 打磨 (M6, 2d)

- [ ] 错误处理 (PTY 崩 / 文件读失败 / 权限问题) 全覆盖
- [ ] Recent workspaces 记忆 (`get_recent_workspaces`)
- [ ] 键盘快捷键: ⌘O 打开文件夹 / ⌘W 关闭 workspace
- [ ] 三平台打包产物 (macOS `.dmg` / Windows `.msi` / Linux `.AppImage`)
- [ ] **验收**: 可分发安装包, 三端启动正常

### 非功能验收

- [ ] **性能**: 1000 文件的 workspace 冷扫描 < 2s; 文件变化到 UI 更新 < 500ms
- [ ] **内存**: 空闲 (含 10 个 PTY) < 200MB
- [ ] **跨平台**: macOS 13+ / Windows 11 / Ubuntu 22.04 均能安装运行
- [ ] **安全**: 所有写操作走 Rust 端 `canonicalize` + 根目录前缀校验; PTY 不继承 app 的 env (显式传 shell env)
- [ ] **数据完整性**: 所有写入走原子操作, writer 崩溃不留半写文件
- [ ] **可访问性**: 所有按钮可键盘聚焦, Tab 顺序合理; 终端遵守 xterm.js 默认 a11y

---

## 不做的事 (v1 Out of scope)

> 明确排除以免范围蔓延; 标 v2 的可能进下一个版本, 标「永不」的是方向性决策。

- 命令面板 `⌘K` (v2)
- 可追溯性悬停连线 (v2)
- Rule 违规的真实静态代码扫描 (v2, 需要 AST 解析)
- 多 workspace 并列标签页 (v2)
- 浅色主题 (v2)
- 应用级撤销 `⌘Z` (v2, MVP 依赖 git 做撤销)
- git 内嵌 diff viewer (v2)
- 协作编辑 / 云同步 (永不做, 本工具是本地单机工具)

---

## 附录 A · Workspace 数据模型 (TypeScript)

```ts
// src/workspace/types.ts

export type WorkspaceState = 'empty' | 'scanning' | 'invalid' | 'ready';

export interface Workspace {
  rootPath: string;
  commands: Command[];
  agents: SubAgent[];
  rules: Rule[];
  hooks: Hook[];
  prds: PRD[];
  tasks: TaskManifest[];
  bugReports: BugReport[];
  retrospectives: Retrospective[];
  staticDocs: StaticDoc[];
  scanErrors: ScanError[];
}

export interface Command {
  id: string;                  // 文件名去掉 .md
  cmd: string;                 // 斜杠命令名, 默认 = id
  filePath: string;            // 相对 rootPath
  idx: number | null;
  title: string;
  desc: string;
  inputs: string[];            // artifact 文件名
  outputs: string[];
  gate: string | null;         // 下游 gate 命令 id
  helper: boolean;
  body: string;                // 正文
}

export interface SubAgent {
  id: string;
  name: string;
  desc: string;
  filePath: string;
  boundCommands: string[];     // frontmatter `bindTo`
}

export interface Rule {
  id: string;
  priority: 'P0' | 'P1' | 'P2';
  title: string;
  desc: string;
  filePath: string;
  lanes: string[];
}

export interface Hook {
  id: string;
  name: string;
  trigger: 'pre' | 'post' | 'on-change';
  boundCommands: string[];
  filePath: string;
}

export interface PRD {
  id: string;                  // 如 PRD-042
  title: string;
  status: 'draft' | 'active' | 'archived';
  author: string;
  updatedAt: string;
  tbdCount: number;            // 正文 `[TBD]` 出现次数
  summary: string;
  anchors: { tasks: number; code: number; tests: number };
  filePath: string;
  body: string;
}

export interface TaskManifest {
  prdRef: string;
  filePath: string;
  tasks: Task[];
}

export interface Task {
  id: string;                  // T001 等
  title: string;
  status: 'pending' | 'in-progress' | 'done' | 'blocked';
  prdRef: string;
  rules: string[];
  deps: string[];
  lane: string;                // 默认 'code'
}

export interface BugReport {
  id: string;                  // BUG-17
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  status: 'triage' | 'reproducing' | 'fixing' | 'fixed';
  reporter: string;
  createdAt: string;
  filePath: string;
}

export interface Retrospective {
  id: string;
  date: string;
  drift: number;
  dead: number;
  commits: number;
  filePath: string;
}

export interface StaticDoc {
  id: string;
  file: string;                // WORKFLOW.md 等
  desc: string;
  filePath: string;
  body: string;
}

export interface ScanError {
  filePath: string;
  reason: string;
}

export interface AgentCardState {
  id: string;                  // 运行时生成
  kind: 'main' | 'sub' | 'skill' | 'hook';
  commandId: string;
  laneId: string;
  title: string;
  status: 'idle' | 'run' | 'ok' | 'err';
  ptyId: string | null;
}
```

---

## 附录 B · 技术栈与目录结构

| 层         | 选型                                                  | 理由                                     |
| ---------- | ----------------------------------------------------- | ---------------------------------------- |
| 壳         | **Tauri 2.x**                                         | 体积小, Rust 后端, 内置 fs/shell/watcher |
| 前端       | **React 18 + Vite + TypeScript**                      | 与现有设计稿一致                         |
| 样式       | **CSS Modules + CSS 变量**                            | 设计稿全部用 CSS 变量定义主题            |
| 终端渲染   | **xterm.js 5.x**                                      | 行业标准                                 |
| PTY        | **`tauri-plugin-shell` + Rust 端 `portable-pty`**     | 跨平台真 PTY                             |
| 文件监听   | **Rust 端 `notify` crate**                            | 通过 Tauri event 推到前端                |
| 状态       | **Zustand**                                           | 轻量, 不引入 Redux                        |
| Markdown   | **`react-markdown` + `remark-gfm`**                   | 渲染 PRD / 文档                          |
| frontmatter | **前端 `gray-matter` + Rust 端 `serde_yaml`**         | 解析 YAML                                |

**禁止**: Electron / Next.js / styled-components / Redux / MobX。

```
workflow-kanban/
├─ src-tauri/                    # Rust 后端
│  ├─ src/
│  │  ├─ main.rs
│  │  ├─ scanner.rs              # 扫描逻辑
│  │  ├─ watcher.rs              # 文件变化监听
│  │  └─ pty.rs                  # PTY 进程管理
│  └─ tauri.conf.json
├─ src/                          # React 前端
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ WorkspaceShell.tsx      # 4 种 state 壳
│  │  └─ states/                 # Empty / Scanning / Invalid / Ready
│  ├─ board/
│  │  ├─ Board.tsx
│  │  ├─ Lane.tsx
│  │  ├─ AgentCard.tsx
│  │  ├─ TaskRow.tsx
│  │  ├─ Connector.tsx
│  │  └─ PipelineStrip.tsx
│  ├─ topbar/
│  │  ├─ TopBar.tsx
│  │  ├─ PRDSelector.tsx
│  │  ├─ RulesButton.tsx
│  │  └─ DocsButton.tsx
│  ├─ drawers/
│  │  ├─ RulesDrawer.tsx
│  │  ├─ DocsViewer.tsx
│  │  └─ PRDPreview.tsx
│  ├─ retros/
│  │  └─ RetroTimeline.tsx
│  ├─ terminal/
│  │  ├─ Terminal.tsx            # xterm.js 封装
│  │  └─ useTerminal.ts
│  ├─ workspace/
│  │  ├─ useWorkspace.ts
│  │  └─ types.ts
│  ├─ store/
│  │  └─ workspaceStore.ts       # Zustand
│  └─ styles/
│     └─ theme.css               # CSS 变量
└─ package.json
```

---

## 附录 C · Tauri command 签名

```rust
// 工作区
#[tauri::command] async fn pick_workspace_folder() -> Result<String, String>;
#[tauri::command] async fn validate_workspace(path: String) -> ValidateResult;
#[tauri::command] async fn scan_workspace(path: String) -> Workspace;
#[tauri::command] async fn get_recent_workspaces() -> Vec<String>;

// 监听
#[tauri::command] async fn start_watcher(path: String) -> Result<(), String>;
#[tauri::command] async fn stop_watcher() -> Result<(), String>;

// PTY
#[tauri::command] async fn pty_spawn(cwd: String, cols: u16, rows: u16) -> String;
#[tauri::command] async fn pty_write(pty_id: String, data: String);
#[tauri::command] async fn pty_resize(pty_id: String, cols: u16, rows: u16);
#[tauri::command] async fn pty_kill(pty_id: String);

// 读写
#[tauri::command] async fn read_file_raw(path: String) -> Result<String, String>;
#[tauri::command] async fn write_file(path: String, content: String) -> Result<(), String>;
#[tauri::command] async fn create_file(path: String, template_id: Option<String>) -> Result<(), String>;
#[tauri::command] async fn delete_file(path: String) -> Result<(), String>;
#[tauri::command] async fn rename_file(from: String, to: String) -> Result<(), String>;
#[tauri::command] async fn update_frontmatter(path: String, patch: serde_json::Value) -> Result<(), String>;
#[tauri::command] async fn update_task_status(manifest_path: String, task_id: String, status: String) -> Result<(), String>;
```

**事件** (Rust → JS):

```
scan_progress      { currentFile: string, progress: number }
workspace_changed  { kind: string, diff: { added, modified, deleted } }
pty_output         { ptyId: string, data: string }
pty_exit           { ptyId: string, code: number }
```

---

## 附录 D · frontmatter 最小 schema

**`.claude/commands/*.md`**:

```yaml
---
id: prd                # 必填, 唯一
idx: 1                 # 主 pipeline 排序; helper 则省略
title: Requirements    # 必填
desc: one-liner        # 必填
inputs: []
outputs: [PRD.md]
gate: prd-check        # 可选
helper: false          # 默认 false
---
```

**`.claude/agents/*.md`**:

```yaml
---
id: test-writer
name: Test Writer
desc: Writes vitest tests from @rules
bindTo: [test]         # 支持多个命令绑定
---
```

**`.claude/rules/*.md`**:

```yaml
---
id: no-hardcode
priority: P0           # P0 / P1 / P2
title: 禁止硬编码
lanes: [code, review]  # 在哪些命令里触发
---
```

**`.claude/hooks/*.md`**:

```yaml
---
id: check-hardcode
name: Check Hardcode
trigger: pre           # pre / post / on-change
boundCommands: [code]
---
```

**`docs/prds/*.md`**:

```yaml
---
id: PRD-042
status: active         # draft / active / archived
author: Tommy
updatedAt: 2026-04-24T10:00:00Z
---
```

**`docs/tasks/*.json`**:

```json
{
  "prdRef": "PRD-042",
  "tasks": [
    {
      "id": "T001",
      "title": "userApi",
      "status": "done",
      "rules": ["no-hardcode"],
      "deps": [],
      "lane": "code"
    }
  ]
}
```

**`docs/bug-reports/*.md`**:

```yaml
---
id: BUG-114
title: race in useUserStore
priority: P0
status: fixing
reporter: qa
createdAt: 2026-04-22T08:30:00Z
---
```

**`docs/retrospectives/*.md`**:

```yaml
---
id: 2026-04-21-meta-audit
date: 2026-04-21
drift: 2
dead: 0
commits: 17
---
```

---

## 变更记录

| 日期       | 变更内容                                                                                    | 变更人 |
| ---------- | ------------------------------------------------------------------------------------------- | ------ |
| 2026-04-24 | 初版: 从 Claude Design 输出 (`PRD.md` + `Workflow Kanban.html`) 重组, 按 `docs/prds/_template.md` 格式拆分为 13 个功能点并逐条标明可测业务规则 | Tommy  |
| 2026-04-27 | 设计稿归档到 `docs/designs/claude-workflow-kanban/`, 路径全部改为仓库相对路径 | Tommy  |

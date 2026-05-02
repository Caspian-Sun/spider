# Claude Code Workflow 看板应用 PRD

> 写 PRD 的核心原则: **小标题即锚点**, 后续 `@prd docs/prds/claude-workflow-kanban.md#<锚点>` 全靠这些标题定位。

## 元信息

| 项 | 值 |
|----|----|
| 模块代号 | `claude-workflow-kanban` |
| 负责人 | [待填写] |
| 创建日期 | 2026-05-02 |
| 最后更新 | 2026-05-02 |
| 状态 | draft |

## 背景与目标

Claude Code Workflow 是一款 Tauri 2.x 桌面应用，将 `.claude/commands/` 定义的 AI Agent 工作流可视化为 DAG 看板。用户选择一个工程目录（workspace）后，应用自动扫描并呈现 8 个流水线步骤（prd → plan → code → test → review → build → deploy → release）和 2 个辅助步骤（fix、meta-audit），每个步骤对应一条泳道，泳道内的 Agent 卡片承载真实的 PTY 终端会话。目标是让开发者在一个界面内管理整个 AI 辅助开发流程，不再在多个终端窗口之间切换。

## 名词解释

| 术语 | 含义 |
|------|------|
| Workspace | 用户选择的本地工程目录，必须含 `.claude/` 子目录 |
| Lane（泳道） | 对应一个 `/command` 的看板列，宽 360px |
| Agent Card（卡片） | 泳道内的任务单元，持有一个 PTY 会话 |
| Kind | 卡片类型：main（主流程）/ sub（子代理）/ skill（技能插件）/ hook（钩子） |
| Gate | 两个泳道间的质量门禁，如 prd-check / plan-check |
| Shell Panel | 全局底部终端抽屉，独立于卡片终端 |
| Retro Timeline | 底部 28px 状态栏，展示 /meta-audit 历史 |
| drift | /meta-audit 发现的 PRD 与代码不一致条数 |
| activeView | Activity Bar 当前激活的视图：board / prd / tasks / bugs / docs / settings |

## 设计稿

| 项 | 值 |
|----|----|
| 来源类型 | file |
| 本地文件 | `docs/designs/claude-workflow-kanban/Workflow Kanban.html` |
| JSX 原型 | `docs/designs/claude-workflow-kanban/wf-app.jsx` |

### 功能点与设计帧映射

| 功能点（PRD 锚点） | 设计稿引用 |
|-------------------|-----------|
| #工作区接入 | `wf-app.jsx` 工作区状态机 |
| #Activity-Bar | `.activity-bar` CSS + `wf-app.jsx` ActivityBar 组件 |
| #顶部操作栏 | `.topbar` CSS + `wf-app.jsx` TopBar 组件 |
| #流水线步骤条 | `.pipeline` CSS + `wf-app.jsx` PipelineStrip 组件 |
| #看板主区域 | `.board` CSS + `.board-inner` |
| #泳道 | `.lane` `.lane-head` `.lane-body` `.lane-foot` CSS |
| #泳道连接箭头 | `.connector` CSS |
| #Agent-卡片 | `.agent` `.agent-head` CSS |
| #卡片内嵌终端 | `.term` `.term-output` `.term-input-row` CSS |
| #底部时间轴 | `wf-app.jsx` RetroTimeline 组件 |
| #全局-Shell-面板 | `.shell-panel` CSS |
| #通知抽屉 | `.notif-drawer` CSS |
| #命令面板 | `.cmdk-veil` `.cmdk` CSS |
| #卡片详情焦点视图 | `.focus-veil` `.focus-box` CSS |
| #规则抽屉 | `wf-app.jsx` RulesDrawer 组件 |
| #PRD-选择器 | `wf-app.jsx` PRDSelector 组件 |
| #文档浏览器 | `wf-app.jsx` DocsPanel 组件 |
| #右键菜单 | `.ctx` CSS |
| #微调面板 | `.tweaks` CSS |

---

## 功能点 1: 工作区接入

### 用户故事

作为开发者，我希望应用启动后能快速选择或恢复上次的工程目录，以便立即开始工作而不需要每次重新配置。

### 业务规则

1. 应用启动时读取持久化的最近工作区记录（最多 5 条），若记录不为空则自动打开最近一个并进入 `scanning` 状态
2. 应用启动时读取记录为空，进入 `empty` 状态，显示欢迎页
3. `empty` 状态显示：应用名称 + 「选择工作区」主按钮 + 最近工作区列表（最多 5 条，带路径和移除按钮）
4. 选择目录后进入 `scanning` 状态，Rust 端扫描目录结构，扫描过程中显示进度提示
5. 扫描完成且 `.claude/` 目录存在，进入 `ready` 状态，渲染完整看板
6. 扫描完成但目录不含 `.claude/`，进入 `invalid` 状态，提示「该目录不是有效的 Claude 工程」
7. `ready` 状态下点击「Close workspace」返回 `empty` 状态，保留 `recentWorkspaces` 记录
8. 最近工作区记录中路径已失效（目录不存在），点击时显示错误提示并从列表移除
9. 扫描范围：`.claude/commands/*.md`（泳道来源）、`docs/prds/*.md`、`docs/tasks/*.json`、`docs/bug-reports/*.md`、`docs/retrospectives/*.md`
10. 解析失败的单个文件不阻断整个扫描，错误记入 `scanErrors` 数组，TopBar 显示小徽章「N 个文件解析失败」

### 状态机

```
empty ──[选择目录]──▶ scanning ──[扫描完成，有 .claude/]──▶ ready
  ▲                                    │                        │
  │                          [.claude/ 缺失]                    │
  │                                    ▼                        │
  │                                 invalid              [Close workspace]
  └────────────────────────────────────────────────────────────┘
```

### Tauri IPC

| 操作 | Command | 说明 |
|------|---------|------|
| 打开目录选择对话框 | `pick_workspace_folder` | 返回用户选择的路径或 null |
| 扫描工作区 | `scan_workspace` | 返回 WorkspaceScanResult |
| 读取最近记录 | `get_recent_workspaces` | 返回 string[] |
| 保存最近记录 | `save_recent_workspaces` | 接受 string[] |

---

## 功能点 2: Activity Bar

### 用户故事

作为用户，我希望通过左侧固定的导航栏快速切换不同视图，以便在看板、PRD、任务、Bug、文档之间自由跳转。

### 业务规则

1. Activity Bar 固定在屏幕最左侧，宽 48px，高度占满全屏，不随内容滚动，z-index: 95
2. 顶部显示 λ logo（绿色，18px mono 字体，32×32px 区域），logo 下方依次排列 6 个导航按钮：看板（board）/ 需求（prd）/ 任务（tasks）/ 缺陷（bugs）/ 文档（docs）/ 设置（settings）
3. 激活按钮左侧显示 2px 绿色指示条（`::before` 伪元素，left: -10px），文字变为 `var(--text)`
4. 未激活按钮颜色为 `var(--text-3)`，hover 时变为 `var(--text)` 并显示 `var(--bg-2)` 背景，圆角 4px
5. 缺陷（bugs）图标显示当前未修复 bug 数量的红色数字徽章（右上角 14×14px 圆形）
6. 设置（settings）按钮固定在 Activity Bar 底部（`.ab-spacer` 弹性间隔），其余按钮在顶部
7. 工作区未加载（empty / invalid 状态）时，除 settings 外其他按钮禁用，徽章不显示
8. 切换 activeView 时，主内容区域整体替换，TopBar / PipelineStrip / RetroTimeline 保持挂载不重渲

---

## 功能点 3: 顶部操作栏

### 用户故事

作为用户，我希望顶栏始终显示当前工作区状态并提供快捷操作，以便一眼掌握进度并快速触发常用功能。

### 业务规则

1. TopBar 固定高度 46px，吸顶，z-index: 40，不随看板横向滚动
2. padding-left 64px（Activity Bar 48px + 留白 16px），为侧边栏留出空间
3. 左区：λ logo（20×20px，绿→青 135° 渐变，border-radius 4px，内显示「λ」黑色加粗）+ 品牌文字「CLAUDE CODE WORKFLOW」（mono 加粗 12.5px）+ 路径 chip + PRD 选择器
4. 路径 chip 显示 rootPath 最后两段，格式「…/parent/dir」，悬停 tooltip 显示完整路径，font-family mono
5. 中区统计 chip 列表（mono 11px）：cmds 数 / tasks 数 / 文件数 / 测试数 / running 数
6. 右区从左到右：Rules 按钮（含违规数红色徽章）→ Docs 按钮 → 🔔 铃铛（含未读数红色徽章）→ ⌘K 按钮 → >\_Shell 按钮 → Reset 按钮 → **Run pipeline** 绿色主按钮
7. Run pipeline：`background: rgba(110,231,127,0.08); border-color: rgba(110,231,127,0.3); color: var(--green)`，触发完整流水线执行前弹确认框
8. Rules 按钮违规数为 0 时不显示徽章；🔔 未读数为 0 时不显示徽章
9. Reset 点击：关闭工作区，返回 `empty` 状态，保留最近记录
10. 工作区未加载时：路径 chip 隐藏，中区 + 右区操作按钮全部禁用

---

## 功能点 4: 流水线步骤条

### 用户故事

作为用户，我希望在顶栏下方看到当前工作流的全局进度，以便快速定位当前所在步骤并跳转。

### 业务规则

1. Pipeline Strip 固定高度 38px，位于 TopBar 正下方，padding-left 64px 与 TopBar 对齐
2. 步骤顺序固定：1 /prd → 2 /plan → 3 /code → 4 /test → 5 /review → 6 /build → 7 /deploy → 8 /release
3. 每个步骤显示：数字编号方块（16×16px，border-radius 3px）+ 命令名，整体 border-radius 4px 的圆角按钮
4. 激活步骤：绿色边框（rgba(110,231,127,0.4)）+ 绿色背景（rgba(110,231,127,0.06)）+ 数字方块绿底黑字
5. 已完成步骤：数字方块青色底（`var(--teal)`）黑字加粗
6. 步骤间箭头（→）用 `var(--line-2)` 颜色显示，不可点击
7. prd→plan 之间、plan→code 之间各有一个 GATE 标记（琥珀色虚线边框，显示门禁命令名如「◆ PRD-CHECK」）
8. 步骤条右侧显示「helpers:」标签 + /fix 链接 + /meta-audit 链接（无编号方块，样式更轻）
9. 点击步骤将对应泳道滚动到视口内并设为 activeStep
10. Layout 切换为 generic（通用看板）时，Pipeline Strip 整体隐藏

---

## 功能点 5: 看板主区域

### 用户故事

作为用户，我希望看板以合理的布局占满剩余屏幕空间，并能横向滚动查看所有泳道。

### 业务规则

1. Board 使用 `position: absolute; inset: 84px 0 28px 48px`（top = TopBar 46px + Pipeline 38px = 84px；bottom = RetroTimeline 28px；left = Activity Bar 48px）
2. 横向滚动（overflow-x: auto），纵向不滚动（overflow-y: hidden）
3. 背景叠加两个径向渐变：左上角绿色光晕（`radial-gradient(1400px 500px at 10% 0%, rgba(110,231,127,0.04), transparent 60%)`）+ 右下角蓝色光晕（`radial-gradient(1200px 500px at 90% 100%, rgba(122,162,255,0.04), transparent 60%)`）
4. Shell Panel 打开时，bottom 从 28px 切换为 268px（Shell 240px + RetroTimeline 28px），过渡动画 `transition: bottom 200ms ease`
5. 横向滚动条高度 10px，拇指色 `var(--line)`，hover 时 `var(--line-2)`
6. 内部 `.board-inner` 为 flex row，高度 100%，`align-items: stretch`，`min-width: max-content`

---

## 功能点 6: 泳道

### 用户故事

作为用户，我希望每个流水线步骤有一条独立泳道，清晰展示该步骤下的所有 Agent，以便管理工作流。

### 业务规则

1. 标准泳道 flex-basis 360px，Helper 泳道 flex-basis 320px（虚线边框 `border-style: dashed`）
2. 泳道头部（`.lane-head`）背景 `var(--bg-2)`，底部边框分隔，包含两行：
   - 第一行：步骤编号方块（22×22px）+ 命令名（`/` 号绿色，13px 加粗）+ 卡片计数气泡 + 弹性空白 + GATE 徽章（有门禁时显示，琥珀色）
   - 第二行：描述文字（11px，`var(--text-3)`）+ 产出物标签（in=蓝色；out=绿色）
3. 产出物标签（`.artifact-tag`）：mono 9.5px，圆角 10px；in 类型蓝色边框蓝色文字；out 类型绿色边框绿色文字
4. 泳道主体（`.lane-body`）纵向滚动，padding 12px，gap 10px
5. 分区标签（`.lane-section-label`）：UPPER_CASE，前有 4×4px 圆点，颜色：MAIN=绿、SUB-AGENTS=紫、SKILLS=青、LOGS=琥珀
6. 泳道主体为拖拽放置目标，drag-over 时显示绿色内阴影：`box-shadow: inset 0 0 0 1px rgba(110,231,127,0.25)`
7. 泳道底部（`.lane-foot`）有「+ add sub-agent」虚线按钮，hover 时文字变绿、边框绿色
8. 泳道无卡片时，主体显示「空泳道」提示文字，居中，`var(--text-3)`

---

## 功能点 7: 泳道连接箭头

### 用户故事

作为用户，我希望相邻泳道间有视觉连接并显示流转产出物，以便理解步骤间的依赖关系。

### 业务规则

1. 相邻泳道间有 52px 宽的 Connector 区域，内含 SVG 水平箭头和产出物标签
2. 产出物标签（`.arrow-label`）：mono 9.5px，圆角 10px，显示上一步骤的 output 文件名（如 `PRD.md →`），绿色 tag 前缀
3. Gate Connector：产出物标签改为琥珀色边框/背景，前缀「◆ 」，显示门禁命令名
4. Connector 区域不参与鼠标事件（`pointer-events: none`），仅标签本身可交互

---

## 功能点 8: Agent 卡片

### 用户故事

作为用户，我希望每张 Agent 卡片清晰显示类型、状态和终端输出，以便实时掌握每个 Agent 的运行情况。

### 业务规则

1. 卡片左侧 3px 实色边框区分 kind：main=`var(--green)`、sub=`var(--purple)`、skill=`var(--teal)`、hook=`var(--amber)`
2. 卡片头部（`.agent-head`）背景 `var(--bg-3)`，`cursor: grab`，包含：macOS 交通灯（红/黄/绿各 9px 圆）+ 标题（mono 11.5px）+ kind 标签 + 状态徽章 + 菜单按钮（···）
3. Kind 标签样式（均大写）：main=绿色背景、sub=紫色背景、skill=青色背景、hook=琥珀色背景
4. 状态徽章值及颜色（均大写）：idle=灰色 / run=琥珀色 / ok=绿色 / err=红色 / wait=蓝色
5. run 状态时，状态徽章应有闪烁/脉冲动画
6. 卡片 idle 状态时，终端区域显示「点击运行 /<cmd>」占位提示，居中，可点击触发 spawn
7. 交通灯功能：红=Kill Agent / 黄=Pause 或 Resume / 绿=Restart
8. 点击卡片（非交通灯/按钮区域）时打开焦点视图（#卡片详情焦点视图）
9. 右键卡片弹出右键菜单（#右键菜单）
10. 卡片可在同一泳道内拖拽排序，拖拽中 opacity 0.45
11. 选中（activeCard）：`border-color: rgba(110,231,127,0.5); box-shadow: 0 0 0 1px rgba(110,231,127,0.3), 0 6px 22px rgba(0,0,0,0.45)`
12. 折叠状态（collapsed）：隐藏描述文字和终端区域，只显示头部
13. Pinned 卡片不可被拖拽，头部显示 🔒 图标

---

## 功能点 9: 卡片内嵌终端

### 用户故事

作为用户，我希望每张 Agent 卡片内嵌真实的 PTY 终端，以便看到 Agent 运行输出并可交互输入。

### 业务规则

1. 终端背景纯黑（#000），字体 JetBrains Mono 11.5px，行高 1.5
2. 输出区域支持 ANSI 颜色分类：green=命令提示符 / blue=路径 / red=错误 / amber=警告 / teal=成功 / purple=特殊标记 / text-3=淡出信息
3. 输出区最大高度 220px（short 卡片 110px），超出时纵向滚动，滚动条宽 6px
4. 底部输入行：绿色 prompt（`▌`）+ 蓝色路径 + 透明输入框，光标颜色绿色
5. 用户在终端输入时，内容通过 `pty_write` 传给 Rust PTY 进程
6. Rust PTY 输出通过 `pty_output` event 推送，前端监听后写入 xterm 实例
7. 终端尺寸变化时调用 `pty_resize` + xterm addon-fit 自动适配
8. 卡片关闭/删除时调用 `pty_kill` 释放进程
9. 同一 cardId 重复 spawn 时，先 kill 旧进程再起新进程

### Tauri IPC

| 操作 | Command / Event | 说明 |
|------|----------------|------|
| 启动 PTY | `pty_spawn` | 入参：cardId, cmd, cwd |
| 写入输入 | `pty_write` | 入参：sessionId, data |
| 调整尺寸 | `pty_resize` | 入参：sessionId, cols, rows |
| 终止进程 | `pty_kill` | 入参：sessionId |
| 接收输出 | Event `pty_output` | Payload: { sessionId, data: string } |

---

## 功能点 10: 底部时间轴

### 用户故事

作为用户，我希望在屏幕底部看到 /meta-audit 历史和工作区状态，以便了解代码健康度趋势。

### 业务规则

1. Retro Timeline 固定在屏幕最底部，默认高度 28px；点击后展开至 120px 显示完整历史
2. 展开/收起有高度过渡动画（0.15s ease）
3. 收起状态左侧显示：ws 状态指示灯（Ready=绿实心 / Empty=灰空心 / Scanning=琥珀闪烁 / Invalid=红实心）+ 最近一次 drift 数
4. 收起状态右侧显示：Shell Panel 终端 tab 行（tab 可点击切换，× 可关闭）
5. 展开状态显示历史列表：每项显示日期 + drift 数 + dead 引用数 + commits 数
6. drift 颜色：0 = `var(--green)` / 1-2 = `var(--amber)` / 3+ = `var(--red)`
7. 展开时，键盘左右方向键在历史记录间导航，高亮当前选中时间点

---

## 功能点 11: 全局 Shell 面板

### 用户故事

作为用户，我希望有一个全局底部终端面板，以便在不离开看板的情况下执行任意 shell 命令。

### 业务规则

1. Shell Panel 固定定位：`left: 48px; right: 0; bottom: 28px; height: 240px`
2. 默认隐藏（`transform: translateY(100%)`），⌘`（反引号）切换显示/隐藏，TopBar >\_Shell 按钮同等效果
3. 显示/隐藏动画：220ms `cubic-bezier(0.32, 0.72, 0, 1)`
4. Shell Panel 打开时，Board bottom 从 28px 增加到 268px，防止内容被遮挡
5. Tab 栏高 32px，活跃 Tab 黑色背景 + 边框，Tab 有 × 关闭按钮
6. + 按钮新建 tab，自动 spawn 新 PTY 会话（默认 shell，cwd = workspace rootPath）
7. 头部右侧有 minimize / maximize / close 三个操作按钮
8. close 等同 ⌘`（关闭面板，不销毁 PTY）；maximize 将面板高度扩展至覆盖 Board
9. 面板内终端规则同 #卡片内嵌终端

---

## 功能点 12: 通知抽屉

### 用户故事

作为用户，我希望通过铃铛图标查看所有系统通知，以便了解 Agent 执行结果和告警。

### 业务规则

1. 通知抽屉由 TopBar 铃铛按钮触发，`position: fixed; top: 50px; right: 12px; width: 360px`，最大高度 `calc(100vh - 80px)`
2. 通知类型：ok=绿色圆点 / err=红色圆点 / warn=琥珀色圆点 / info=灰色圆点
3. 未读通知背景 `rgba(110,231,127,0.04)`，已读无特殊背景
4. 每条通知：类型圆点 + 标题（11.5px）+ meta 信息（时间/来源，10.5px 灰色）
5. 顶部有「Mark all as read」按钮，点击清空所有未读标记，铃铛徽章归零
6. 无通知时显示空状态「No notifications」
7. 点击通知项跳转到对应泳道并高亮相关卡片
8. 点击抽屉外侧区域关闭抽屉

---

## 功能点 13: 命令面板

### 用户故事

作为用户，我希望通过 ⌘K 快速搜索并执行任意命令，以便不依赖鼠标完成操作。

### 业务规则

1. ⌘K 或 TopBar ⌘K 按钮打开命令面板，Esc 关闭
2. 遮罩：`rgba(0,0,0,0.55)` + `backdrop-filter: blur(2px)` 全屏覆盖
3. 面板宽 `min(640px, 92vw)`，从屏幕上方 96px 处水平居中显示，border-radius 8px
4. 顶部搜索输入框（14px mono），打开时自动获焦，placeholder 文字灰色
5. 结果按组显示（Commands / PRDs / Tasks / Files），每组有灰色大写组标题
6. 每条结果：图标（16px）+ 名称 + 右侧描述（10.5px 灰色）
7. 键盘 ↑↓ 导航；激活行：左侧 2px 绿色边框 + `var(--bg-3)` 背景
8. Enter 执行选中条目（运行命令 / 打开文件 / 跳转泳道）
9. 面板底部显示键盘快捷键提示：↑↓ 导航 / ↵ 执行 / Esc 关闭
10. 搜索内容为空时，显示最近使用记录

---

## 功能点 14: 卡片详情焦点视图

### 用户故事

作为用户，我希望点击 Agent 卡片后能全屏查看完整终端输出，以便排查问题而不被卡片高度限制。

### 业务规则

1. 点击卡片（非交通灯/按钮区域）打开焦点视图
2. 遮罩：`rgba(0,0,0,0.65)` + `backdrop-filter: blur(3px)` 全屏覆盖，z-index: 150
3. 焦点窗口尺寸：`min(900px, 90vw)` × `min(620px, 85vh)`，居中，border-radius 8px
4. 焦点窗口显示完整 Agent 卡片内容：头部 + 描述 + 全高度终端（无 max-height 限制）
5. Esc 或点击遮罩关闭焦点视图
6. 焦点视图与卡片共享同一 PTY 会话（不重新 spawn），关闭后 PTY 继续运行

---

## 功能点 15: 规则抽屉

### 用户故事

作为用户，我希望查看项目的编码规则和当前违规情况，以便了解代码质量。

### 业务规则

1. 规则抽屉由 TopBar Rules 按钮打开，从右侧滑入
2. 内容来源：扫描 `.claude/rules/*.md`，解析规则 id / priority / title / desc
3. 每条规则显示：优先级标签（P0/P1）+ 规则名 + 描述一行
4. 当前 hook 检测到的违规列在对应规则下方：文件路径 + 消息 + severity（error/warn）
5. 支持按泳道过滤（显示该步骤相关的规则）
6. TopBar Rules 按钮红色数字徽章 = error 级别违规总数
7. Watcher 启动失败时，TopBar 显示红色徽章「Watch offline」，规则抽屉仍可打开

---

## 功能点 16: PRD 选择器

### 用户故事

作为用户，我希望在 TopBar 切换当前激活的 PRD，以便将看板工作与对应需求文档关联。

### 业务规则

1. PRD 选择器显示在 TopBar 左区品牌名后，格式「PRD-ID STATUS ▼」，点击展开下拉列表
2. 下拉列表来源：扫描 `docs/prds/*.md`，解析 frontmatter 获取 id / title / status / tbd 数
3. 每条 PRD 显示：PRD-ID、标题（截断省略）、状态徽章（active=绿色 / draft=灰色 / archived=暗色）、[TBD] 计数
4. 状态 active 的 PRD 排在列表最前
5. 选择 PRD 后，TopBar stats chip、任务进度跟随切换到该 PRD 的数据
6. 悬停 PRD 条目时显示该 PRD 的摘要预览（前 3 行正文）
7. PRD 文件不存在或全部解析失败时，显示「无 PRD」，不阻断看板使用
8. PRD 内容修改成功后，重算 tbdCount，选择器和 TopBar chip 同步刷新

---

## 功能点 17: 文档浏览器

### 用户故事

作为用户，我希望在不离开应用的情况下浏览 docs/ 目录下的所有文档，以便查阅 PRD、任务和复盘报告。

### 业务规则

1. 文档浏览器由 TopBar Docs 按钮打开，模态框形式，尺寸 `min(800px, 90vw)` × `min(600px, 85vh)`
2. 左侧文件树：显示 docs/ 目录结构，支持展开/折叠子目录
3. 点击 .md 文件，右侧预览区使用 react-markdown + remark-gfm 渲染
4. 代码块有语法高亮
5. 支持在预览区内点击 #锚点链接跳转
6. 被浏览的文件被外部删除时，预览区顶部显示警告横条「File missing」
7. Esc 或点击遮罩关闭浏览器

---

## 功能点 18: 右键菜单

### 用户故事

作为用户，我希望右键点击 Agent 卡片时弹出操作菜单，以便快速执行常用操作而不进入焦点视图。

### 业务规则

1. 右键点击 Agent 卡片弹出上下文菜单，定位在鼠标位置，超出视口时自动翻转方向
2. 菜单项顺序：Run / Pause / Restart / 分割线 / Duplicate / Move to…（子菜单列出其他泳道）/ 分割线 / Delete
3. Delete 为 danger 样式，hover 时文字变 `var(--red)`
4. Delete 点击弹二次确认；确认后销毁卡片及其 PTY 会话
5. 卡片处于 run 状态时，Run 禁用；idle 状态时，Pause / Restart 禁用
6. 点击菜单外侧或 Esc 关闭菜单，不执行任何操作

---

## 功能点 19: 微调面板

### 用户故事

作为用户，我希望能快速调整看板的显示密度和自动播放选项，以便根据当前任务定制视图。

### 业务规则

1. Tweaks Panel `position: fixed; right: 14px; bottom: 14px`，宽 260px，border-radius 8px
2. 默认折叠，点击触发按钮展开/收起
3. Density（密度）三档分段控制：compact / comfortable / spacious，影响泳道宽度和卡片内边距
4. Show Helpers：开关切换 /fix 和 /meta-audit 泳道的可见性
5. Auto-play：启用后，前一步骤完成时自动触发下一步骤的主 Agent spawn
6. 所有设置持久化（localStorage），应用重启后恢复上次配置
7. 设置变更实时生效，无需刷新

---

## 功能点 20: 通用看板

### 用户故事

作为用户，我希望在流水线看板之外有一个自由看板管理普通任务，以便处理不属于固定工作流的事项。

### 业务规则

1. 通过 TopBar Layout Toggle 切换到 generic 模式，PipelineStrip 隐藏，Board 切换为通用看板
2. 通用看板数据持久化到工作区 `.claude/.kanban-board.json`
3. 默认 4 列：Backlog / Ready / Running / Done
4. 列可重命名（双击列标题内联编辑），按 Enter 或失焦提交，Esc 恢复原标题
5. 列标题提交为空时，显示「Title cannot be empty」错误，不提交更改
6. 列宽三档：narrow（240px）/ standard（320px）/ wide（440px），列头部下拉选择
7. 删除含卡片的列时，弹确认框「Delete N cards or move them to backlog?」
8. 卡片可跨列拖拽（HTML5 DnD），drag-over 时列显示绿色内阴影
9. 卡片移入 running 列时，如有 bootCommands，自动依次执行
10. 状态变更 200ms debounce 后持久化到 `.kanban-board.json`
11. `.kanban-board.json` 不存在时，自动创建 4 列默认结构并写入文件

---

## 验收清单

- [ ] 应用在 macOS 启动，有最近工作区时 3 秒内到达 ready 状态
- [ ] 全部 20 个功能点可正常渲染，无白屏/控制台报错
- [ ] Activity Bar 切换 6 个视图，对应内容区域正确显示
- [ ] PTY 终端可正常 spawn / 接收输出 / 写入输入 / kill
- [ ] Shell Panel ⌘` 开关，Board bottom 正确上移/复位
- [ ] 命令面板 ⌘K 打开，键盘 ↑↓ 导航，Enter 执行
- [ ] 卡片在同泳道内拖拽排序正确
- [ ] 通用看板跨列拖拽，数据正确持久化到 .kanban-board.json
- [ ] 通知抽屉未读数与铃铛徽章实时同步
- [ ] Tweaks Panel 密度切换实时生效并持久化
- [ ] 所有覆盖层（Shell/通知/命令面板/焦点/右键菜单）支持 Esc 关闭
- [ ] 文件 Watcher 检测到变化后看板数据自动刷新

## 变更记录

| 日期 | 变更内容 | 变更人 |
|------|---------|--------|
| 2026-05-02 | 基于设计稿完整枚举 18 个 UI 元素（全部 v1），重新生成 | Claude |

---

## 附录 A: 文件目录约定

| 路径 | 内容 |
|------|------|
| `.claude/commands/*.md` | 泳道来源，每个文件对应一条泳道 |
| `.claude/rules/*.md` | 编码规则，Rules 抽屉内容 |
| `.claude/.kanban-board.json` | 通用看板持久化数据 |
| `docs/prds/*.md` | PRD 文件，PRD 选择器数据来源 |
| `docs/tasks/*.json` | 任务清单，tasks 视图数据来源 |
| `docs/bug-reports/*.md` | Bug 报告，bugs 视图数据来源 |
| `docs/retrospectives/*.md` | /meta-audit 历史，RetroTimeline 数据来源 |

## 附录 B: Design Token

| Token | 值 | 用途 |
|-------|----|------|
| `--bg` | `#07080a` | 全局背景 |
| `--bg-1` | `#0c0d10` | 面板背景（TopBar / Pipeline / Lane head）|
| `--bg-2` | `#121418` | 卡片背景 |
| `--bg-3` | `#171a1f` | 卡片头部 / 输入行背景 |
| `--bg-4` | `#1d2128` | 步骤编号方块背景 |
| `--line` | `#23262d` | 默认边框 |
| `--line-2` | `#2d3139` | hover 边框 |
| `--text` | `#e6e9ef` | 主文字 |
| `--text-2` | `#a5acba` | 次要文字 |
| `--text-3` | `#6b7280` | 辅助文字 / 占位 |
| `--green` | `#6ee77f` | 主色调 / main kind / ok 状态 / 激活 |
| `--amber` | `#ffb547` | 警告 / hook kind / run 状态 / Gate |
| `--red` | `#ff6b6b` | 错误 / err 状态 / danger |
| `--blue` | `#7aa2ff` | 蓝色 / wait 状态 / in artifact |
| `--purple` | `#c39bff` | 紫色 / sub kind |
| `--teal` | `#5eead4` | 青色 / skill kind / done 步骤 |
| `--mono` | JetBrains Mono | 等宽字体（命令名/路径/终端） |
| `--sans` | Inter | 正文字体 |

## 附录 C: Tauri IPC 命令契约

| 命令 | 方向 | 说明 |
|------|------|------|
| `pick_workspace_folder` | 前端→Rust | 打开系统目录选择器，返回路径或 null |
| `scan_workspace` | 前端→Rust | 扫描工作区，返回 WorkspaceScanResult |
| `get_recent_workspaces` | 前端→Rust | 读取最近工作区列表 |
| `save_recent_workspaces` | 前端→Rust | 保存最近工作区列表 |
| `watch_workspace` | 前端→Rust | 启动文件 watcher |
| `workspace_changed` | Rust→前端（Event） | 文件变化通知 |
| `pty_spawn` | 前端→Rust | 启动 PTY 会话 |
| `pty_write` | 前端→Rust | 向 PTY 写入输入 |
| `pty_resize` | 前端→Rust | 调整 PTY 窗口尺寸 |
| `pty_kill` | 前端→Rust | 终止 PTY 进程 |
| `pty_output` | Rust→前端（Event） | PTY 输出推送 |
| `read_generic_board` | 前端→Rust | 读取通用看板数据 |
| `write_generic_board` | 前端→Rust | 写入通用看板数据 |
| `get_layout` | 前端→Rust | 读取布局设置 |
| `set_layout` | 前端→Rust | 保存布局设置 |

## 附录 D: 设计稿元素清单（v1 锁定，2026-05-02）

| # | 元素 | 决策 | PRD 章节 |
|---|------|------|---------|
| 1 | Activity Bar | ✅ v1 | #Activity-Bar |
| 2 | TopBar | ✅ v1 | #顶部操作栏 |
| 3 | Pipeline Strip | ✅ v1 | #流水线步骤条 |
| 4 | Board 主区域 | ✅ v1 | #看板主区域 |
| 5 | Retro Timeline | ✅ v1 | #底部时间轴 |
| 6 | Lane（泳道） | ✅ v1 | #泳道 |
| 7 | Connector（箭头） | ✅ v1 | #泳道连接箭头 |
| 8 | Agent Card | ✅ v1 | #Agent-卡片 |
| 9 | Terminal（嵌入式） | ✅ v1 | #卡片内嵌终端 |
| 10 | Shell Panel | ✅ v1 | #全局-Shell-面板 |
| 11 | Notification Drawer | ✅ v1 | #通知抽屉 |
| 12 | Command Palette | ✅ v1 | #命令面板 |
| 13 | Focus Overlay | ✅ v1 | #卡片详情焦点视图 |
| 14 | Rules Drawer | ✅ v1 | #规则抽屉 |
| 15 | PRD Selector | ✅ v1 | #PRD-选择器 |
| 16 | Docs Panel | ✅ v1 | #文档浏览器 |
| 17 | Context Menu | ✅ v1 | #右键菜单 |
| 18 | Tweaks Panel | ✅ v1 | #微调面板 |

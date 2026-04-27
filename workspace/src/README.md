# 前端模块索引

> Tauri WebView 加载这棵 React 树, 业务模块按 `features/` 划分, 跨模块共享放全局目录。

## 功能模块 (features/)

| 模块      | 说明                              | 状态     |
| --------- | --------------------------------- | -------- |
| workspace | 工作区接入 (选目录 / 扫描 / 持久化) | 待开发 (M1 占位) |
| kanban    | 看板与泳道渲染                    | 待开发   |
| terminal  | PTY 终端 (xterm)                  | 待开发   |
| docs      | 文档浏览器                        | 待开发   |
| prd       | PRD 预览与编辑                    | 待开发   |
| rules     | 规则抽屉                          | 待开发   |
| retro     | 回溯时间轴                        | 待开发   |

## 全局通用

| 目录          | 说明                                          |
| ------------- | --------------------------------------------- |
| components/   | 通用 UI 组件 (Drawer / Modal / Toast)         |
| hooks/        | 通用 hooks                                    |
| stores/       | 全局 Zustand store                            |
| ipc/          | Tauri invoke / listen 的 typed 包装           |
| types/        | 全局类型 + IPC 类型 (与 Rust struct 一一对应) |
| styles/       | tokens.ts + global.css                        |
| i18n/         | 多语言资源                                    |
| pages/        | 主界面级组件 (Welcome / Loading / Kanban / Error) |

## 入口文件

| 文件        | 说明                              |
| ----------- | --------------------------------- |
| main.tsx    | ReactDOM.createRoot 入口          |
| App.tsx     | 根组件, phase 切换主界面          |

## 当前状态 (2026-04-27, M1)

仅有占位欢迎页 + IPC 联通性自检 (`ping`)。所有业务模块未开发。

/**
 * @description 根组件, 单页桌面端没有路由, 用 phase 字段决定主界面状态
 * @module src
 * @dependencies (M1 阶段为空壳)
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 * @rules
 *   - M1 阶段先渲染欢迎页, M2 接入工作区扫描后切换到 KanbanShell
 */
import { useState } from "react";

type Phase = "welcome" | "loading" | "kanban" | "error";

export default function App() {
  const [phase] = useState<Phase>("welcome");

  if (phase === "welcome") {
    return (
      <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
        <h1>spider</h1>
        <p>M1 占位界面 — 等待工作区接入实现。</p>
        <p style={{ color: "#888" }}>
          选择一个 claude-code-workflow 仓库以开始。
        </p>
      </main>
    );
  }

  return null;
}

/**
 * @description 根组件，挂载全局 Provider 并渲染 WorkspaceShell
 * @module src
 * @dependencies WorkspaceShell, react-i18next, @/stores/useWorkspaceStore
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T012
 * @rules
 *   - 应用启动后, 若有最近工作区记录, 默认打开最近一个并自动进入 scanning 状态
 */

import { Suspense } from 'react';
import { WorkspaceShell } from '@/pages/WorkspaceShell';

export default function App() {
  return (
    <Suspense fallback={null}>
      <WorkspaceShell />
    </Suspense>
  );
}

/**
 * @description React 错误边界 + Toast 组件系统
 * @module components/ErrorBoundary
 * @dependencies useToastStore
 * @prd docs/prds/claude-workflow-kanban.md#文件系统集成
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T055
 * @rules
 *   - Watcher 启动失败时, 顶栏显示红色徽章「Watch offline」
 *   - 前端连续 IPC 失败 > 3 次弹系统级 banner「Backend unresponsive, restart suggested」
 */

import { Component, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className={styles.fallback}>
          <h2 className={styles.fallbackTitle}>Something went wrong</h2>
          <p className={styles.fallbackMsg}>{this.state.error?.message}</p>
          <button
            className={styles.retryBtn}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * @description xterm.js 终端封装组件
 * @module features/terminal/components/Terminal
 * @dependencies @xterm/xterm, @xterm/addon-fit, @xterm/addon-web-links
 * @prd docs/prds/claude-workflow-kanban.md#终端卡片
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T040
 * @rules
 *   - 窗口 resize 时按 size.cols = Math.floor(width / 8), size.rows = Math.floor(height / 20) 调 pty_resize
 *   - 订阅 pty_output 事件, data 段用 xterm.write(data) 写入终端
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import styles from './Terminal.module.css';

export interface TerminalHandle {
  terminal: XTerm | null;
  fit: () => void;
}

export interface TerminalProps {
  onReady?: (terminal: XTerm) => void;
  onResize?: (cols: number, rows: number) => void;
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  ({ onReady, onResize }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useImperativeHandle(ref, () => ({
      get terminal() { return termRef.current; },
      fit() { fitAddonRef.current?.fit(); },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const term = new XTerm({
        theme: {
          background: '#07080a',
          foreground: '#d0d0d0',
          cursor:     '#6ee77f',
        },
        fontFamily: 'JetBrains Mono, Fira Code, Menlo, monospace',
        fontSize: 12,
        lineHeight: 1.4,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      const linksAddon = new WebLinksAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(linksAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      termRef.current = term;
      fitAddonRef.current = fitAddon;
      onReady?.(term);

      // Resize observer
      const ro = new ResizeObserver(() => {
        fitAddon.fit();
        if (containerRef.current && onResize) {
          const { width, height } = containerRef.current.getBoundingClientRect();
          const cols = Math.max(20, Math.floor(width / 8));
          const rows = Math.max(5, Math.floor(height / 20));
          onResize(cols, rows);
        }
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        term.dispose();
        termRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return <div ref={containerRef} className={styles.terminal} />;
  }
);

Terminal.displayName = 'Terminal';

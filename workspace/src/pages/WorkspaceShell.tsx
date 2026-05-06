/**
 * @description 工作区状态机根组件，根据 phase 渲染对应子页
 * @module pages/WorkspaceShell
 * @dependencies useWorkspaceStore, useWorkspaceActions, @tauri-apps/api/event
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 * @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T011
 * @design docs/designs/claude-workflow-kanban/wf-app.jsx (WorkspaceShell + Empty/Scanning/Invalid 组件)
 * @rules
 *   - 应用启动后, 若 get_recent_workspaces 返回空数组, 进入 empty 状态并显示欢迎页
 *   - 校验通过后进入 scanning 状态, 实时消费 scan_progress 事件并展示当前文件名 + 百分比进度条
 *   - invalid 状态下点击 Pick another 回到 empty 状态, 当前路径不写入 recentWorkspaces
 *   - ready 状态下顶栏右侧的 Close workspace 按钮返回 empty 状态, 保留 recentWorkspaces
 */

import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { IPC } from '@/ipc/contract';
import {
  pickWorkspaceFolder,
  validateWorkspace,
  scanWorkspace,
  getRecentWorkspaces,
  addRecentWorkspace,
  startWatcher,
} from '@/features/workspace/ipc';
import type { ScanProgressPayload, ValidateResult } from '@/types/ipc';
import { KanbanShell } from './KanbanShell';
import styles from './WorkspaceShell.module.css';

// ── EmptyPage ───────────────────────────────────────────────────────────────
interface EmptyPageProps {
  onOpen: () => void;
  recentWorkspaces: string[];
  onOpenRecent: (path: string) => void;
}

function EmptyPage({ onOpen, recentWorkspaces, onOpenRecent }: EmptyPageProps) {
  return (
    <div className={styles.emptyPage}>
      <div className={styles.brand}>
        <span className={styles.brandName}>spider</span>
        <span className={styles.brandSub}>Claude 工作区看板</span>
      </div>
      <button className={styles.primaryBtn} onClick={onOpen}>
        打开文件夹
      </button>
      {recentWorkspaces.length > 0 && (
        <div className={styles.recentList}>
          <p className={styles.recentTitle}>最近打开</p>
          {recentWorkspaces.map((p) => (
            <button key={p} className={styles.recentItem} onClick={() => onOpenRecent(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ScanningPage ────────────────────────────────────────────────────────────
interface ScanningPageProps {
  currentFile: string;
  progress: number;
}

function ScanningPage({ currentFile, progress }: ScanningPageProps) {
  return (
    <div className={styles.scanningPage}>
      <p className={styles.scanningLabel}>正在扫描工作区…</p>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className={styles.scanningFile}>{currentFile}</p>
    </div>
  );
}

// ── InvalidPage ─────────────────────────────────────────────────────────────
interface InvalidPageProps {
  detected: string[];
  onPickAnother: () => void;
}

function InvalidPage({ detected, onPickAnother }: InvalidPageProps) {
  return (
    <div className={styles.invalidPage}>
      <p className={styles.invalidTitle}>工作区不合法</p>
      <p className={styles.invalidDesc}>以下必要目录未找到：</p>
      <ul className={styles.invalidList}>
        {detected.length === 0 && <li>.claude/</li>}
        {detected.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <button className={styles.secondaryBtn} onClick={onPickAnother}>
        选择其他文件夹
      </button>
    </div>
  );
}

// ── WorkspaceShell ──────────────────────────────────────────────────────────
export function WorkspaceShell() {
  const { phase, recentWorkspaces, setPhase, setWorkspace, addRecent, setScanError } =
    useWorkspaceStore();

  const [scanProgress, setScanProgress] = useState(0);
  const [scanFile, setScanFile] = useState('');
  const [invalidDetected, setInvalidDetected] = useState<string[]>([]);

  // Bootstrap: load recent workspaces on mount
  useEffect(() => {
    getRecentWorkspaces().then((recents) => {
      if (recents.length > 0) {
        recents.forEach((p) => addRecent(p));
        handleOpenPath(recents[0]);
      }
    }).catch(() => {
      // no-op — stay in empty state
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to scan_progress events while scanning
  useEffect(() => {
    if (phase !== 'scanning') return;
    const unlisten = listen<ScanProgressPayload>(IPC.Event.SCAN_PROGRESS, (event) => {
      setScanProgress(event.payload.progress);
      setScanFile(event.payload.currentFile);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [phase]);

  async function handleOpen() {
    try {
      const path = await pickWorkspaceFolder();
      await handleOpenPath(path);
    } catch {
      // user cancelled — stay in empty state
    }
  }

  async function handleOpenPath(path: string) {
    setPhase('scanning');
    setScanProgress(0);
    setScanFile('');

    try {
      const validation: ValidateResult = await validateWorkspace(path);
      if (!validation.valid) {
        setInvalidDetected(validation.detected);
        setPhase('invalid');
        return;
      }

      const ws = await scanWorkspace(path);
      setWorkspace(ws);
      addRecent(path);
      await addRecentWorkspace(path);
      startWatcher(path).catch(() => { /* watcher best-effort */ });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }

  function handlePickAnother() {
    setPhase('empty');
  }

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        {phase === 'empty' && (
          <EmptyPage
            onOpen={handleOpen}
            recentWorkspaces={recentWorkspaces}
            onOpenRecent={handleOpenPath}
          />
        )}
        {phase === 'scanning' && (
          <ScanningPage currentFile={scanFile} progress={scanProgress} />
        )}
        {phase === 'invalid' && (
          <InvalidPage detected={invalidDetected} onPickAnother={handlePickAnother} />
        )}
        {phase === 'ready' && <KanbanShell />}
        {phase === 'error' && (
          <div className={styles.errorPage}>
            <p>扫描失败，请重试。</p>
            <button className={styles.secondaryBtn} onClick={handlePickAnother}>
              重新选择
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

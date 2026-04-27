/**
 * @description 前端入口, 把 React 树挂到 #root
 * @module src
 * @dependencies react, react-dom
 * @prd docs/prds/claude-workflow-kanban.md#工作区接入
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

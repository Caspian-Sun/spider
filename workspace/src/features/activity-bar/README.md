# activity-bar

> Activity Bar 模块：左侧 48px 固定导航栏，管理应用主视图切换

## 文件清单

| 文件名 | 说明 | 依赖 | 最后更新 |
|--------|------|------|----------|
| constants.ts | 视图枚举 ACTIVITY_VIEWS、导航项配置 ACTIVITY_NAV_ITEMS | — | 2026-05-02 |
| stores/useActivityBarStore.ts | 激活视图状态 | constants | 2026-05-02 |
| components/ActivityBar.tsx | 左侧导航栏 UI | constants, store, useWorkspaceStore | 2026-05-02 |
| components/ActivityBar.module.css | 导航栏样式 | — | 2026-05-02 |

## 对外暴露

- `ActivityView` 类型
- `useActivityBarStore` store
- `ActivityBar` 组件

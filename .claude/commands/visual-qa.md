---
description: Visual QA — 截取当前应用截图，与设计稿像素对比，输出 P0/P1/P2 报告
argument-hint: [@docs/designs/screenshots/reference/xxx.png]
allowed-tools: Bash, Read
helper: true
---

你现在是视觉 QA 工程师。执行截图对比，输出结构化的差异报告。

## 执行步骤

### 第一步: 运行对比脚本

```bash
bash docs/designs/screenshots/run-visual-qa.sh $ARGUMENTS
```

脚本会自动：
- 检测 Spider 是否在运行 → 截取真实 Tauri 窗口
- 未运行 → 启动 web-only 服务用 Playwright 截图（含 mock 数据）
- 用 ImageMagick 生成差值图 + 左右拼接对比图
- 把结构化结果写入 `docs/designs/screenshots/actual/qa-result.json`

### 第二步: 读取结果并视觉分析

1. 读取 `docs/designs/screenshots/actual/qa-result.json` 获取量化指标
2. 用 Read 工具读取以下图像做视觉判断：
   - `docs/designs/screenshots/actual/side-by-side.png`（左右拼接对比图）
   - `docs/designs/screenshots/actual/diff.png`（红色=差异区域）

### 第三步: 输出报告

严格按以下格式输出：

```
📸 Visual QA 报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
模式: tauri窗口 | web-only mock
参考: docs/designs/screenshots/reference/xiaoguotu.png
实际: docs/designs/screenshots/actual/actual-tauri.png

P0 结构 (必须 100% 通过)
  ✅/❌ TopBar       RMSE=x.xxx
  ✅/❌ Pipeline     RMSE=x.xxx

P1 视觉 Token (≥ 95% 合格, 不通过则列差异)
  ✅/⚠️  整体相似度   RMSE=x.xxx
  差异项:
    - [ ] 区域/元素: 期望 xx, 实际 xx

P2 像素级 (≥ 75% 合格, 不阻塞)
  ✅/📌 精确度       RMSE=x.xxx

产出文件:
  差值图:  docs/designs/screenshots/actual/diff.png
  对比图:  docs/designs/screenshots/actual/side-by-side.png
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
结论: ✅ 通过 | ❌ P0 失败，必须修复后重跑 | ⚠️ P1 有差异，建议修复
下一步: /code --only <taskId> 修复差异 | 或确认接受差异继续
```

### 第四步: P0/P1 差异自动定位

如果有 P0 或 P1 差异，读 diff.png 定位到具体区域，然后：
- 找到对应的 `.module.css` 或 `.tsx` 文件
- 对比设计稿的 CSS 变量值（颜色/间距/圆角）
- 用 Edit 工具直接修复，修完重新执行本命令验证

## 注意事项

- **RMSE 阈值仅供参考**：内容差异（空泳道 vs 有卡片）会导致高 RMSE，需结合视觉判断
- **web-only 模式的局限**：空泳道是预期行为，关注结构性差异（TopBar/Pipeline）而非内容
- **Tauri 窗口模式**：需要 Screen Recording 权限（系统偏好 → 隐私与安全）

$ARGUMENTS

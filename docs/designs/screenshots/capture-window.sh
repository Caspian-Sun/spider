#!/usr/bin/env bash
# 截取真实 Tauri 窗口并保存到 actual/ 目录，用于与 reference/ 设计稿对比
# 用法: bash docs/designs/screenshots/capture-window.sh [输出文件名]
# 默认输出: docs/designs/screenshots/actual/actual-tauri.png

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="${1:-$SCRIPT_DIR/actual/actual-tauri.png}"
APP_NAME="Spider"

# 确保输出目录存在
mkdir -p "$(dirname "$OUTPUT")"

# 检查 app 是否在运行
if ! pgrep -x "$APP_NAME" > /dev/null 2>&1; then
  echo "❌ $APP_NAME 没有在运行，请先执行 pnpm dev 启动应用"
  exit 1
fi

# 激活窗口并获取位置/尺寸
BOUNDS=$(osascript <<EOF
tell application "System Events"
  tell process "$APP_NAME"
    set frontmost to true
    delay 0.4
    set {x, y} to position of window 1
    set {w, h} to size of window 1
    return (x as string) & "," & (y as string) & "," & (w as string) & "," & (h as string)
  end tell
end tell
EOF
)

X=$(echo "$BOUNDS" | cut -d, -f1)
Y=$(echo "$BOUNDS" | cut -d, -f2)
W=$(echo "$BOUNDS" | cut -d, -f3)
H=$(echo "$BOUNDS" | cut -d, -f4)

echo "📐 窗口位置: x=$X y=$Y 尺寸: ${W}x${H}"

# 截图（-x 静音，-R 指定区域）
screencapture -x -R "$X,$Y,$W,$H" "$OUTPUT"

echo "✅ 截图已保存: $OUTPUT"
echo ""
echo "对比设计稿:"
echo "  参考图: $SCRIPT_DIR/reference/xiaoguotu.png"
echo "  实际图: $OUTPUT"

#!/usr/bin/env bash
# Visual QA 核心脚本：截图 → 像素对比 → 生成报告
# 自动判断运行模式：Tauri 窗口优先，否则降级到 web-only mock
#
# 用法:
#   bash docs/designs/screenshots/run-visual-qa.sh
#   bash docs/designs/screenshots/run-visual-qa.sh reference/custom.png
#
# 输出:
#   actual/actual-*.png   实际截图
#   actual/diff.png       差值图（红色=差异区域）
#   actual/side-by-side.png  左右拼接对比图
#   actual/qa-result.json 结构化报告（供 /visual-qa 命令读取）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
WORKSPACE_DIR="$ROOT_DIR/workspace"

REFERENCE="${1:-$SCRIPT_DIR/reference/xiaoguotu.png}"
ACTUAL_DIR="$SCRIPT_DIR/actual"
RESULT_JSON="$ACTUAL_DIR/qa-result.json"
DIFF_IMG="$ACTUAL_DIR/diff.png"
SIDE_BY_SIDE="$ACTUAL_DIR/side-by-side.png"
TARGET_SIZE="1440x900"
PORT=1420
APP_NAME="Spider"

mkdir -p "$ACTUAL_DIR"

# ── 颜色输出 ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${BLUE}[visual-qa]${NC} $*" >&2; }
ok()   { echo -e "${GREEN}✅${NC} $*" >&2; }
warn() { echo -e "${YELLOW}⚠️ ${NC} $*" >&2; }
fail() { echo -e "${RED}❌${NC} $*" >&2; }

# ── 检查依赖 ──────────────────────────────────────────────────────────────────
check_deps() {
  if ! command -v magick &>/dev/null; then
    warn "ImageMagick 未安装，正在安装..."
    brew install imagemagick
  fi
  if ! npx --no playwright --version &>/dev/null 2>&1; then
    warn "Playwright 未安装，正在安装..."
    cd "$WORKSPACE_DIR" && pnpm add -D playwright && npx playwright install chromium
    cd "$SCRIPT_DIR"
  fi
}

# ── 截图：优先截 Tauri 窗口，否则用 web-only mock ────────────────────────────
take_screenshot() {
  # 清空整个 actual/ 目录，确保所有产出（截图/diff/JSON）都是本次新生成的
  rm -f "$ACTUAL_DIR"/*

  if pgrep -x "$APP_NAME" &>/dev/null; then
    log "检测到 $APP_NAME 正在运行，截取真实窗口..."
    ACTUAL_IMG="$ACTUAL_DIR/actual-tauri.png"
    bash "$SCRIPT_DIR/capture-window.sh" "$ACTUAL_IMG" >&2
    SCREENSHOT_MODE="tauri"
  else
    log "$APP_NAME 未运行，启动 web-only 服务截图（当前源码）..."
    ACTUAL_IMG="$ACTUAL_DIR/actual-spider.png"
    SCREENSHOT_MODE="web-only"

    # 杀掉可能残留的旧 vite 进程，确保拿到最新代码
    lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null || true

    cd "$WORKSPACE_DIR"
    npx vite --port $PORT &>/dev/null &
    VITE_PID=$!
    log "等待 dev server 就绪 (port $PORT)..."
    for i in $(seq 1 20); do
      curl -s "http://localhost:$PORT" &>/dev/null && break
      sleep 1
    done

    node "$WORKSPACE_DIR/screenshot-kanban.mjs" >&2

    kill "$VITE_PID" 2>/dev/null || true
    cd "$SCRIPT_DIR"
  fi

  # 验证截图确实产出，否则硬性失败
  if [ ! -f "$ACTUAL_IMG" ]; then
    fail "截图失败，文件不存在: $ACTUAL_IMG"
    exit 1
  fi
  log "截图完成: $ACTUAL_IMG ($(date '+%H:%M:%S'))"

  echo "$SCREENSHOT_MODE|$ACTUAL_IMG"
}

# ── 图像对比 ──────────────────────────────────────────────────────────────────
compare_images() {
  local actual="$1"

  if [ ! -f "$REFERENCE" ]; then
    fail "参考图不存在: $REFERENCE"
    exit 1
  fi
  if [ ! -f "$actual" ]; then
    fail "实际截图不存在: $actual"
    exit 1
  fi

  log "对比图像（统一缩放至 $TARGET_SIZE）..."

  # 缩放到同一尺寸
  magick "$REFERENCE" -resize "${TARGET_SIZE}!" /tmp/vqa-ref.png 2>/dev/null
  magick "$actual"    -resize "${TARGET_SIZE}!" /tmp/vqa-act.png 2>/dev/null

  # RMSE 差值（0=完全相同，1=完全不同）
  # magick compare 输出格式: "7625.86 (0.116363)" — 括号内是归一化值 (0~1)
  extract_norm_rmse() { grep -oE '\([0-9.]+\)' | tr -d '()' | tail -1; }
  RMSE_RAW=$(magick compare -metric RMSE /tmp/vqa-ref.png /tmp/vqa-act.png "$DIFF_IMG" 2>&1 || true)
  RMSE=$(echo "$RMSE_RAW" | extract_norm_rmse || echo "1.0")
  [ -z "$RMSE" ] && RMSE="1.0"
  SIMILARITY=$(echo "scale=4; 1 - $RMSE" | bc 2>/dev/null || echo "0")

  # 分区域对比
  compare_region() {
    local label="$1" crop="$2"
    magick /tmp/vqa-ref.png -crop "$crop" +repage /tmp/vqa-r-region.png 2>/dev/null
    magick /tmp/vqa-act.png -crop "$crop" +repage /tmp/vqa-a-region.png 2>/dev/null
    local raw
    raw=$(magick compare -metric RMSE /tmp/vqa-r-region.png /tmp/vqa-a-region.png /tmp/vqa-diff-region.png 2>&1 || true)
    local val
    val=$(echo "$raw" | grep -oE '\([0-9.]+\)' | tr -d '()' | tail -1)
    echo "${val:-1.0}"
  }

  # TopBar (顶部 48px)
  RMSE_TOPBAR=$(compare_region "topbar" "1440x48+0+0")
  # Pipeline (48px 往下 34px)
  RMSE_PIPELINE=$(compare_region "pipeline" "1440x34+0+48")
  # Board 区域 (82px 往下 700px)
  RMSE_BOARD=$(compare_region "board" "1440x700+0+82")

  # 拼接左右对比图
  magick /tmp/vqa-ref.png /tmp/vqa-act.png +append "$SIDE_BY_SIDE" 2>/dev/null

  # 清理临时文件
  rm -f /tmp/vqa-ref.png /tmp/vqa-act.png /tmp/vqa-r-region.png /tmp/vqa-a-region.png /tmp/vqa-diff-region.png

  echo "$RMSE|$RMSE_TOPBAR|$RMSE_PIPELINE|$RMSE_BOARD|$SIMILARITY"
}

# ── P0/P1/P2 判定 ─────────────────────────────────────────────────────────────
grade_results() {
  local rmse_total="$1" rmse_topbar="$2" rmse_pipeline="$3" rmse_board="$4"

  # P0: 结构 — TopBar + Pipeline 区域 RMSE < 0.35
  local p0_topbar_pass=false p0_pipeline_pass=false
  (( $(echo "$rmse_topbar < 0.35" | bc -l 2>/dev/null || echo 0) )) && p0_topbar_pass=true || true
  (( $(echo "$rmse_pipeline < 0.35" | bc -l 2>/dev/null || echo 0) )) && p0_pipeline_pass=true || true

  # P1: 视觉 Token — 整体 RMSE < 0.25
  local p1_pass=false
  (( $(echo "$rmse_total < 0.25" | bc -l 2>/dev/null || echo 0) )) && p1_pass=true || true

  # P2: 像素级 — 整体 RMSE < 0.15
  local p2_pass=false
  (( $(echo "$rmse_total < 0.15" | bc -l 2>/dev/null || echo 0) )) && p2_pass=true || true

  echo "$p0_topbar_pass|$p0_pipeline_pass|$p1_pass|$p2_pass"
}

# ── 写 JSON 报告 ──────────────────────────────────────────────────────────────
write_json() {
  local mode="$1" actual="$2" rmse_total="$3" rmse_topbar="$4" rmse_pipeline="$5" rmse_board="$6"
  local p0_topbar="$7" p0_pipeline="$8" p1="$9" p2="${10}"
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$RESULT_JSON" <<JSON
{
  "timestamp": "$ts",
  "mode": "$mode",
  "reference": "$REFERENCE",
  "actual": "$actual",
  "diff": "$DIFF_IMG",
  "sideBySide": "$SIDE_BY_SIDE",
  "metrics": {
    "rmse": { "total": $rmse_total, "topbar": $rmse_topbar, "pipeline": $rmse_pipeline, "board": $rmse_board }
  },
  "grades": {
    "P0_topbar":   { "pass": $p0_topbar,   "threshold": 0.35, "label": "TopBar 结构" },
    "P0_pipeline": { "pass": $p0_pipeline, "threshold": 0.35, "label": "Pipeline 结构" },
    "P1":          { "pass": $p1,          "threshold": 0.25, "label": "视觉 Token 整体" },
    "P2":          { "pass": $p2,          "threshold": 0.15, "label": "像素级精确度" }
  }
}
JSON
}

# ── 打印报告 ──────────────────────────────────────────────────────────────────
print_report() {
  local p0_topbar="$1" p0_pipeline="$2" p1="$3" p2="$4"
  local rmse_total="$5" rmse_topbar="$6" rmse_pipeline="$7" rmse_board="$8"
  local mode="$9"

  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  📸 Visual QA 对比结果${NC}  [模式: $mode]"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  local p0_icon="✅"
  [[ "$p0_topbar" == "false" || "$p0_pipeline" == "false" ]] && p0_icon="❌"
  echo -e "$p0_icon P0 结构"
  echo    "     TopBar    RMSE=$rmse_topbar  阈值<0.35  $( [[ "$p0_topbar" == "true" ]] && echo '✅' || echo '❌ 必须修复' )"
  echo    "     Pipeline  RMSE=$rmse_pipeline  阈值<0.35  $( [[ "$p0_pipeline" == "true" ]] && echo '✅' || echo '❌ 必须修复' )"

  local p1_icon="✅"
  [[ "$p1" == "false" ]] && p1_icon="⚠️ "
  echo -e "$p1_icon P1 视觉 Token  RMSE=$rmse_total  阈值<0.25  $( [[ "$p1" == "true" ]] && echo '✅' || echo '⚠️  建议修复' )"

  local p2_icon="✅"
  [[ "$p2" == "false" ]] && p2_icon="📌"
  echo -e "$p2_icon P2 像素精确  RMSE=$rmse_total  阈值<0.15  $( [[ "$p2" == "true" ]] && echo '✅' || echo '📌 记录，不阻塞' )"

  echo ""
  echo "产出文件:"
  echo "  差值图:  $DIFF_IMG"
  echo "  对比图:  $SIDE_BY_SIDE"
  echo "  JSON:   $RESULT_JSON"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ── 主流程 ────────────────────────────────────────────────────────────────────
main() {
  log "开始 Visual QA..."
  check_deps

  local take_result
  take_result=$(take_screenshot)
  SCREENSHOT_MODE=$(echo "$take_result" | cut -d'|' -f1)
  ACTUAL_IMG=$(echo "$take_result" | cut -d'|' -f2-)

  METRICS=$(compare_images "$ACTUAL_IMG")
  RMSE_TOTAL=$(echo "$METRICS" | cut -d'|' -f1)
  RMSE_TOPBAR=$(echo "$METRICS" | cut -d'|' -f2)
  RMSE_PIPELINE=$(echo "$METRICS" | cut -d'|' -f3)
  RMSE_BOARD=$(echo "$METRICS" | cut -d'|' -f4)

  GRADES=$(grade_results "$RMSE_TOTAL" "$RMSE_TOPBAR" "$RMSE_PIPELINE" "$RMSE_BOARD")
  P0_TOPBAR=$(echo "$GRADES" | cut -d'|' -f1)
  P0_PIPELINE=$(echo "$GRADES" | cut -d'|' -f2)
  P1=$(echo "$GRADES" | cut -d'|' -f3)
  P2=$(echo "$GRADES" | cut -d'|' -f4)

  write_json "$SCREENSHOT_MODE" "$ACTUAL_IMG" \
    "$RMSE_TOTAL" "$RMSE_TOPBAR" "$RMSE_PIPELINE" "$RMSE_BOARD" \
    "$P0_TOPBAR" "$P0_PIPELINE" "$P1" "$P2"

  print_report "$P0_TOPBAR" "$P0_PIPELINE" "$P1" "$P2" \
    "$RMSE_TOTAL" "$RMSE_TOPBAR" "$RMSE_PIPELINE" "$RMSE_BOARD" \
    "$SCREENSHOT_MODE"

  # 返回码：P0 有失败则非零
  if [[ "$P0_TOPBAR" == "false" || "$P0_PIPELINE" == "false" ]]; then
    exit 2
  fi
}

main "$@"

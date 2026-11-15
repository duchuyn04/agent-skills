#!/usr/bin/env bash
# Chạy một lệnh test chậm trong pane Herdr riêng, rồi nhắn reviewer khi lệnh xong.
#
# Cách dùng:
#   run-slow-test.sh --name <tên> --out <thư mục trao đổi> --notify <pane reviewer> [--env KEY=VALUE]... -- <lệnh test...>
#
# Ví dụ:
#   run-slow-test.sh --name sd06-full --out "$S" --notify reviewer-backend \
#     --env TEST_DATABASE_URL=postgresql://u:p@localhost:5433/app_test -- dotnet test tests/App.IntegrationTests
#
# Script ghi các file sau vào thư mục trao đổi:
#   <tên>-start.txt  giờ bắt đầu
#   <tên>-exit.txt   mã thoát, giờ kết thúc và đường dẫn log
#   <tên>.log        log đầy đủ, trừ lệnh `dotnet test` (log nằm ở thư mục của test-progress)
#   Lệnh `pnpm test:e2e` hoặc `playwright` hiện một dòng tiến trình `đã xong/tổng` kèm giờ chạy, không in log ra pane.
set -u

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_NAME=""
OUTPUT_DIRECTORY=""
NOTIFY_PANE=""
TEST_COMMAND=()

while [ $# -gt 0 ]; do
  case "$1" in
    --name) RUN_NAME="$2"; shift 2 ;;
    --out) OUTPUT_DIRECTORY="$2"; shift 2 ;;
    --notify) NOTIFY_PANE="$2"; shift 2 ;;
    # Biến môi trường chỉ áp cho lần chạy này. Pane không giữ lại giá trị sau khi script kết thúc.
    --env) export "$2"; shift 2 ;;
    --) shift; TEST_COMMAND=("$@"); break ;;
    *) echo "Tham số không hợp lệ: $1"; exit 2 ;;
  esac
done

if [ -z "$RUN_NAME" ] || [ -z "$OUTPUT_DIRECTORY" ] || [ ${#TEST_COMMAND[@]} -eq 0 ]; then
  echo "Thiếu --name, --out hoặc lệnh test sau --."
  exit 2
fi

mkdir -p "$OUTPUT_DIRECTORY"
START_FILE="$OUTPUT_DIRECTORY/$RUN_NAME-start.txt"
EXIT_FILE="$OUTPUT_DIRECTORY/$RUN_NAME-exit.txt"
LOG_FILE="$OUTPUT_DIRECTORY/$RUN_NAME.log"
# Xóa kết quả cũ cùng tên. Reviewer không đọc nhầm file của lần chạy trước.
rm -f "$EXIT_FILE"
date '+%Y-%m-%d %H:%M:%S' > "$START_FILE"

# Ctrl+C chỉ đánh dấu lần chạy bị ngắt. Script vẫn ghi file kết quả nhưng không nhắn reviewer là đã xong.
INTERRUPTED=0
trap 'INTERRUPTED=1' INT

if [ "${TEST_COMMAND[0]}" = "dotnet" ] && [ "${TEST_COMMAND[1]:-}" = "test" ]; then
  # `dotnet test` chạy qua test-progress để pane hiện thanh phần trăm.
  node "$SCRIPT_DIRECTORY/test-progress.mjs" run --name "$RUN_NAME" -- "${TEST_COMMAND[@]:1}"
  EXIT_CODE=$?
  LOG_FILE="$(node -e 'console.log(require("path").join(require("os").tmpdir(), "test-progress", process.argv[1] + ".log"))' "$RUN_NAME")"
elif [[ " ${TEST_COMMAND[*]} " == *" test:e2e "* || " ${TEST_COMMAND[*]} " == *" playwright "* ]]; then
  # Playwright chạy qua playwright-progress: pane chỉ hiện một dòng `đã xong/tổng` kèm giờ chạy. Log đầy đủ nằm ở $LOG_FILE.
  node "$SCRIPT_DIRECTORY/playwright-progress.mjs" --name "$RUN_NAME" --out "$OUTPUT_DIRECTORY" -- "${TEST_COMMAND[@]}"
  EXIT_CODE=$?
else
  # Công cụ test khác không có thanh phần trăm. Log vẫn hiện trong pane và được lưu vào file.
  "${TEST_COMMAND[@]}" 2>&1 | tee "$LOG_FILE"
  EXIT_CODE=${PIPESTATUS[0]}
fi

{
  echo "EXIT=$EXIT_CODE"
  date '+%Y-%m-%d %H:%M:%S'
  echo "LOG=$LOG_FILE"
  if [ "$INTERRUPTED" = 1 ]; then echo "INTERRUPTED=1"; fi
} > "$EXIT_FILE"

if [ "$INTERRUPTED" = 1 ]; then
  echo "Lần chạy bị ngắt. Không nhắn reviewer."
  exit "$EXIT_CODE"
fi

if [ -n "$NOTIFY_PANE" ]; then
  herdr agent prompt "$NOTIFY_PANE" "XONG test $RUN_NAME (EXIT=$EXIT_CODE), xem $EXIT_FILE"
fi
exit "$EXIT_CODE"

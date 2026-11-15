#!/usr/bin/env node
// Chạy lệnh Playwright và chỉ hiện một dòng tiến trình (số test xong trên tổng, thời gian chạy), không in log.
//
// Cách dùng:
//   node playwright-progress.mjs --name <tên> [--out <thư mục log>] -- pnpm test:e2e [tham số]
//
// Log đầy đủ (kể cả log của API do webServer in ra) ghi vào <thư mục log>/<tên>.log.
// Script đặt reporter riêng qua `--reporter`. Reporter `list` (ghi chi tiết lỗi vào log) và `html` vẫn chạy cùng.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REFRESH_MS = 500;
const BAR_WIDTH = 24;
// Khi output không phải terminal (agent đọc log), in một dòng mỗi 5% hoặc mỗi phút để không ngập log.
const PLAIN_PERCENT_STEP = 5;
const PLAIN_INTERVAL_MS = 60_000;

main();

function main() {
  const args = process.argv.slice(2);
  const separatorIndex = args.indexOf("--");
  if (separatorIndex < 0 || separatorIndex === args.length - 1) {
    console.error("Cách dùng: node playwright-progress.mjs --name <tên> [--out <thư mục>] -- <lệnh Playwright>");
    process.exit(2);
  }

  const ownArgs = args.slice(0, separatorIndex);
  const command = args.slice(separatorIndex + 1);
  const runName = readOption(ownArgs, "--name") ?? "playwright";
  const outputDirectory = readOption(ownArgs, "--out") ?? path.join(os.tmpdir(), "test-progress");
  fs.mkdirSync(outputDirectory, { recursive: true });

  const logFile = path.join(outputDirectory, `${runName}.log`);
  const statusFile = path.join(outputDirectory, `${runName}-progress.json`);
  fs.rmSync(statusFile, { force: true });

  const reporterPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "playwright-reporter.mjs");
  // Lệnh đã tự đặt reporter thì giữ nguyên lựa chọn đó, và dòng tiến trình chỉ hiện thời gian.
  const hasOwnReporter = command.some((part) => part.startsWith("--reporter"));
  const fullCommand = hasOwnReporter ? command : [...command, `--reporter=${reporterPath},list,html`];

  const logStream = fs.createWriteStream(logFile);
  const startedAt = Date.now();
  // shell: true để chạy được `pnpm` (file .cmd trên Windows). Mọi phần của lệnh do người gọi tin cậy đưa vào.
  const child = spawn(fullCommand.map(quoteForShell).join(" "), {
    shell: true,
    env: { ...process.env, PW_PROGRESS_FILE: statusFile, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });

  const isTerminal = Boolean(process.stdout.isTTY);
  let lastPlainPercent = -PLAIN_PERCENT_STEP;
  let lastPlainAt = 0;

  const timer = setInterval(() => {
    const status = readStatus(statusFile);
    const elapsed = formatElapsed(Date.now() - startedAt);
    if (isTerminal) {
      drawLine(renderLine(status, elapsed));
      return;
    }
    // Không phải terminal: in thưa.
    const percent = status && status.total > 0 ? Math.floor((status.done / status.total) * 100) : 0;
    const now = Date.now();
    if (percent >= lastPlainPercent + PLAIN_PERCENT_STEP || now - lastPlainAt >= PLAIN_INTERVAL_MS) {
      lastPlainPercent = percent - (percent % PLAIN_PERCENT_STEP);
      lastPlainAt = now;
      console.log(renderLine(status, elapsed));
    }
  }, REFRESH_MS);

  const finish = (exitCode) => {
    clearInterval(timer);
    logStream.end();
    const status = readStatus(statusFile);
    if (isTerminal) process.stdout.write("\r\x1b[2K");
    console.log(renderLine(status, formatElapsed(Date.now() - startedAt)));
    if (status && status.failedTests.length > 0) {
      console.log(`Test đỏ (${status.failedTests.length}):`);
      for (const name of status.failedTests) console.log(`  - ${name}`);
    }
    console.log(`Log đầy đủ: ${logFile}`);
    process.exit(exitCode);
  };

  child.on("error", (error) => {
    console.error(`Không chạy được lệnh: ${error.message}`);
    finish(1);
  });
  child.on("close", (code) => finish(code ?? 1));
  // Ctrl+C ở pane: dừng lệnh con và thoát với mã 130.
  process.on("SIGINT", () => {
    child.kill();
    finish(130);
  });
}

// ---------- Hiển thị ----------

function renderLine(status, elapsed) {
  if (!status || status.total === 0) {
    return `Đang khởi động (dựng API và DB)  ${elapsed}`;
  }
  const ratio = Math.min(status.done / status.total, 1);
  const filled = Math.round(ratio * BAR_WIDTH);
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const counts = `${status.done}/${status.total}`;
  const failed = status.failed > 0 ? `  đỏ ${status.failed}` : "";
  const skipped = status.skipped > 0 ? `  bỏ qua ${status.skipped}` : "";
  const current = status.finished || !status.current ? "" : `  ${status.current}`;
  const line = `${bar} ${counts} (${Math.floor(ratio * 100)}%)${failed}${skipped}  ${elapsed}${current}`;
  return line;
}

function drawLine(line) {
  const width = process.stdout.columns ?? 100;
  // Cắt cho vừa một dòng. Dòng tràn xuống hàng thì lần vẽ sau không xóa được phần dư.
  const fitted = line.length > width - 1 ? `${line.slice(0, width - 2)}…` : line;
  process.stdout.write(`\r\x1b[2K${fitted}`);
}

function formatElapsed(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

// ---------- Tiện ích ----------

function readStatus(statusFile) {
  try {
    return JSON.parse(fs.readFileSync(statusFile, "utf8"));
  } catch {
    // File chưa có hoặc đang được thay: coi như chưa có số liệu.
    return null;
  }
}

function readOption(args, optionName) {
  const index = args.indexOf(optionName);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined;
}

// Bọc tham số có khoảng trắng hoặc ký tự đặc biệt để shell không tách sai. Đường dẫn Windows giữ nguyên dấu gạch chéo.
function quoteForShell(part) {
  return /^[\w@%+=:,./\\-]+$/.test(part) ? part : `"${part.replace(/"/g, '\\"')}"`;
}

#!/usr/bin/env node
// Chạy `dotnet test` kèm thanh tiến trình, và xem tiến trình từ một terminal khác.
//
// Cách dùng:
//   node scripts/test-progress.mjs run [--name <tên>] -- <tham số của dotnet test>
//   node scripts/test-progress.mjs watch [<tên>]
//
// Ví dụ:
//   node scripts/test-progress.mjs run --name sd05 -- test apps/backend/tests/Pickory.IntegrationTests --filter "FullyQualifiedName~.SupportDesk."
//   node scripts/test-progress.mjs watch sd05

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Thư mục chung cho file trạng thái, để lệnh `watch` ở terminal khác tìm được lần chạy.
const STATUS_DIRECTORY = path.join(os.tmpdir(), "test-progress");
const TOTAL_CACHE_FILE = path.join(STATUS_DIRECTORY, "total-cache.json");
const BAR_WIDTH = 30;

// Khi output không phải terminal (job nền của agent), in một dòng mỗi 5% hoặc mỗi phút. In mỗi test sẽ làm ngập log.
const PLAIN_OUTPUT_PERCENT_STEP = 5;
const PLAIN_OUTPUT_INTERVAL_MS = 60_000;
const WATCH_REFRESH_MS = 1_000;

// Dòng kết quả của VSTest ở mức `normal`, ví dụ `  Passed Pickory.X.Y [12 ms]`.
const RESULT_LINE_PATTERN = /^\s+(Passed|Failed|Skipped)\s+(\S.*?)(?:\s+\[[^\]]*\])?\s*$/;
// Dòng tổng của `dotnet test` ở mức `normal`, ví dụ `Total tests: 157`. Đây là số kết quả thật, dùng cho lần chạy sau.
const SUMMARY_TOTAL_PATTERN = /^\s*Total tests:\s+(\d+)\s*$/;
// Dòng tổng kết ở mức mặc định, ví dụ `Passed!  - Failed: 0, ..., Total: 2477`. Giữ để đọc được cả hai dạng.
const SUMMARY_LINE_PATTERN = /(Passed|Failed)!\s+-\s+Failed:\s+\d+,\s+Passed:\s+\d+,\s+Skipped:\s+\d+,\s+Total:\s+(\d+)/;

main();

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "run") {
    runTests(rest);
    return;
  }
  if (command === "watch") {
    watchRun(rest[0]);
    return;
  }

  console.log("Cách dùng:");
  console.log("  node scripts/test-progress.mjs run [--name <tên>] -- <tham số của dotnet test>");
  console.log("  node scripts/test-progress.mjs watch [<tên>]");
  process.exit(command ? 1 : 0);
}

// ---------- Lệnh run ----------

function runTests(args) {
  const separatorIndex = args.indexOf("--");
  if (separatorIndex < 0) {
    fail("Thiếu `--` trước tham số của dotnet test.");
  }

  const ownArgs = args.slice(0, separatorIndex);
  const dotnetArgs = args.slice(separatorIndex + 1);
  const runName = readOption(ownArgs, "--name") ?? path.basename(process.cwd());
  const projectPath = findProjectPath(dotnetArgs);
  const filter = readOption(dotnetArgs, "--filter");

  fs.mkdirSync(STATUS_DIRECTORY, { recursive: true });
  const statusFile = path.join(STATUS_DIRECTORY, `${runName}.json`);
  const logFile = path.join(STATUS_DIRECTORY, `${runName}.log`);
  const cacheKey = createCacheKey(projectPath, filter);

  const status = {
    name: runName,
    command: ["dotnet", ...dotnetArgs].join(" "),
    log: logFile,
    phase: "build",
    total: null,
    totalIsEstimate: true,
    passed: 0,
    failed: 0,
    skipped: 0,
    failedTests: [],
    startedAt: Date.now(),
    firstResultAt: null,
    updatedAt: Date.now(),
    finished: false,
    exitCode: null,
  };
  writeStatus(statusFile, status);
  console.log(`Log đầy đủ: ${logFile}`);
  console.log(`Xem tiến trình ở terminal khác: node ${scriptPath()} watch ${runName}`);

  // Build trước để biết đường dẫn DLL. Bước đếm test cần DLL mới nhất.
  const buildExitCode = buildProject(projectPath, logFile);
  if (buildExitCode !== 0) {
    finishRun(statusFile, status, buildExitCode);
    fail(`Build lỗi. Xem ${logFile}`, buildExitCode);
  }

  // Ưu tiên tổng thật của lần chạy trước. Số test lúc phát hiện thấp hơn số kết quả khi test có nhiều bộ dữ liệu.
  const cachedTotal = readCachedTotal(cacheKey);
  if (cachedTotal) {
    status.total = cachedTotal;
    status.totalIsEstimate = false;
  } else {
    status.total = countDiscoveredTests(projectPath, filter);
    status.totalIsEstimate = true;
  }

  status.phase = "test";
  writeStatus(statusFile, status);
  startDotnetTest(dotnetArgs, statusFile, status, logFile, cacheKey);
}

function buildProject(projectPath, logFile) {
  console.log(`Đang build ${projectPath}...`);
  const result = spawnSync("dotnet", ["build", projectPath, "-nologo", "-v", "q"], { encoding: "utf8" });
  fs.writeFileSync(logFile, (result.stdout ?? "") + (result.stderr ?? ""));
  return result.status ?? 1;
}

// Đếm test khớp bộ lọc mà không chạy test. Lệnh này không đụng DB.
function countDiscoveredTests(projectPath, filter) {
  const dllPath = readTargetPath(projectPath);
  if (!dllPath) {
    return null;
  }

  const listFile = path.join(STATUS_DIRECTORY, `list-${process.pid}.txt`);
  const listArgs = [ "vstest", dllPath, "--ListFullyQualifiedTests", `--ListTestsTargetPath:${listFile}` ];
  if (filter) {
    listArgs.push(`--TestCaseFilter:${filter}`);
  }
  spawnSync("dotnet", listArgs, { encoding: "utf8" });

  // Không đếm được thì vẫn chạy test. Thanh tiến trình chỉ hiện số test đã xong.
  if (!fs.existsSync(listFile)) {
    return null;
  }
  const testCount = fs.readFileSync(listFile, "utf8").split(/\r?\n/).filter((line) => line.trim()).length;
  fs.rmSync(listFile, { force: true });
  return testCount > 0 ? testCount : null;
}

function readTargetPath(projectPath) {
  const result = spawnSync("dotnet", ["msbuild", projectPath, "-getProperty:TargetPath", "-nologo"], { encoding: "utf8" });
  const targetPath = (result.stdout ?? "").trim();
  return targetPath && fs.existsSync(targetPath) ? targetPath : null;
}

function startDotnetTest(dotnetArgs, statusFile, status, logFile, cacheKey) {
  // Mức `normal` in một dòng cho mỗi test đạt. Mức mặc định chỉ in test lỗi, nên không đếm được tiến độ.
  const testArgs = [...dotnetArgs, "--no-build", "--logger", "console;verbosity=normal"];
  const child = spawn("dotnet", testArgs, { stdio: ["inherit", "pipe", "pipe"] });
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  const progressPrinter = createProgressPrinter();
  let pendingText = "";

  const handleChunk = (chunk) => {
    const text = chunk.toString("utf8");
    logStream.write(text);
    // Chunk có thể cắt giữa dòng. Giữ phần cuối chưa trọn dòng cho lần đọc sau.
    pendingText += text;
    const lines = pendingText.split(/\r?\n/);
    pendingText = lines.pop() ?? "";
    for (const line of lines) {
      handleOutputLine(line, status, progressPrinter);
    }
    status.updatedAt = Date.now();
    writeStatus(statusFile, status);
    progressPrinter.update(status);
  };

  child.stdout.on("data", handleChunk);
  child.stderr.on("data", handleChunk);
  child.on("close", (exitCode) => {
    if (pendingText) {
      handleOutputLine(pendingText, status, progressPrinter);
    }
    logStream.end();
    const finalExitCode = exitCode ?? 1;
    // Chỉ nhớ tổng thật khi `dotnet test` chạy hết. Lần chạy bị ngắt cho tổng sai.
    if (status.summaryTotal) {
      writeCachedTotal(cacheKey, status.summaryTotal);
    }
    finishRun(statusFile, status, finalExitCode);
    progressPrinter.finish(status);
    process.exit(finalExitCode);
  });
}

function handleOutputLine(line, status, progressPrinter) {
  const summary = SUMMARY_TOTAL_PATTERN.exec(line) ?? SUMMARY_LINE_PATTERN.exec(line);
  if (summary) {
    status.summaryTotal = Number(summary.at(-1));
    progressPrinter.printLine(line.trim());
    return;
  }

  const result = RESULT_LINE_PATTERN.exec(line);
  if (!result) {
    // Lỗi build hay lỗi khởi động không có dạng dòng kết quả. Vẫn in ra để người xem thấy lý do.
    // Bỏ qua dòng log JSON của API. Test cố ý gây lỗi cũng ghi log có chữ "error".
    const isApiJsonLog = line.trimStart().startsWith("{");
    if (!isApiJsonLog && /\berror\b/i.test(line) && !/^\s+at /.test(line)) {
      progressPrinter.printLine(line.trim());
    }
    return;
  }

  status.firstResultAt ??= Date.now();
  const [, outcome, testName] = result;
  if (outcome === "Passed") {
    status.passed += 1;
    return;
  }
  if (outcome === "Skipped") {
    status.skipped += 1;
    return;
  }

  status.failed += 1;
  status.failedTests.push(testName);
  // Test lỗi in ngay, không chờ hết suite. Người xem có thể dừng sớm nếu cần.
  progressPrinter.printLine(`LỖI: ${testName}`);
}

function finishRun(statusFile, status, exitCode) {
  status.finished = true;
  status.exitCode = exitCode;
  status.updatedAt = Date.now();
  writeStatus(statusFile, status);
}

// In tiến trình theo loại output. Terminal thật vẽ lại một dòng, job nền nhận dòng mới theo từng nấc.
function createProgressPrinter() {
  const isTerminal = Boolean(process.stdout.isTTY);
  let lastPrintedStep = -1;
  let lastPrintedAt = 0;

  return {
    update(status) {
      if (isTerminal) {
        process.stdout.write(`\r${formatProgressLine(status)}\x1b[K`);
        return;
      }
      const percent = calculatePercent(status) ?? 0;
      const step = Math.floor(percent / PLAIN_OUTPUT_PERCENT_STEP);
      const now = Date.now();
      if (step > lastPrintedStep || now - lastPrintedAt >= PLAIN_OUTPUT_INTERVAL_MS) {
        lastPrintedStep = step;
        lastPrintedAt = now;
        console.log(formatProgressLine(status));
      }
    },
    printLine(text) {
      // Xóa dòng tiến trình trước khi in, để chữ không đè lên thanh.
      if (isTerminal) {
        process.stdout.write("\r\x1b[K");
      }
      console.log(text);
    },
    finish(status) {
      if (isTerminal) {
        process.stdout.write("\r\x1b[K");
      }
      console.log(formatProgressLine(status));
      printFailedTests(status);
    },
  };
}

// ---------- Lệnh watch ----------

function watchRun(runName) {
  const statusFile = runName ? path.join(STATUS_DIRECTORY, `${runName}.json`) : findLatestStatusFile();
  if (!statusFile || !fs.existsSync(statusFile)) {
    fail(runName ? `Không thấy lần chạy tên ${runName} trong ${STATUS_DIRECTORY}.` : `Chưa có lần chạy nào trong ${STATUS_DIRECTORY}.`);
  }

  const isTerminal = Boolean(process.stdout.isTTY);
  const render = () => {
    const status = readStatus(statusFile);
    // File có thể đang được ghi dở. Bỏ qua lần đọc này, lần sau đọc lại.
    if (!status) {
      return;
    }
    if (isTerminal) {
      process.stdout.write(`\r${formatProgressLine(status)}\x1b[K`);
    }
    if (status.finished) {
      if (!isTerminal) {
        console.log(formatProgressLine(status));
      }
      console.log("");
      printFailedTests(status);
      process.exit(status.exitCode ?? 0);
    }
  };

  const firstStatus = readStatus(statusFile);
  console.log(`Lần chạy: ${firstStatus?.name ?? statusFile}`);
  console.log(`Lệnh: ${firstStatus?.command ?? "?"}`);
  console.log(`Log: ${firstStatus?.log ?? "?"}`);
  render();
  setInterval(render, WATCH_REFRESH_MS);
}

function findLatestStatusFile() {
  if (!fs.existsSync(STATUS_DIRECTORY)) {
    return null;
  }
  const statusFiles = fs.readdirSync(STATUS_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".json") && fileName !== path.basename(TOTAL_CACHE_FILE))
    .map((fileName) => path.join(STATUS_DIRECTORY, fileName));
  statusFiles.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  return statusFiles[0] ?? null;
}

// ---------- Định dạng ----------

function formatProgressLine(status) {
  const done = status.passed + status.failed + status.skipped;
  const elapsed = formatDuration(Date.now() - status.startedAt);
  const counts = `đạt ${status.passed} · lỗi ${status.failed} · bỏ qua ${status.skipped}`;

  if (status.phase === "build") {
    return `Đang build... ${elapsed}`;
  }
  if (status.finished) {
    const verdict = status.exitCode === 0 ? "XONG, xanh" : `XONG, mã thoát ${status.exitCode}`;
    return `${verdict} · ${done} kết quả · ${counts} · ${elapsed}`;
  }

  const percent = calculatePercent(status);
  if (percent === null) {
    return `${done} test xong · ${counts} · ${elapsed}`;
  }

  const filledWidth = Math.round((percent / 100) * BAR_WIDTH);
  const bar = "█".repeat(filledWidth) + "░".repeat(BAR_WIDTH - filledWidth);
  // Tổng lấy từ lúc phát hiện test chỉ là ước tính, nên đánh dấu `~` để người xem biết.
  const totalLabel = status.totalIsEstimate ? `~${status.total}` : `${status.total}`;
  const remaining = estimateRemaining(status, done);
  const remainingLabel = remaining === null ? "" : ` · còn ~${formatDuration(remaining)}`;
  return `[${bar}] ${percent.toFixed(0)}% ${done}/${totalLabel} · ${counts} · ${elapsed}${remainingLabel}`;
}

function calculatePercent(status) {
  if (!status.total) {
    return null;
  }
  const done = status.passed + status.failed + status.skipped;
  // Tổng ước tính có thể thấp hơn số kết quả thật. Giữ ở 99% tới khi `dotnet test` kết thúc.
  return Math.min(99, (done / status.total) * 100);
}

// Tính tốc độ từ kết quả đầu tiên. Thời gian build và dựng DB test không phản ánh tốc độ chạy test.
function estimateRemaining(status, done) {
  if (!status.firstResultAt || done < 5 || !status.total || done >= status.total) {
    return null;
  }
  const millisecondsPerTest = (Date.now() - status.firstResultAt) / done;
  return millisecondsPerTest * (status.total - done);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

function printFailedTests(status) {
  if (status.failedTests.length === 0) {
    return;
  }
  console.log("Test lỗi:");
  for (const testName of status.failedTests) {
    console.log(`  ${testName}`);
  }
  console.log(`Chi tiết lỗi ở ${status.log}`);
}

// ---------- File trạng thái và bộ nhớ tổng ----------

function writeStatus(statusFile, status) {
  // Ghi file tạm rồi đổi tên. Lệnh `watch` không đọc phải file ghi dở.
  const temporaryFile = `${statusFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(status));
  fs.renameSync(temporaryFile, statusFile);
}

function readStatus(statusFile) {
  try {
    return JSON.parse(fs.readFileSync(statusFile, "utf8"));
  } catch {
    return null;
  }
}

// Khóa theo project và bộ lọc. Bộ lọc khác cho tổng khác.
function createCacheKey(projectPath, filter) {
  return createHash("sha1").update(`${path.resolve(projectPath)}|${filter ?? ""}`).digest("hex");
}

function readCachedTotal(cacheKey) {
  try {
    const cache = JSON.parse(fs.readFileSync(TOTAL_CACHE_FILE, "utf8"));
    return cache[cacheKey] ?? null;
  } catch {
    return null;
  }
}

function writeCachedTotal(cacheKey, total) {
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(TOTAL_CACHE_FILE, "utf8"));
  } catch {
    // Chưa có file nhớ, hoặc file hỏng. Tạo lại từ đầu.
  }
  cache[cacheKey] = total;
  fs.writeFileSync(TOTAL_CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ---------- Đọc tham số ----------

function readOption(args, optionName) {
  const index = args.indexOf(optionName);
  return index >= 0 ? args[index + 1] : undefined;
}

// Tham số đầu tiên không bắt đầu bằng `-` sau chữ `test` là project. Không có thì dùng thư mục hiện tại.
function findProjectPath(dotnetArgs) {
  const testIndex = dotnetArgs.indexOf("test");
  const candidate = dotnetArgs[testIndex + 1];
  return candidate && !candidate.startsWith("-") ? candidate : ".";
}

function scriptPath() {
  return process.argv[1].replaceAll("\\", "/");
}

function fail(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

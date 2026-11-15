// Reporter của Playwright cho `playwright-progress.mjs`.
// Reporter không in gì ra terminal. Mỗi lần có thay đổi, nó ghi số liệu vào file JSON mà `playwright-progress.mjs` đọc.
import fs from "node:fs";
import path from "node:path";

export default class ProgressReporter {
  constructor() {
    // File trạng thái do playwright-progress.mjs đặt qua biến môi trường.
    this.statusFile = process.env.PW_PROGRESS_FILE;
    this.status = {
      total: 0,
      done: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      current: "",
      failedTests: [],
      finished: false,
    };
  }

  // Reporter không in ra terminal, nhưng trả true để Playwright không tự thêm reporter mặc định.
  printsToStdio() {
    return true;
  }

  onBegin(_config, suite) {
    this.status.total = suite.allTests().length;
    this.write();
  }

  onTestBegin(test) {
    this.status.current = describeTest(test);
    this.write();
  }

  onTestEnd(test, result) {
    // Lần chạy lại chưa phải kết quả cuối của test. Chỉ đếm khi test hết lượt chạy lại.
    const willRetry = result.status !== "passed" && result.status !== "skipped" && result.retry < test.retries;
    if (willRetry) return;

    this.status.done += 1;
    if (result.status === "passed") {
      this.status.passed += 1;
    } else if (result.status === "skipped") {
      this.status.skipped += 1;
    } else {
      this.status.failed += 1;
      this.status.failedTests.push(describeTest(test));
    }
    this.write();
  }

  onEnd() {
    this.status.finished = true;
    this.write();
  }

  write() {
    if (!this.statusFile) return;
    // Ghi thẳng vào file trạng thái. Trên Windows, đổi tên file đang được bên đọc mở sẽ lỗi `EPERM`, và lỗi này làm cả lần chạy test thất bại.
    // Bên đọc tự bỏ qua file ghi dở, nên lỗi ghi một lần chỉ làm dòng tiến trình chậm một nhịp. Reporter không được ném lỗi.
    try {
      fs.writeFileSync(this.statusFile, JSON.stringify(this.status));
    } catch {
      // Bỏ qua lần ghi này, lần ghi sau sẽ cập nhật lại.
    }
  }
}

function describeTest(test) {
  return `${path.basename(test.location.file)}: ${test.title}`;
}

# Chạy lệnh chậm

File này là phần chi tiết của luật chạy test 5 trong `SKILL.md`. Đọc file này trước khi chạy lệnh chậm (integration, E2E). Builder chạy lệnh chậm thì file giao việc chép các yêu cầu ở đây.

Lệnh chậm chạy không có giới hạn thời gian. Agent ngắt lệnh giữa chừng thì không có kết quả, và tiến trình test còn sót lại làm hỏng lần chạy sau.

## Reviewer chạy trong pane test-runner

Reviewer chạy lệnh chậm trong một pane Herdr riêng, không dùng lệnh nền của agent. Agent có thể tự dừng lệnh nền khi máy thiếu RAM. Agent không dừng được tiến trình trong pane khác.

1. Tìm pane có `"label":"test-runner"` trong kết quả của `herdr pane list`. Có rồi thì dùng lại `pane_id` của pane đó.
2. Chưa có thì tạo pane bằng `herdr pane split --current --direction down --ratio 0.3 --cwd "$PWD" --no-focus`. Lấy `pane_id` từ kết quả.
3. Đặt tên pane mới bằng `herdr pane rename <pane_id> test-runner`. Lệnh `herdr pane` chỉ nhận `pane_id`, không nhận tên.
4. Chạy lệnh test qua script `scripts/run-slow-test.sh` trong thư mục của skill, bằng `herdr pane run <pane_id> "<lệnh>"`.
   - Script ghi giờ bắt đầu, mã thoát và log vào thư mục trao đổi.
   - Script chạy được với mọi công cụ test (bảng "Lệnh theo công cụ test" bên dưới). `dotnet test` chạy qua `scripts/test-progress.mjs` và Playwright qua `scripts/playwright-progress.mjs`, nên pane hiện phần trăm. Công cụ khác chạy thẳng: log hiện trong pane và được lưu vào file, không có thanh phần trăm.
   - Lệnh xong thì script nhắn reviewer `XONG test <tên> (EXIT=<mã>)` qua `--notify`. Bấm Ctrl+C thì script không nhắn.
   - Truyền `--notify` bằng pane id của reviewer (`"$HERDR_PANE_ID"`), không dùng tên `reviewer`. Herdr gắn tên vào phiên của agent, nên tên mất khi phiên đổi (ví dụ sau `/clear` hay đổi model), và tin `XONG test` bị mất theo.
   - Pane chạy PowerShell trên Windows thì gọi script bằng `& "C:\Program Files\Git\bin\bash.exe" <script> <tham số>` (xem mục "Gọi script trên Windows").
5. Kết thúc lượt và chờ tin `XONG test`. Đọc file `<tên>-exit.txt` để lấy mã thoát trước khi kết luận.

Ví dụ (thay phần sau `--` bằng lệnh test của repo):

```bash
bash "<thư mục skill>/scripts/run-slow-test.sh" --name <task>-full --out "<thư mục trao đổi>" \
  --notify "$HERDR_PANE_ID" --env TEST_DATABASE_URL=<DB test> -- <lệnh test>
```

### Lệnh theo công cụ test

Lấy lệnh test thật từ file luật của repo (`CLAUDE.md`, `AGENTS.md`), README hoặc CI. Bảng này chỉ gợi ý dạng lệnh.

| Công cụ | Lệnh sau `--` | Pane hiện |
|---|---|---|
| .NET | `dotnet test <project>` | thanh phần trăm |
| Playwright | `pnpm test:e2e` hoặc `npx playwright test` | dòng `đã xong/tổng` |
| pytest | `python -m pytest -q <thư mục>` (venv Windows: `.venv\Scripts\python.exe -m pytest -q <thư mục>`) | log |
| Jest, Vitest, Mocha | `npx jest`, `npx vitest run`, `npx mocha` | log |
| Go | `go test ./...` | log |
| Rust | `cargo test` | log |
| Java | `./mvnw test`, `./gradlew test` | log |
| Ruby, PHP | `bundle exec rspec`, `vendor/bin/phpunit` | log |
| Công cụ khác | lệnh nào chạy bộ test | log |

Điều kiện chung: lệnh phải thoát với mã khác 0 khi có test đỏ, vì reviewer đọc `EXIT` để kết luận. Công cụ có chế độ theo dõi (`--watch`) thì tắt nó, vì lệnh không bao giờ thoát.

### Gọi script trên Windows

- Pane chạy PowerShell thì gọi bằng `& "C:\Program Files\Git\bin\bash.exe" "<đường dẫn script>" <tham số>`. Đường dẫn script dùng dấu `/` hoặc đặt trong ngoặc kép.
- Cú pháp `VAR=x lệnh` không có trong PowerShell. Dùng `--env VAR=x` của script.
- Lệnh `tail -f` không có trong PowerShell. Muốn xem log đang chạy thì dùng `Get-Content -Wait -Tail 20 "<đường dẫn log>"`.

Người dùng muốn xem tiến độ từ terminal khác thì chạy `node "<thư mục skill>/scripts/test-progress.mjs" watch <tên>`.

Tổng số kết quả của lần chạy đầu chỉ là ước tính. `test-progress.mjs` đếm test lúc phát hiện, và test có nhiều bộ dữ liệu cho nhiều kết quả hơn. Từ lần chạy sau, công cụ dùng tổng thật đã ghi nhớ.

## Tắt hạn chót khi builder chạy

- Builder là Claude Code: chạy nền bằng `run_in_background`. Không tách tiến trình bằng `( lệnh & )`: hệ thống không theo dõi được nên không ai báo khi test xong. Lệnh nền của Claude Code không có hạn chót, nhưng có thể bị dừng khi máy thiếu RAM.
- omp: cần file `~/.omp/agent/extensions/bash-no-timeout.ts`. Extension này đổi `timeout` của mọi lệnh bash thành `0`, giá trị omp dùng để tắt hạn chót.
  - Thiếu file này thì omp ngắt lệnh sau 300 giây, kể cả lệnh chạy nền.
  - Mở lại phiên omp sau khi thêm file. omp chỉ nạp extension khi phiên bắt đầu.
- Agent khác: truyền giá trị tắt hạn chót của agent đó. Không biết giá trị đó thì hỏi người dùng.

## Dọn tiến trình sót lại

- Trước mỗi lần chạy lệnh chậm, kiểm tra không còn tiến trình test của lần chạy trước. Ví dụ trên Windows: `tasklist //FI "IMAGENAME eq testhost.exe"` (.NET), `python.exe` (pytest), `node.exe` (Jest, Vitest), `java.exe` (Maven, Gradle). Linux và macOS: `pgrep -fl <tên công cụ>`. Chỉ dừng tiến trình do lần chạy test trước để lại, không dừng tiến trình của việc khác.
- Còn tiến trình sót lại thì dừng nó trước khi chạy. Tiến trình sót lại có thể giữ khóa DB test và khóa file build.

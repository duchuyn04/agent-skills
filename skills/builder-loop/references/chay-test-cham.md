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
   - Lệnh `dotnet test` chạy qua `scripts/test-progress.mjs`, nên pane hiện thanh phần trăm. Công cụ test khác chạy thẳng, không có thanh phần trăm.
   - Lệnh xong thì script nhắn reviewer `XONG test <tên> (EXIT=<mã>)` qua `--notify`. Bấm Ctrl+C thì script không nhắn.
   - Pane chạy PowerShell trên Windows thì gọi script bằng `& "C:\Program Files\Git\bin\bash.exe" <script> <tham số>`.
5. Kết thúc lượt và chờ tin `XONG test`. Đọc file `<tên>-exit.txt` để lấy mã thoát trước khi kết luận.

Ví dụ:

```bash
bash "<thư mục skill>/scripts/run-slow-test.sh" --name <task>-full --out "<thư mục trao đổi>" \
  --notify reviewer --env TEST_DATABASE_URL=<DB test> -- dotnet test <project integration>
```

Người dùng muốn xem tiến độ từ terminal khác thì chạy `node "<thư mục skill>/scripts/test-progress.mjs" watch <tên>`.

Tổng số kết quả của lần chạy đầu chỉ là ước tính. `test-progress.mjs` đếm test lúc phát hiện, và test có nhiều bộ dữ liệu cho nhiều kết quả hơn. Từ lần chạy sau, công cụ dùng tổng thật đã ghi nhớ.

## Tắt hạn chót khi builder chạy

- Builder là Claude Code: chạy nền bằng `run_in_background`. Lệnh nền của Claude Code không có hạn chót, nhưng có thể bị dừng khi máy thiếu RAM.
- omp: cần file `~/.omp/agent/extensions/bash-no-timeout.ts`. Extension này đổi `timeout` của mọi lệnh bash thành `0`, giá trị omp dùng để tắt hạn chót.
  - Thiếu file này thì omp ngắt lệnh sau 300 giây, kể cả lệnh chạy nền.
  - Mở lại phiên omp sau khi thêm file. omp chỉ nạp extension khi phiên bắt đầu.
- Agent khác: truyền giá trị tắt hạn chót của agent đó. Không biết giá trị đó thì hỏi người dùng.

## Dọn tiến trình sót lại

- Trước mỗi lần chạy lệnh chậm, kiểm tra không còn tiến trình test của lần chạy trước. Ví dụ với .NET trên Windows: `tasklist //FI "IMAGENAME eq testhost.exe"`.
- Còn tiến trình sót lại thì dừng nó trước khi chạy. Tiến trình sót lại có thể giữ khóa DB test và khóa file build.

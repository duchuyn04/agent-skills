# Script điều phối loop.mjs

## Tóm tắt

`scripts/loop.mjs` làm thay reviewer những việc lặp lại ở mọi task: chụp lại code của builder sau mỗi lượt, nhớ vòng lặp đang ở bước nào, dừng vòng lặp khi builder sửa mãi không xong, viết sẵn phần cố định của file giao việc, nhắc reviewer khi builder bị treo, thống kê và xếp hàng nhiều task.

Script không đổi file nào trong thư mục làm việc và không đổi danh sách stage của repo. Mọi thứ nó ghi nằm ở hai chỗ:

- Ảnh chụp review: `refs/review/<task>/<N>` trong Git. Đây là commit nằm ngoài nhánh, không hiện trong `git log` và không bị push.
- File trạng thái: `<thư mục .git>/builder-loop/<task>.json` và `queue.json`. Thư mục `.git` không bị Git theo dõi, nên file không lẫn vào commit. File còn nguyên sau `/clear`, khi mở phiên mới hay khi khởi động lại máy.

Chạy mọi lệnh ở gốc repo, hoặc thêm `--repo <thư mục>`. Trong ví dụ, `<skill>` là thư mục chứa `SKILL.md`.

| Mã thoát | Ý nghĩa |
|---|---|
| 0 | bình thường |
| 1 | cầu dao ngắt, hoặc không tìm thấy thứ cần tìm (chưa có trạng thái, hàng đợi trống) |
| 2 | gọi sai lệnh hoặc hồ sơ hỏng |

## Ảnh chụp review: snapshot, diff, cleanup

Ảnh chụp giúp mỗi lượt review chỉ xem phần builder vừa sửa, không đọc lại cả task.

```bash
node "<skill>/scripts/loop.mjs" snapshot --task CAT-05
```

Lần đầu tạo lượt 0 (cha là `HEAD`), các lần sau tạo lượt kế tiếp (cha là lượt trước). Kết quả mong đợi: `Đã tạo ảnh chụp lượt 1: refs/review/CAT-05/1 = <hash> (3 file đổi so với lượt 0)`.

- Ảnh chụp chỉ lấy file trong phạm vi commit (khóa `scope`, `scopeExclude`, `noStage` trong mục `Kiểm tự động` của hồ sơ). File ngoài phạm vi giữ như `HEAD`.
- Lượt không đổi file nào thì script in `[CẢNH BÁO]`. Thường là builder báo xong mà chưa sửa gì.

```bash
node "<skill>/scripts/loop.mjs" diff --task CAT-05            # diff lượt mới nhất so với lượt trước
node "<skill>/scripts/loop.mjs" diff --task CAT-05 --stat     # chỉ liệt kê file và số dòng đổi
node "<skill>/scripts/loop.mjs" diff --task CAT-05 --round 2  # diff lượt 2 so với lượt 1
```

```bash
node "<skill>/scripts/loop.mjs" cleanup --task CAT-05
```

Xóa mọi ảnh chụp của task, kể cả lượt 0 và mốc `start` của `check-task`. Chạy sau khi commit. File trạng thái chuyển sang `xong` và được giữ lại cho thống kê.

## File trạng thái: state

```bash
node "<skill>/scripts/loop.mjs" state --task CAT-05 --set builderPane=w1:p2 --set reviewerPane=w1:p1 --set after=commit
node "<skill>/scripts/loop.mjs" state --task CAT-05 --set status=cho-builder
node "<skill>/scripts/loop.mjs" state --task CAT-05      # in trạng thái hiện tại
node "<skill>/scripts/loop.mjs" state --list             # liệt kê task đang dở
```

Lệnh `--set` đầu tiên tạo file nếu chưa có. Lệnh `snapshot` tự ghi số lượt, lệnh `handoff` tự ghi module, đường dẫn file giao việc và báo cáo.

| Khóa | Nội dung |
|---|---|
| `status` | bước hiện tại, xem bảng dưới |
| `builderPane`, `reviewerPane` | `pane_id` của builder và reviewer |
| `module` | module của task |
| `exchangeDir`, `handoff`, `report` | thư mục trao đổi, file giao việc, file báo cáo của builder |
| `after` | việc làm sau khi đạt: `chỉ báo cáo`, `commit` hoặc `commit và push` |
| `breaker` | `off` khi người dùng cho vòng lặp chạy tiếp mà không hỏi lại |
| `note` | ghi chú tự do, ví dụ câu hỏi đang chờ người dùng |

### Trạng thái và cách làm tiếp

Mỗi lần đổi `status`, script ghi kèm giờ. Bảng này cũng là cách làm tiếp khi người dùng gõ `/builder-loop <task> tiếp`.

| `status` | Nghĩa | Làm tiếp từ |
|---|---|---|
| `chuan-bi` | đang đọc tiêu chí, chưa giao việc | bước 4. Ảnh chụp 0 và mốc `start` đã có thì không tạo lại |
| `cho-builder` | đã gửi việc, chờ tin XONG | chạy `watch --once`. Báo cáo đã cập nhật thì coi như XONG và sang bước 10, không thì quay lại bước 9 |
| `dang-review` | đang review lượt hiện tại | bước 10 với lượt trong file trạng thái. Ảnh chụp của lượt đã có thì không tạo lại |
| `cho-nguoi-dung` | task đạt, chờ người dùng báo "ok" hoặc trả lời câu hỏi ở `note` | nhắc lại người dùng việc đang chờ |
| `commit` | đang commit sau khi người dùng báo "ok" | bước 14. Xem `git log -1` và `git status` để biết commit đã có chưa |
| `xong` | đã commit và dọn ảnh chụp | không làm gì |
| `dung` | người dùng dừng task | không làm gì |

Phiên reviewer mới không biết thư mục scratchpad của phiên cũ. File trạng thái ghi đường dẫn đầy đủ của file giao việc, báo cáo và thư mục trao đổi, nên phiên mới đọc lại được file của phiên cũ.

## Cầu dao: round

Sau khi viết file review của mỗi lượt, ghi kết quả lượt đó:

```bash
node "<skill>/scripts/loop.mjs" round --task CAT-05 --blocking 3 --open R1-02,R2-01,R2-04 --keys test-khong-assert,dash-trong-md
```

- `--blocking`: số lỗi `Critical` cộng `Bắt buộc` của lượt. Lượt đạt thì ghi `0`.
- `--open`: mã các lỗi `Critical` và `Bắt buộc` còn mở sau lượt này, gồm lỗi cũ chưa sửa và lỗi mới.
- `--keys`: khóa loại lỗi, dùng cùng khóa với bảng `Lỗi lặp lại` của hồ sơ. Lệnh `stats` đếm theo khóa này.

Cầu dao ngắt (in `[DỪNG]` và thoát mã 1) khi gặp một trong hai trường hợp:

1. Cùng một mã lỗi còn mở ở 3 lượt liên tiếp. Ví dụ `R1-02` có trong `--open` của lượt 1, 2 và 3.
2. Số lỗi chặn không giảm qua 3 lượt gần nhất, ví dụ `3 -> 3 -> 4`. Thường là builder sửa lỗi này lại sinh lỗi khác.

Cầu dao ngắt thì reviewer dừng vòng lặp và hỏi người dùng theo bước 12. Gửi kèm mã lỗi, lý do builder chưa sửa được và đề xuất (đổi cách sửa, chia nhỏ task, tự người dùng quyết thiết kế). Người dùng cho chạy tiếp mà không hỏi lại thì đặt `state --set breaker=off`.

## Khung file giao việc: handoff, footer

```bash
node "<skill>/scripts/loop.mjs" handoff --task CAT-05 --module catalog --out "<thư mục trao đổi>/CAT-05-handoff.md"
```

Kết quả mong đợi: `Đã viết khung <đường dẫn>. Còn 10 dòng có chữ ĐIỀN cần reviewer viết.`

Script điền sẵn phần giống nhau ở mọi task:

- đường dẫn file luật của repo (`CLAUDE.md`, `AGENTS.md`), các luật cố định về commit và `git add`;
- đường dẫn cấm lấy từ `noStage` và `noEdit`;
- mục "Agent skills", yêu cầu TDD và phép thử đột biến, luật chạy test;
- thư mục bằng chứng (tạo sẵn `picture/` và `video/`), đường dẫn `references/bang-chung.md` và `video-cursor.ts`. Task không có tiêu chí nhìn thấy được thì thêm `--no-evidence`;
- luật báo tiến độ, đường dẫn báo cáo, lệnh `check-task` đầy đủ;
- bước báo XONG với `pane_id` thật của reviewer.

Reviewer thay mọi dòng có chữ `ĐIỀN`: luật riêng chưa có kiểm tự động, tiêu chí, file liên quan, điểm mơ hồ, pattern xấu, các bước, gợi ý đột biến, lệnh kiểm tra. Trước khi gửi, chạy `rg -n ĐIỀN "<file giao việc>"` và thấy không còn dòng nào.

```bash
node "<skill>/scripts/loop.mjs" footer --task CAT-05 >> "<thư mục trao đổi>/CAT-05-review-2.md"
```

In lại bước báo XONG để dán vào cuối file review mỗi lượt.

## Theo dõi builder bị treo: watch

```bash
node "<skill>/scripts/loop.mjs" watch --task CAT-05 --every 5
```

Cứ 5 phút, script đọc file trạng thái và hỏi Herdr trạng thái của builder. Khi `status` là `cho-builder` và đã quá 2 phút, script nhắn reviewer một câu bắt đầu bằng `NHẮC` trong các trường hợp sau:

| Builder | Báo cáo | Câu nhắc |
|---|---|---|
| `idle` hoặc `done` | đã cập nhật sau lúc giao việc | builder đã xong nhưng tin XONG không tới. Reviewer coi như XONG và review |
| `idle` hoặc `done` | chưa cập nhật | builder dừng giữa chừng. Reviewer đọc màn hình builder |
| `blocked` | bất kỳ | builder đang chờ duyệt hoặc đang hỏi. Reviewer hỏi người dùng trước khi trả lời thay |
| không thấy agent | bất kỳ | builder có thể đã thoát |

Mỗi câu nhắc chỉ gửi một lần cho đến khi tình huống đổi. Script tự dừng khi task sang `xong` hoặc `dung`.

Chạy `watch` trong một pane Herdr riêng, giống pane `test-runner` ở `chay-test-cham.md`. Không chạy bằng lệnh nền của agent, vì agent có thể dừng lệnh nền khi máy thiếu RAM.

1. Tìm pane có `"label":"loop-watch"` trong `herdr pane list`. Chưa có thì tạo bằng `herdr pane split --current --direction down --ratio 0.2 --cwd "$PWD" --no-focus` rồi `herdr pane rename <pane_id> loop-watch`.
2. Chạy `herdr pane run <pane_id> "node \"<skill>/scripts/loop.mjs\" watch --task CAT-05"`. Pane chạy PowerShell thì vẫn dùng được lệnh `node` này.

`watch --once` kiểm một lần rồi thoát, mã 1 khi có câu nhắc. Dùng khi làm tiếp sau `/clear` hoặc khi người dùng báo builder có vẻ bị kẹt.

## Thống kê: stats

```bash
node "<skill>/scripts/loop.mjs" stats
node "<skill>/scripts/loop.mjs" stats --task CAT-05
```

Kết quả là bảng Markdown: số lượt của từng task, số lỗi chặn theo lượt (ví dụ `4 -> 1 -> 0`), thời gian builder làm và thời gian review. Cuối bảng là các loại lỗi gặp ở nhiều task nhất, đếm theo `--keys` của lệnh `round`. Loại lỗi đứng đầu danh sách là chỗ nên thêm phép kiểm tự động trước.

## Hàng đợi nhiều task: queue

```bash
node "<skill>/scripts/loop.mjs" queue --set CAT-05,CAT-06,CAT-07 --after commit
node "<skill>/scripts/loop.mjs" queue            # xem hàng đợi
node "<skill>/scripts/loop.mjs" queue --next     # lấy task kế tiếp ra khỏi hàng đợi và in mã
```

`--next` in mã task và thoát mã 0, hoặc in `Hàng đợi trống.` và thoát mã 1.

## Lỗi thường gặp

| Thông báo | Nguyên nhân | Cách sửa |
|---|---|---|
| `Chưa có file trạng thái của <task>` | task bắt đầu trước khi có loop.mjs, hoặc gõ sai mã task | chạy `state --list` để xem mã đúng, hoặc tạo bằng `state --task <task> --set status=dang-review` |
| `Cần cả ảnh chụp lượt N-1 và N` | chưa chạy `snapshot` sau khi builder báo xong | chạy `snapshot` rồi chạy lại `diff` |
| `Đã có <file>. Dùng --force để ghi đè.` | đã chạy `handoff` cho task này | sửa file có sẵn, hoặc thêm `--force` nếu muốn viết lại từ đầu |
| `[CẢNH BÁO] Chưa biết pane id của reviewer` | chạy `handoff` ngoài Herdr | đặt `state --set reviewerPane=<id>` rồi chạy lại `handoff --force` |
| `watch` luôn báo `builder=mat` | `builderPane` sai, hoặc pane đã đóng | xem `herdr agent list` rồi đặt lại `state --set builderPane=<id>` |

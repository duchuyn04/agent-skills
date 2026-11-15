# Kiểm tự động với check-task

## Tóm tắt

`scripts/check-task.mjs` là script kiểm một task của builder bằng máy, thay cho các bước reviewer từng làm bằng tay ở mỗi lượt. Ví dụ: xem builder có stage file cấm không, có sửa nội dung tiêu chí khi tick không, có viết em dash vào file `.md` không.

Một luật viết thành chữ trong file giao việc chỉ có tác dụng khi agent nhớ và làm theo. Script thì lần nào cũng chạy giống nhau. Vì vậy mỗi khi một lỗi lặp lại, cách tốt nhất là thêm một phép kiểm vào script hoặc vào lint của repo, không thêm một dòng dặn dò.

Luật của từng repo nằm trong khối JSON ở mục `## Kiểm tự động` của hồ sơ `.claude/builder-loop.md`. JSON là định dạng dữ liệu dạng `{ "khóa": giá trị }`, máy đọc được chính xác, khác với văn xuôi trong các mục còn lại.

## Hai lệnh

Chạy ở gốc repo (hoặc thêm `--repo <thư mục>`). `<thư mục skill>` là thư mục chứa `SKILL.md` này.

### start: ghi mốc lúc bắt đầu task

```bash
node "<thư mục skill>/scripts/check-task.mjs" start --task CAT-05
```

Kết quả mong đợi: `Đã ghi mốc bắt đầu task CAT-05: refs/review/CAT-05/start = <hash>`.

Lệnh chụp lại toàn bộ thư mục làm việc, kể cả thay đổi chưa commit của người dùng. Lệnh check so với mốc này, nên thay đổi có sẵn từ trước task không bị tính cho builder. Mốc phải giữ nguyên suốt task, nên chạy lại lần hai sẽ bị từ chối. Chỉ dùng `--force` khi chắc chắn muốn ghi lại mốc.

### check: kiểm trạng thái hiện tại

```bash
node "<thư mục skill>/scripts/check-task.mjs" check --task CAT-05 --module catalog --report "<thư mục trao đổi>/CAT-05-report.md"
```

`--module` là module của task. Có tham số này thì script kiểm thêm ảnh có nằm đúng thư mục bằng chứng của module và task không.

Kết quả là danh sách dòng `[LỖI]`, `[CẢNH BÁO]`, `[THÔNG TIN]` và dòng cuối `Kết quả: N LỖI, M CẢNH BÁO.`

| Mã thoát | Ý nghĩa |
|---|---|
| 0 | không có LỖI |
| 1 | có LỖI, builder phải sửa |
| 2 | gọi sai lệnh hoặc hồ sơ hỏng, script chưa kiểm gì |

Script không đổi file nào trong thư mục làm việc và không đổi danh sách stage của repo.

### evidence: lấy thư mục bằng chứng

```bash
node "<thư mục skill>/scripts/check-task.mjs" evidence --task CAT-05 --module catalog
```

Kết quả mong đợi: một dòng đường dẫn, ví dụ `C:\Users\<tên>\builder-loop-evidence\pickory\catalog\CAT-05`. Lệnh tạo thư mục nếu chưa có.

Đường dẫn có dạng `<gốc bằng chứng>/<module>/<task>/`. Gốc mặc định là `~/builder-loop-evidence/<tên repo>`. Chạy trong worktree thì `<tên repo>` vẫn là tên repo chính, nên ảnh của mọi nhánh nằm chung một chỗ.

## Script kiểm gì

| Phép kiểm | Mức | Lấy luật từ |
|---|---|---|
| File cấm stage đang nằm trong stage | LỖI | `noStage` |
| File cấm sửa bị đổi trong task | LỖI | `noEdit` |
| File chỉ được sửa khi task ghi rõ bị đổi | CẢNH BÁO | `warnEdit` |
| File đổi ngoài phạm vi commit | CẢNH BÁO | `scope`, `scopeExclude` |
| File trong phạm vi vượt số dòng cho phép | CẢNH BÁO | `maxLines` |
| Nội dung tiêu chí cũ bị sửa hoặc xóa khi tick | LỖI | `criteria` |
| Tiêu chí đã tick bị bỏ tick, hoặc chưa tick tiêu chí nào | CẢNH BÁO | `criteria` |
| Dòng mới khớp mẫu chữ cấm | LỖI | `bannedText` |
| Lệnh kiểm chữ của repo báo lỗi | LỖI | `textCheck` |
| Báo cáo nhắc tới ảnh hoặc video không tồn tại | LỖI | `--report` |
| Diff chạm giao diện mà báo cáo không có ảnh hoặc video | LỖI | `evidence.uiPaths` |
| Báo cáo chỉ có video, không có ảnh | CẢNH BÁO | `--report` |
| Ảnh hoặc video nằm ngoài thư mục `<module>/<task>/` | CẢNH BÁO | `--module`, `evidence.dir` |
| Thư mục bằng chứng có file mà báo cáo không nhắc tới | CẢNH BÁO | `--module`, `evidence.dir` |
| Lỗi gặp ở từ 2 task trở lên mà chưa có cách chặn | CẢNH BÁO | bảng `## Lỗi lặp lại` |

Script cũng in danh sách tiêu chí mới tick. Reviewer dùng danh sách này để đối chiếu từng tiêu chí với test hoặc bằng chứng.

Script không thay được phán đoán của reviewer. Nó không biết test có kiểm đúng điều cần kiểm không, comment có đúng không, hay ảnh có đúng giao diện không.

## Khối JSON trong hồ sơ

Mọi khóa đều tùy chọn. Khóa lạ (gõ sai tên) làm script dừng với mã 2, để lỗi gõ không bị bỏ qua.

```json
{
  "noStage": [".env", "data/"],
  "noEdit": ["AGENTS.md"],
  "warnEdit": ["src/lib/tax-engine/"],
  "scope": ["apps/", "tasks/"],
  "scopeExclude": [".claude/"],
  "criteria": ["tasks/**/todo*.md"],
  "maxLines": 1000,
  "textCheck": "node scripts/check-agent-text.mjs",
  "bannedText": [
    { "pattern": "[\u2014\u2013]", "files": ["**/*.md"], "exclude": ["tests/**"], "message": "Dòng mới trong file .md có em dash hoặc en dash:" }
  ],
  "evidence": { "uiPaths": ["apps/frontend/src/"], "dir": "~/builder-loop-evidence/{repo}" }
}
```

| Khóa | Ý nghĩa | Mặc định |
|---|---|---|
| `noStage` | đường dẫn không được nằm trong stage, cũng bị loại khỏi phạm vi commit | `[]` |
| `noEdit` | đường dẫn builder không được sửa | `[]` |
| `warnEdit` | đường dẫn chỉ được sửa khi task ghi rõ | `[]` |
| `scope` | phạm vi commit. `["."]` là cả repo | `["."]` |
| `scopeExclude` | phần bị loại khỏi `scope` | `[]` |
| `criteria` | file chứa tiêu chí và dòng tiến độ | `[]` |
| `maxLines` | số dòng tối đa trước khi cảnh báo nên tách file | `1000` |
| `textCheck` | lệnh kiểm chữ của repo. Script nối danh sách file đã đổi vào cuối lệnh. Viết dạng `{ "run": "<lệnh>", "files": ["<mẫu>"] }` để chỉ quét một số file | không có |
| `bannedText` | các mẫu chữ cấm trong dòng mới, xem mục dưới | `[]` |
| `evidence.uiPaths` | code giao diện. Diff chạm các đường dẫn này thì báo cáo phải có ảnh hoặc video | không có |
| `evidence.dir` | gốc thư mục bằng chứng. `{repo}` được thay bằng tên repo, `~` là thư mục home. Đường dẫn tương đối tính từ gốc repo | `~/builder-loop-evidence/{repo}` |

### Cách viết mẫu đường dẫn

- Mẫu tính từ gốc repo: `docs/` là thư mục `docs` ở gốc, không phải mọi thư mục tên `docs`.
- `*` khớp tên trong một tầng thư mục: `.env.*` khớp `.env.local`.
- `**` khớp nhiều tầng: `tasks/**/todo*.md` khớp `tasks/todo.md` và `tasks/admin/todo-backend.md`.
- Muốn khớp ở mọi tầng thì viết `**/` ở đầu: `**/*.tsbuildinfo`.
- Mẫu kết thúc bằng `/` là cả thư mục. Mẫu không có `/` ở cuối cũng khớp file bên trong nếu đó là thư mục.

### bannedText: biến lời dặn thành phép kiểm

Mỗi mục gồm:

- `pattern`: biểu thức chính quy (regex), tức một mẫu tìm chữ. Trong JSON, dấu `\` phải viết hai lần: muốn tìm `useEffect(` thì viết `"useEffect\\("`.
- `files`: các mẫu đường dẫn được quét.
- `exclude`: các mẫu đường dẫn bỏ qua, tùy chọn.
- `message`: câu báo lỗi, nên ghi cách sửa đúng để builder sửa tận gốc.
- `flags`: cờ regex, mặc định `u`. Thêm `i` để không phân biệt hoa thường.

Script chỉ quét dòng mới thêm trong task, nên code cũ không bị báo lại ở mọi lượt.

`bannedText` hợp với luật về chữ, ví dụ dấu gạch trong file `.md` hay tên hàm bị cấm. Luật về code (cấm import giữa hai thư mục, cấm một API) đặt trong lint của repo thì tốt hơn: editor báo ngay khi gõ, và lint hiểu cú pháp nên ít báo nhầm.

## Bảng lỗi lặp lại

Mục `## Lỗi lặp lại` trong hồ sơ là một bảng Markdown 4 cột. Reviewer cập nhật bảng sau mỗi task đạt.

```markdown
## Lỗi lặp lại

| Khóa | Mô tả | Task gặp | Đã chặn bằng |
|---|---|---|---|
| test-khong-assert | Test gọi hàm nhưng không kiểm kết quả | CAT-05, CAT-07 | chưa |
| dash-trong-md | Em dash trong file .md | CAT-02, CAT-04 | bannedText |
```

- Khóa: tên ngắn không dấu cách, dùng lại khi gặp lỗi cùng loại.
- Task gặp: các mã task, cách nhau bằng dấu phẩy.
- Đã chặn bằng: tên phép kiểm đã thêm (`bannedText`, tên lint rule, tên test), hoặc `chưa`.

Dòng có từ 2 task trở lên mà cột cuối là `chưa` (hoặc để trống) thì check in `[CẢNH BÁO]` ở mọi lượt, cho đến khi có cách chặn.

## Lỗi thường gặp

| Thông báo | Nguyên nhân | Cách sửa |
|---|---|---|
| `Khối JSON trong mục "Kiểm tự động" lỗi` | JSON sai cú pháp, hay gặp nhất là dấu phẩy thừa ở cuối danh sách | xóa dấu phẩy thừa, kiểm mọi chuỗi nằm trong dấu `"` |
| `Khóa lạ trong khối "Kiểm tự động"` hoặc `Khóa lạ trong "evidence"` | gõ sai tên khóa | so với bảng khóa ở trên |
| `Tên module viết thường, bắt đầu bằng chữ hoặc số` | tên module có chữ hoa, dấu tiếng Việt hoặc dấu cách | viết lại dạng `support-desk` |
| `Bằng chứng nằm ngoài thư mục của module và task` | builder lưu ảnh chỗ khác, hoặc truyền sai `--module` | chạy lệnh `evidence` để lấy đúng thư mục, chuyển ảnh vào đó và sửa đường dẫn trong báo cáo |
| `không có file hồ sơ` | chạy trong worktree, mà `.claude/` bị Git bỏ qua nên worktree không có hồ sơ | thêm `--profile "<gốc repo chính>/.claude/builder-loop.md"` |
| `Chưa có refs/review/<task>/start` | task bắt đầu trước khi có lệnh start | vẫn dùng được: script so với ảnh chụp 0. Thay đổi có sẵn ngoài phạm vi commit sẽ bị liệt kê, reviewer tự bỏ qua |
| `Đã có refs/review/<task>/start` | chạy start lần hai trong cùng task | không cần làm gì. Mốc cũ vẫn đúng |
| `Báo cáo nhắc tới bằng chứng không tồn tại` | đường dẫn ảnh sai, hoặc dùng đường dẫn tương đối | ghi đường dẫn đầy đủ trong backtick, ví dụ `` `C:\Users\...\CAT-05-evidence\form.png` `` |

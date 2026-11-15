---
name: builder-loop
description: "Runs a reviewer and builder loop across Herdr panes. The current session hands one task to a coding agent in another pane (claude, codex, omp or another agent), reviews every round, and sends fixes until the task passes. Use when the user types /builder-loop with a task ID, asks to hand a task to a builder agent and review its work, or says 'giao task cho builder'. Not for implementing a task yourself or for reviewing a single diff."
metadata:
  argument-hint: "<mã task> [builder=<kind>] [chỉ báo cáo | commit | commit và push]"
---

# Builder loop

## Overview

Skill này chia việc cho hai agent. Builder viết code của task trong một pane Herdr khác. Phiên hiện tại làm reviewer: giao việc, review từng lượt, yêu cầu sửa đến khi task đạt, và chỉ commit khi người dùng báo "ok". Herdr là terminal multiplexer cho coding agent: nhiều agent chạy trong các pane cạnh nhau và nhắn tin cho nhau được.

Lỗi được chặn bằng kiểm tra tự động trước (`scripts/check-task.mjs`, lint và test của repo), bằng phán đoán của reviewer sau. Lỗi lặp lại qua nhiều task được biến thành phép kiểm mới, để task sau không mắc lại.

## When to Use

- Người dùng gõ `/builder-loop <mã task>`, hoặc nhờ giao một task cho agent builder rồi review kết quả.
- Phiên đang chạy trong Herdr. Không có Herdr thì bước 1 của quy trình báo người dùng và dừng.
- Không dùng khi tự làm task trong phiên này: dùng `incremental-implementation`.
- Không dùng khi chỉ cần review một diff: dùng `code-review-and-quality`.

## Đối số

Đối số: `$ARGUMENTS`. Agent không thay `$ARGUMENTS` thì lấy đối số từ tin nhắn của người dùng.

- Từ đầu tiên là mã task, ví dụ `CAT-05`.
- `builder=<kind>` chọn loại agent làm builder, ví dụ `builder=codex`. Câu thường như "dùng phiên claude rảnh làm builder" có cùng nghĩa.
- Phần còn lại là việc làm sau khi task đạt: `chỉ báo cáo`, `commit` hoặc `commit và push`. Không có phần này thì mặc định là `chỉ báo cáo`.

## Vai trò

Bạn là reviewer và người điều phối. Builder là một agent coding chạy trong pane Herdr khác.

- Builder viết code của task.
- Bạn giao việc, review và yêu cầu sửa.
- Bạn không tự viết code của task.

Skill không phụ thuộc loại agent. Reviewer và builder có thể là Claude Code, omp, Codex hay agent khác mà `herdr agent start --kind` hỗ trợ.

## Hồ sơ repo

Mỗi repo có luật riêng: nơi ghi tiêu chí, lệnh test, đường dẫn được commit. Skill đọc các luật này từ file hồ sơ `.claude/builder-loop.md` ở gốc repo.

Hồ sơ là file Markdown, mỗi mục là một heading cấp 2. Các mục sau đây đều tùy chọn. Hồ sơ thiếu mục nào thì dùng giá trị mặc định ở cột phải.

| Mục | Nội dung | Mặc định |
|---|---|---|
| `Builder` | loại agent và lệnh mở builder | agent rảnh đầu tiên khác pane của bạn; không có thì `claude` |
| `Luật bắt buộc` | file luật của repo và các luật phải chép vào file giao việc | `CLAUDE.md` hoặc `AGENTS.md` ở gốc repo, nếu có |
| `Đường dẫn cấm` | đường dẫn cấm stage, xóa hoặc đọc | không có |
| `Tiêu chí task` | file chứa tiêu chí, cách tick tiến độ | tìm mã task bằng `rg` trong repo |
| `Phạm vi commit` | thư mục được đưa vào ảnh chụp review và commit | cả repo |
| `Lệnh kiểm tra` | lệnh nhanh chạy mọi lượt, lệnh chậm chạy một lần, bộ lọc lệnh chậm theo module, đường dẫn dùng chung | đoán từ `package.json`, `Makefile`, file solution `.sln`; hỏi người dùng nếu không chắc |
| `Kiểm comment` | phần kiểm comment cần reviewer tự đọc | không có |
| `Kiểm tự động` | khối JSON cho `scripts/check-task.mjs`: đường dẫn cấm, phạm vi, file tiêu chí, mẫu chữ cấm, code giao diện. Cách viết ở `references/kiem-tu-dong.md` | không có: script chỉ báo file đổi và lỗi lặp lại |
| `Bằng chứng chạy thật` | lệnh mở app, feature map (danh sách màn hình và tính năng theo góc nhìn người dùng), loại ảnh hoặc video cần nộp | không có: chỉ đòi ảnh khi diff chạm `evidence.uiPaths` |
| `Review của người dùng` | cách người dùng tự xem thay đổi trước khi commit | giữ thay đổi chưa commit và chưa stage |
| `Commit` | quy ước commit message | theo `git log` gần đây |
| `Lỗi lặp lại` | bảng lỗi đã gặp qua các task và cách đã chặn, theo mục "Lỗi lặp lại" bên dưới | bảng trống |
| `Ghi chú khác` | luật riêng khác của repo | không có |

Hồ sơ chưa có thì làm như sau:

1. Tự dò các giá trị mặc định ở bảng trên.
2. Hỏi người dùng một lần về giá trị không dò được, gộp mọi câu hỏi trong một lượt.
3. Đề nghị ghi kết quả thành `.claude/builder-loop.md` để lần sau không hỏi lại. Viết luật nào máy kiểm được vào khối JSON của mục `Kiểm tự động`, không chỉ viết thành văn xuôi.

Luật trong hồ sơ thắng luật mặc định của skill khi hai bên khác nhau. Luật trong file luật của repo (`CLAUDE.md`, `AGENTS.md`) thắng cả hai.

## Thư mục trao đổi

Đặt mọi file trao đổi (giao việc, báo cáo, review) ngoài repo, ở nơi builder đọc được.

- Reviewer là Claude Code: dùng thư mục scratchpad của phiên.
- Agent khác: dùng `${TMPDIR:-/tmp}/builder-loop/<tên repo>/<task>/`. Trên Windows, dùng `%TEMP%` thay `/tmp`.

Ghi đường dẫn đầy đủ trong mọi tin nhắn gửi builder. Builder không biết scratchpad của bạn.

## Quy trình

1. Chạy `test "${HERDR_ENV:-}" = 1`. Lệnh lỗi thì báo người dùng rằng phiên không chạy trong Herdr, rồi dừng.
2. Đọc hồ sơ repo theo mục "Hồ sơ repo".
3. Tìm builder bằng `herdr agent list`.
   - Đối số hoặc hồ sơ chỉ định loại agent: chọn agent rảnh (`idle`) đúng loại đó.
   - Không chỉ định: chọn agent rảnh đầu tiên khác pane của bạn.
   - Có agent phù hợp: đặt tên bằng `herdr agent rename <pane> builder`.
   - Không có: tách pane bằng `herdr pane split --current --direction right --cwd "$PWD" --no-focus`. Sau đó mở builder bằng `herdr agent start builder --kind <kind> --pane <pane mới> -- <tham số>`. Lấy `<kind>` và `<tham số>` từ mục `Builder` của hồ sơ.
   - Đặt tên pane của bạn bằng `herdr agent rename "$HERDR_PANE_ID" reviewer`. Builder dùng tên này để báo khi xong.
4. Tìm tiêu chí của task theo mục `Tiêu chí task`. Đọc spec và code liên quan. Ghi lại:
   - các điểm mơ hồ;
   - phần hạ tầng còn thiếu, ví dụ test chưa có;
   - chỗ tiêu chí lệch với code hiện tại, ví dụ tiêu chí viết cho stack cũ;
   - pattern xấu trong vùng code task sẽ chạm: workaround, code deprecated, comment biện minh cho cách làm tắt, chỗ trái luật của repo. Builder đọc code xung quanh để bắt chước, nên dễ chép lại những chỗ này.
     - Với mỗi pattern, ghi vào file giao việc: file, số dòng, "không sao chép" và cách làm đúng.
     - Không giao builder dọn pattern trong task này, vì đó là việc ngoài phạm vi. Báo người dùng và đề xuất một task dọn riêng, hoặc một phép kiểm chặn pattern đó (lint rule, mẫu `bannedText`).
5. Tạo ảnh chụp gốc `refs/review/<task>/0` theo luật review 6. Ảnh này giữ trạng thái trước khi builder bắt đầu. Nhờ đó diff lượt 1 không lẫn thay đổi chưa commit của task trước.
   - Sau đó ghi mốc toàn bộ thư mục làm việc bằng `node "<thư mục skill>/scripts/check-task.mjs" start --task <task>`. Lệnh check ở bước 10 so với mốc này, nên thay đổi có sẵn của người dùng ngoài phạm vi commit không bị tính cho builder.
6. Viết file giao việc `<task>-handoff.md` theo mục "File giao việc".
7. Xóa ngữ cảnh của builder trước mỗi task mới. Builder bắt đầu task mới với phiên sạch, không mang ngữ cảnh của task trước.
   1. Chạy `herdr agent list`. Chờ builder ở trạng thái `idle` hoặc `done`. Builder đang `working` thì lệnh xóa có thể bị xếp hàng sau việc đang chạy.
   2. Gửi lệnh xóa ngữ cảnh bằng `MSYS_NO_PATHCONV=1 herdr agent prompt builder "/clear"`. Builder là Claude Code thì lệnh là `/clear`. Agent khác dùng lệnh mở phiên mới tương đương. Không biết lệnh đó thì hỏi người dùng.
      - Giữ `MSYS_NO_PATHCONV=1` khi chạy trong Git Bash trên Windows. Thiếu biến này, Git Bash đổi `/clear` thành `C:/Program Files/Git/clear` và builder nhận một câu chat thường.
   3. Đọc màn hình bằng `herdr agent read <pane>`. Kiểm tra lịch sử chat đã trống, hoặc thanh trạng thái báo ngữ cảnh gần 0%.
      - Chữ mờ trong ô nhập có thể là gợi ý của Claude Code, không phải lệnh đang chờ. Không gửi Enter để chạy gợi ý đó.
   4. Đặt lại tên bằng `herdr agent rename <pane> builder`. Herdr gắn tên vào phiên của agent, nên `/clear` làm mất tên `builder`.
   - Bước này chỉ áp dụng khi giao task mới. Review lượt sau, lần dọn cuối và việc commit của cùng task không xóa ngữ cảnh. Builder cần ngữ cảnh đó để sửa đúng chỗ.
   - Builder mất mọi ngữ cảnh sau `/clear`. File giao việc phải tự đủ: ghi đường dẫn đầy đủ, quyết định đã chốt và commit của task trước, nếu task mới dựa trên đó.
8. Gửi file giao việc bằng `herdr agent prompt builder "<câu ngắn trỏ tới đường dẫn đầy đủ của file giao việc>"`.
   - Đọc màn hình một lần bằng `herdr agent read builder` để xác nhận builder đã bắt đầu.
   - Prompt còn nằm ở ô nhập: gửi `herdr agent send-keys builder Enter`. Một số agent (ví dụ omp) cần bước này.
9. Kết thúc lượt và chờ tin nhắn `XONG, báo cáo ở <đường dẫn>` từ builder. Tin nhắn đến pane của bạn như một tin nhắn mới.
   - Không chạy vòng lặp nền để chờ. Agent có thể dừng tiến trình nền khi máy thiếu bộ nhớ.
   - Không dùng `herdr agent wait` ngay sau prompt. Lệnh có thể trả về trước khi builder bắt đầu làm.
   - Người dùng báo builder bị kẹt: đọc màn hình bằng `herdr agent read builder`. Hỏi người dùng trước khi trả lời thay builder.
10. Review theo mục "Luật review". Không tin báo cáo của builder.
    1. Chạy `node "<thư mục skill>/scripts/check-task.mjs" check --task <task> --report <file báo cáo>`. Cách đọc kết quả ở `references/kiem-tu-dong.md`.
       - Mỗi dòng `[LỖI]` là một lỗi `Bắt buộc` trong file review. Đường dẫn cấm nằm trong stage thì bỏ stage bằng lệnh script ghi trong thông báo.
       - Dòng `[CẢNH BÁO]` thì reviewer tự xét và quyết định.
       - Script thoát với mã 2 thì sửa hồ sơ theo thông báo. Không sửa được thì tự kiểm bằng tay các mục script làm, và ghi lý do vào file review.
    2. Tự kiểm những điểm script không kiểm được:
       - Tự làm ít nhất 1 phép thử đột biến trên luật quan trọng nhất. Đột biến vẫn xanh là một lỗi: ghi test còn thiếu.
       - Code lặp, và file script báo vượt số dòng: xét có cần tách không.
       - Đối chiếu mọi khẳng định trong code, comment và tài liệu với file thật.
       - Mỗi dòng trong danh sách "Tiêu chí mới tick" của script có test hoặc bằng chứng chạy thật. Tick không có bằng chứng là lỗi `Bắt buộc`.
       - Builder đã tick đủ tiêu chí đạt theo mục `Tiêu chí task`. Thiếu tick là lỗi `Bắt buộc`.
       - Mở từng ảnh và video bằng chứng và xem bằng mắt. Script chỉ kiểm file có tồn tại, không kiểm nội dung.
       - Comment và tài liệu theo `Luật bắt buộc` và mục `Kiểm comment`, ở phần chưa có kiểm tự động.
       - Tự chạy lại build và test sau lần sửa cuối có đổi code, theo mục "Luật chạy test".
11. Task chưa đạt thì làm các bước sau:
    1. Viết `<task>-review-<N>.md` theo mục "Luật review". Gắn mức cho từng lỗi: `Critical`, `Bắt buộc`, `Optional` hoặc `Nit`.
    2. Đổi tên báo cáo cũ thành `<task>-builder-report-r<N>.md`.
    3. Ở lượt 1, tạo ảnh chụp lượt 1. Từ lượt 2, ảnh chụp đã có từ đầu lượt.
    4. Ghi bước cuối `herdr agent prompt reviewer "XONG, báo cáo ở <đường dẫn>"` vào file review.
    5. Gửi review cho builder.
    6. Quay lại bước 9.
12. Dừng vòng lặp và hỏi người dùng khi gặp một trong các trường hợp sau:
    - builder cần đổi schema DB, thêm package hoặc đổi phạm vi;
    - tiêu chí mâu thuẫn với spec;
    - việc tiếp theo không đảo ngược được, ví dụ push lên nhánh chính, deploy production, xóa dữ liệu.
13. Task đạt (kể cả theo luật review 7) thì báo người dùng và dừng. Không commit trước khi người dùng báo "ok".
    - Giữ thay đổi theo mục `Review của người dùng`.
    - Liệt kê file đã đổi trong `Phạm vi commit`, để người dùng biết cần xem file nào.
    - Cập nhật bảng `Lỗi lặp lại` của hồ sơ theo mục "Lỗi lặp lại" bên dưới.
    - Người dùng yêu cầu sửa thì giao lại cho builder, rồi review như một lượt bình thường.
14. Người dùng báo "ok" thì làm đúng việc ghi trong đối số.
    - Giao commit và push cho builder bằng một file giao việc riêng.
    - Stage từng file trong `Phạm vi commit` bằng `git add -- <đường dẫn>`. Không stage file ngoài phạm vi.
    - Trước khi commit, chạy `git diff --cached --name-only`. Mọi dòng phải nằm trong `Phạm vi commit`.
    - Viết commit message theo mục `Commit` của hồ sơ.
    - Không dùng `--force`.
    - Sau khi commit, xóa mọi ảnh chụp của task, kể cả lượt 0 và mốc `start`:

      ```bash
      git for-each-ref --format='%(refname)' "refs/review/<task>/" | while read -r ref; do git update-ref -d "$ref"; done
      ```
    - Tự kiểm tra hash commit, message và trạng thái remote.

## File giao việc

File `<task>-handoff.md` gồm các phần sau:

- Luật bắt buộc:
  - đường dẫn đầy đủ của file luật của repo, kèm yêu cầu builder đọc toàn bộ file;
  - chép những luật trong mục `Luật bắt buộc` của hồ sơ mà chưa có kiểm tự động. Luật đã có kiểm (lint, test, `check-task`) thì không chép lại, vì lệnh `check-task` ở bước cuối sẽ báo khi vi phạm;
  - không commit, không push;
  - không chạy `git add -A`, `git add .` hay `git add -u`;
  - không hoàn tác thay đổi chưa commit của task khác.
- Đường dẫn cấm theo mục `Đường dẫn cấm`.
- Bối cảnh: tiêu chí, file code và test liên quan, các điểm mơ hồ đã chốt.
- Pattern xấu đã ghi ở bước 4: file, số dòng, "không sao chép" và cách làm đúng.
- Các bước theo thứ tự. Mỗi bước có kết quả kiểm tra được.
- Mục "Agent skills" theo phần cùng tên bên dưới.
- Yêu cầu TDD, và phép thử đột biến cho test xanh ngay lần đầu. Gợi ý đột biến cụ thể cho từng tiêu chí.
- Lệnh kiểm tra theo mục "Luật chạy test", kèm yêu cầu ghi kết quả thật.
- Bằng chứng chạy thật cho tiêu chí người dùng nhìn thấy được (giao diện, luồng thao tác):
  - mở app theo mục `Bằng chứng chạy thật` của hồ sơ, làm đúng thao tác của tiêu chí;
  - lưu ảnh hoặc video vào `<thư mục trao đổi>/<task>-evidence/`;
  - ghi đường dẫn đầy đủ của từng file, trong backtick, cạnh tiêu chí tương ứng trong báo cáo.
- Bước đánh dấu tiến độ, chạy sau khi lệnh kiểm tra xanh:
  - Tick `[x]` từng tiêu chí đã đạt, theo mục `Tiêu chí task`.
  - Giữ `[ ]` cho tiêu chí chưa kiểm được. Thêm một dòng thụt lề bên dưới, ghi lý do và task sẽ kiểm.
  - Không tick mục người dùng tự xác nhận, ví dụ "Review với người dùng".
  - Không sửa nội dung tiêu chí khi tick.
  - Liệt kê tiêu chí đã tick và chưa tick trong báo cáo.
- Đường dẫn đầy đủ của file báo cáo, và câu trả lời cố định `XONG, báo cáo ở <đường dẫn>`.
- Kiểm tự động sau khi ghi báo cáo: chạy `node "<đường dẫn đầy đủ của thư mục skill>/scripts/check-task.mjs" check --task <task> --report <file báo cáo>`. Sửa hết dòng `[LỖI]` rồi chạy lại đến khi không còn. Chép dòng `Kết quả:` của lần chạy cuối vào báo cáo.
- Bước cuối: chạy `herdr agent prompt reviewer "XONG, báo cáo ở <đường dẫn>"`.

Builder có thể là agent khác bạn. Viết file giao việc để agent nào cũng làm theo được: dùng lệnh shell cụ thể, không dùng lệnh riêng của một agent.

## Luật review

1. Không giới hạn số lượt review.
   - Task chưa đạt thì reviewer tự gửi review lượt tiếp theo cho builder và lặp lại cho đến khi task đạt. Không hỏi người dùng giữa các lượt.
   - Chỉ dừng vòng lặp ở các trường hợp của bước 12 trong mục "Quy trình".
   - Đánh số lượt tăng dần (`<task>-review-<N>.md`, `refs/review/<task>/<N>`) không có trần.
2. Chỉ review diff mới.
   - Lượt 1: review diff từ ảnh chụp 0 tới trạng thái hiện tại, kể cả file mới chưa track.
   - Lượt 2 trở đi: tạo ảnh chụp cho lần sửa của builder. Chỉ review `git diff refs/review/<task>/<N-1> refs/review/<task>/<N>`.
   - Mọi lượt review đều có một agent review độc lập, với mọi loại reviewer. Reviewer vừa điều phối vừa tự kiểm thì dễ tin báo cáo của builder và bỏ sót lỗi.
     - Agent review là agent mới, không mang ngữ cảnh của reviewer.
     - Prompt của agent ghi lệnh diff của lượt, đường dẫn file giao việc và file review lượt trước, nếu có.
     - Agent chỉ đọc code và trả danh sách lỗi. Mỗi lỗi có file, số dòng và tình huống gây lỗi. Agent không sửa file.
     - Ghi `model` và `effort` của agent theo luật subagent của repo, nếu có.
     - Chờ agent chạy xong. Không giao việc mới cho builder trong lúc chờ.
   - Mở agent review theo cách đầu tiên dùng được trong danh sách sau:
     1. Reviewer là Claude Code: dùng công cụ `Agent` với `subagent_type: general-purpose`, chạy nền. Prompt yêu cầu agent chạy skill review của bộ `agent-skills`. Không chạy skill này trong phiên reviewer.
        - Tên skill tùy cách cài bộ `agent-skills`, ví dụ `agent-skills:review` hoặc `<tiền tố>:code-review-and-quality`. Lấy tên đúng từ danh sách skill của phiên.
        - Phiên không có skill review thì prompt yêu cầu agent review theo 5 trục.
     2. Reviewer là omp hay agent khác có công cụ mở subagent: dùng công cụ đó. Prompt yêu cầu agent dùng lệnh review của agent đó, hoặc review theo 5 trục.
     3. Reviewer không mở được subagent: giao review cho một pane agent rảnh khác trong Herdr. Không dùng pane builder. Agent đó ghi kết quả vào `<task>-independent-review-<N>.md` trong thư mục trao đổi. Sau đó agent chạy `herdr agent prompt reviewer "XONG, review ở <đường dẫn>"`.
     4. Không có cách nào ở trên: review diff bằng tay theo 5 trục. Ghi trong file review rằng lượt này thiếu review độc lập, kèm lý do.
   - Reviewer tự đối chiếu mọi lỗi agent báo với file thật trước khi ghi vào file review. Agent review không thay phần tự kiểm ở bước 10.
   - Từ lượt 2, đưa file review lượt trước vào ngữ cảnh review. Mục "Không yêu cầu sửa" và cách sửa đã yêu cầu là quyết định đã chốt, không báo lại.
   - Kết quả có điểm trái quyết định cũ hoặc nằm ở code cũ thì reviewer tự bỏ. Báo người dùng số điểm đã bỏ và lý do.
3. Không báo lại lỗi cũ.
   - Ở lượt sau, chỉ ghi mã lỗi cũ kèm trạng thái `đã sửa` hoặc `chưa sửa`. Không viết lại mô tả.
   - Không mở lỗi mới ở code mà lần sửa không chạm tới.
   - Ngoại lệ: lỗi `Critical` về bảo mật hoặc đúng đắn luôn được báo, kể cả khi nằm ở code cũ. Ghi rõ lỗi bị bỏ sót từ lượt nào.
4. Mỗi lỗi ghi mã lỗi, file, số dòng, lý do và cách sửa cụ thể.
   - Đặt mã lỗi theo lượt, ví dụ `R1-03` là lỗi thứ 3 của lượt 1.
   - Ghi vị trí dạng `src/.../file.ts:42`.
5. Sửa một chỗ thì phải sửa mọi chỗ có lỗi tương tự.
   - Reviewer liệt kê các chỗ tương tự đã thấy, mỗi chỗ có file và số dòng.
   - Reviewer ghi lệnh tìm, ví dụ `rg "<mẫu>" src`, để builder tự quét hết.
   - Builder ghi trong báo cáo danh sách chỗ đã sửa cho từng mã lỗi.
6. Tạo ảnh chụp để mỗi lượt có hash và diff riêng.
   - Ảnh chụp là commit nằm ngoài nhánh, lưu ở `refs/review/<task>/<N>`. Ảnh chụp không đổi nhánh, danh sách stage hay file trong thư mục làm việc.
   - Lượt 0: tạo trước khi giao việc. Cha là `HEAD`.
   - Lượt 1: tạo sau khi viết xong review lượt 1. Cha là ảnh chụp 0.
   - Lượt 2 trở đi: tạo khi builder báo xong, trước khi review. Cha là ảnh chụp lượt trước.
   - Chỉ đưa file trong `Phạm vi commit` vào ảnh chụp. Dùng danh sách stage tạm trong thư mục trao đổi, không dùng danh sách stage của repo.
   - Không push ảnh chụp. Bước 14 xóa chúng sau khi commit.

   Lệnh tạo ảnh chụp, chạy bằng bash ở gốc repo. Thay `<phạm vi>` bằng `Phạm vi commit`, hoặc `.` khi phạm vi là cả repo:

   ```bash
   INDEX="<thư mục trao đổi>/review-index"
   PARENT=HEAD   # Từ lượt 1: PARENT=refs/review/<task>/<N-1>
   GIT_INDEX_FILE="$INDEX" git read-tree HEAD
   GIT_INDEX_FILE="$INDEX" git add -A -- <phạm vi>
   TREE=$(GIT_INDEX_FILE="$INDEX" git write-tree)
   SNAP=$(git commit-tree "$TREE" -p "$PARENT" -m "review snapshot <task> <N>")
   git update-ref "refs/review/<task>/<N>" "$SNAP"
   rm -f "$INDEX"
   ```

   Lệnh `git add -A` ở đây chỉ ghi vào danh sách stage tạm `$INDEX`. Danh sách stage của repo không đổi.

7. Lượt chỉ còn lỗi `Optional` hoặc `Nit` thì task đạt.
   - Gửi các lỗi đó cho builder trong một lần dọn cuối.
   - Reviewer đọc diff của lần dọn và chạy lại build, test liên quan. Không chạy review đầy đủ cho lần dọn.
   - Lần dọn sinh lỗi `Bắt buộc` mới thì tính là một lượt review và vòng lặp tiếp tục.
   - Xong lần dọn, làm tiếp bước 13.

## Luật chạy test

Hồ sơ chia lệnh kiểm tra thành hai nhóm. Không có hồ sơ thì coi mọi lệnh là lệnh nhanh.

1. Lệnh nhanh (lint, typecheck, unit test) chạy toàn bộ ở mọi lượt.
2. Lệnh chậm (integration, E2E) chỉ chạy phần liên quan trong các lượt review.
   - Phần liên quan gồm test của phần bị sửa và test của mọi file gọi tới code bị sửa.
   - Lấy bộ lọc theo module từ file luật của repo hoặc mục `Lệnh kiểm tra` của hồ sơ. Không có bộ lọc sẵn thì reviewer tự viết bộ lọc theo tên thư mục test.
   - Reviewer ghi bộ lọc trong file giao việc và file review. Builder chạy đúng bộ lọc đó.
   - Lượt chỉ sửa comment hoặc unit test thì không cần chạy lệnh chậm.
   - Diff chạm đường dẫn dùng chung thì bộ lọc không đủ. Ví dụ: thư viện dùng chung, contract giữa các module, migration, hạ tầng test. Reviewer chạy toàn bộ lệnh chậm ngay trong lượt đó, theo cách chạy ở luật 3.
   - Lấy danh sách đường dẫn dùng chung từ file luật của repo hoặc hồ sơ. Không có danh sách thì reviewer tự quyết và ghi lý do vào file review.
3. Task đạt thì reviewer chạy toàn bộ lệnh chậm một lần, trước khi báo người dùng.
   - Chạy trong pane Herdr riêng theo luật 5. Không giao việc mới cho builder trong lúc chạy, vì builder build lại có thể ghi đè file đang chạy.
   - Có test đỏ ngoài bộ lọc thì ghi lỗi `Bắt buộc` và gửi builder. Lần sửa này tính là một lượt review.
   - Test chập chờn đã biết (ghi trong hồ sơ hoặc memory) đỏ thì chạy lại riêng test đó trước khi kết luận.
   - Task không chạm tới phần mà một bộ chậm kiểm tra: có thể bỏ bộ đó. Ghi lý do trong báo cáo cho người dùng.
4. Builder không chạy toàn bộ lệnh chậm, trừ khi file giao việc yêu cầu.
5. Chạy lệnh chậm không có giới hạn thời gian. Agent ngắt lệnh giữa chừng thì không có kết quả, và tiến trình test còn sót lại làm hỏng lần chạy sau.
   - Đọc `references/chay-test-cham.md` trước khi chạy lệnh chậm. File này gồm cách dùng pane `test-runner` với script `run-slow-test.sh`, cách tắt hạn chót của từng loại agent và cách dọn tiến trình test sót lại.
   - Reviewer chạy lệnh chậm trong pane Herdr `test-runner`, không dùng lệnh nền của agent.
   - Builder chạy lệnh chậm thì file giao việc chép các yêu cầu của file đó.

## Agent skills

Builder có plugin này (`duchuyn04-agent-skills`), bộ `agent-skills` gốc hoặc bản cài cho omp: file giao việc yêu cầu builder dùng 3 skill sau.

1. Build: `incremental-implementation` và `test-driven-development`. Làm từng lát nhỏ, mỗi lát đi qua đỏ, xanh, refactor.
2. Verify: `test-driven-development`.
   - Refactor sau khi xanh: gom code lặp và đặt lại tên cho rõ.
   - Logic thuần (không DB, không HTTP) có unit test.
   - Test phụ thuộc thời gian hoặc chạy đồng thời phải cho kết quả ổn định. Ghi cách đảm bảo vào báo cáo.
3. Review: `code-review-and-quality`. Builder tự review 5 trục trước khi báo cáo. Báo cáo có mục "Tự review" liệt kê lỗi đã tự sửa.

Builder không có bộ skill này: chép thẳng 3 yêu cầu trên vào file giao việc dưới dạng các bước.

Luật của repo thắng luật của skill khi hai bên khác nhau:

- Không commit sau mỗi lát, dù skill yêu cầu. Reviewer commit khi người dùng yêu cầu.
- Không chạy chế độ tự động làm hết plan, ví dụ `/build auto`.
- Ghi việc thấy ngoài phạm vi vào mục "Ngoài phạm vi" của báo cáo, không tự sửa.

## Lỗi lặp lại

Một lỗi sửa xong ở task này thường quay lại ở task sau, vì builder mới không nhớ lần sửa trước. Một dòng dặn dò trong file giao việc cũng không chặn được chắc chắn. Mục này biến lỗi lặp lại thành phép kiểm chạy ở mọi task.

1. Khi task đạt, với mỗi lỗi `Critical` và `Bắt buộc` của task, cập nhật bảng ở mục `Lỗi lặp lại` của hồ sơ. Định dạng bảng ở `references/kiem-tu-dong.md`.
   - Lỗi cùng loại đã có dòng: thêm mã task vào cột "Task gặp".
   - Lỗi mới: thêm dòng với khóa ngắn và cột cuối là `chưa`.
2. Lỗi có từ 2 task trở lên mà chưa có cách chặn thì đề xuất cách chặn trong báo cáo cho người dùng. Ưu tiên theo thứ tự sau, cách trước chặn chắc hơn cách sau:
   1. Sửa thiết kế code để lỗi không viết ra được, ví dụ đổi API, tách module, bỏ hàm dễ dùng sai.
   2. Lint rule hoặc test của repo. Câu báo lỗi ghi cách sửa tận gốc để builder không vá tạm.
   3. Mẫu `bannedText` trong khối JSON của hồ sơ.
   4. Một dòng trong mục `Luật bắt buộc`. Cách này không tính là đã chặn, nên cột cuối vẫn là `chưa`.
3. Hỏi người dùng trước khi làm cách 1 hoặc 2, vì đó là việc ngoài phạm vi task. Làm xong thì ghi tên phép kiểm vào cột cuối.

`check-task` in `[CẢNH BÁO]` ở mọi lượt cho các dòng còn mở, nên lỗi lặp lại không bị quên.

## Báo cáo cho người dùng

Viết bằng ngôn ngữ người dùng đang dùng, ngắn gọn:

- kết quả và số lượt review;
- lỗi chính đã bắt được ở mỗi lượt;
- số liệu kiểm tra do bạn tự chạy lại;
- lỗi lặp lại cần chặn, kèm cách chặn đề xuất;
- pattern xấu thấy ở bước 4, kèm đề xuất dọn;
- câu hỏi còn chờ người dùng quyết.

Trong lúc builder chạy, báo trạng thái ngắn sau mỗi lượt review.

## Common Rationalizations

| Lý do tự đưa ra | Thực tế |
|---|---|
| Builder báo test xanh, không cần chạy lại | Báo cáo có thể sai hoặc đã cũ. Bước 10 tự chạy lại build và test sau lần sửa cuối có đổi code |
| Lỗi nhỏ, reviewer tự sửa cho nhanh | Lần sửa của reviewer không có ai review, và builder lặp lại lỗi ở lượt sau. Ghi lỗi vào file review |
| `check-task` báo 0 LỖI nên task đạt | Script chỉ kiểm những gì máy kiểm được. Phép thử đột biến, đối chiếu bằng chứng và xem ảnh vẫn do reviewer làm |
| Thêm một dòng luật vào file giao việc là đủ chặn lỗi này | Builder sau `/clear` không nhớ lần sửa trước. Lỗi lặp lại cần phép kiểm tự động, theo mục "Lỗi lặp lại" |
| Hỏi người dùng giữa các lượt cho chắc | Luật review 1: reviewer tự gửi lượt tiếp. Chỉ dừng ở các trường hợp của bước 12 |
| Chạy lệnh chậm bằng lệnh nền cho tiện | Agent có thể dừng lệnh nền khi thiếu RAM, và tiến trình sót lại làm hỏng lần chạy sau. Chạy trong pane `test-runner` |

## Red Flags

- Reviewer sửa file code của task.
- Tiêu chí được tick mà không có test hoặc bằng chứng chạy thật.
- Có lệnh `git add -A`, `git add .`, hoặc commit trước khi người dùng báo "ok".
- File review lượt sau viết lại mô tả của lỗi cũ, hoặc mở lỗi mới ở code mà lần sửa không chạm tới.
- Lượt review không có agent review độc lập, và file review không ghi lý do.
- Một lỗi đã gặp ở hai task mà bảng `Lỗi lặp lại` của hồ sơ không đổi.
- Diff chạm giao diện mà báo cáo không có ảnh hoặc video.

## Verification

Trước khi báo người dùng task đạt:

- [ ] Lần chạy cuối của `check-task.mjs check` có `0 LỖI`, và kết quả được ghi trong file review.
- [ ] Mỗi tiêu chí mới tick có test hoặc bằng chứng chạy thật mà reviewer đã đối chiếu.
- [ ] Reviewer đã tự làm ít nhất một phép thử đột biến, và test bắt được đột biến đó.
- [ ] Lệnh nhanh xanh sau lần sửa cuối. Lệnh chậm đã chạy theo luật chạy test 3, hoặc báo cáo ghi lý do bỏ.
- [ ] Mọi lượt có agent review độc lập, hoặc file review ghi lý do thiếu.
- [ ] Bảng `Lỗi lặp lại` của hồ sơ đã cập nhật.
- [ ] Chưa có commit nào. Thay đổi được giữ theo mục `Review của người dùng`.

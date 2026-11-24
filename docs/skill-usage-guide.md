# Hướng dẫn dùng skill theo quy trình

## Tóm tắt

Bộ này có 29 skill. Bạn không cần nhớ hết. Gõ các lệnh của quy trình theo thứ tự `/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship`, và mỗi lệnh sẽ nạp sẵn những skill cần thiết. Một số skill chỉ được nạp thêm khi gặp đúng tình huống, ví dụ task có giao diện hay có việc rủi ro cao. Vài skill không nằm trong lệnh nào, bạn gọi tay khi cần.

Thuật ngữ dùng trong bài:

- Skill: một bộ hướng dẫn cho agent, mô tả cách làm một loại việc.
- Lệnh tắt: dòng bắt đầu bằng dấu gạch chéo, ví dụ `/spec`. Bạn gõ, agent chạy.
- Nạp skill: agent đọc skill đó trước khi làm, rồi làm theo các bước trong skill.
- Persona: một agent phụ có vai riêng, ví dụ người review hay người kiểm tra bảo mật. `/ship` chạy ba persona cùng lúc.

## Quy trình chính

Cả 9 lệnh chỉ chạy khi bạn tự gõ. Agent không tự chạy lệnh khi bạn chỉ gõ lời thường.

| Bước | Bạn gõ | Skill nạp sẵn | Skill nạp thêm khi điều kiện đúng |
|---|---|---|---|
| Spec | `/spec` | `spec-driven-development` | `interview-me` (yêu cầu còn mơ hồ), `idea-refine` (ý tưởng chưa thành hình), `domain-modeling` (có thuật ngữ nghiệp vụ), `source-driven-development` (dùng framework hoặc thư viện chưa chắc) |
| Plan | `/plan` | `planning-and-task-breakdown` | không có |
| Build | `/build` hoặc `/build auto` | `incremental-implementation`, `test-driven-development` | `debugging-and-error-recovery` (build hoặc test lỗi), `doubt-driven-development` (việc rủi ro cao), `frontend-ui-engineering` (task có giao diện), `api-and-interface-design` và `codebase-design` (task đụng API hoặc ranh giới module), `source-driven-development`, `domain-modeling`, `git-workflow-and-versioning` (bước commit) |
| Test | `/test` | `test-driven-development` | `browser-testing-with-devtools` (lỗi chỉ thấy trên trình duyệt) |
| Review | `/review` | `code-review-and-quality`, `security-and-hardening`, `performance-optimization` | `doubt-driven-development` (finding cần chạy mới kết luận được), `code-simplification` (code phức tạp thừa), `improve-codebase-architecture` (vấn đề trải nhiều module) |
| Ship | `/ship` | `shipping-and-launch`, cùng 3 persona chạy song song (code-reviewer, security-auditor, test-engineer) | `ci-cd-and-automation`, `observability-and-instrumentation`, `deprecation-and-migration`, `documentation-and-adrs`, `git-workflow-and-versioning` |

Cột cuối do agent tự đánh giá điều kiện, nên đôi khi nó bỏ sót. Bạn biết chắc cần skill nào thì ghi tên skill vào prompt.

## Lệnh chạy riêng, ngoài quy trình chính

| Bạn gõ | Dùng khi | Skill |
|---|---|---|
| `/code-simplify` | Code chạy đúng nhưng khó đọc, muốn gọn hơn mà không đổi hành vi | `code-simplification` |
| `/constraints` | Muốn ghi lại mức chất lượng tối thiểu của dự án vào `CONSTRAINTS.md` | `constraint-driven-development` |
| `/webperf` | Muốn kiểm hiệu năng web (Core Web Vitals) | agent `web-performance-auditor` |
| `/builder-loop <mã task>` | Muốn giao task cho agent khác làm, bạn review từng lượt | `builder-loop` |

Trong `builder-loop`, agent builder dùng 5 skill: `incremental-implementation`, `test-driven-development`, `code-review-and-quality`, `debugging-and-error-recovery` và `doubt-driven-development`.

## Skill không lệnh nào nạp, gọi tay khi cần

| Skill | Gọi khi |
|---|---|
| `context-engineering` | Phiên chat dài, agent bắt đầu quên hoặc lạc hướng, cần sắp xếp lại ngữ cảnh cho gọn |
| `using-agent-skills` | Cần agent tự chọn skill phù hợp với việc đang làm. Skill này thường đã được nạp khi mở phiên |

Ba skill `codebase-design`, `domain-modeling` và `improve-codebase-architecture` được nạp theo điều kiện ở `/build` và `/review`. Muốn dùng riêng thì gọi tay.

## Cách gọi tay một skill

1. Chọn tên skill trong các bảng trên.
2. Gõ `/duchuyn04-agent-skills:<tên skill>`, ví dụ `/duchuyn04-agent-skills:context-engineering`.
3. Kết quả mong đợi: agent báo đã nạp skill đó rồi làm theo các bước của nó.

Cách đơn giản hơn là ghi tên skill vào câu, ví dụ "dùng skill interview-me để hỏi tôi trước khi viết spec". Cách này chạy được ở cả Claude Code lẫn Antigravity CLI (agy).

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| Gõ `/spec` mà không có lệnh | Plugin chưa cài hoặc chưa khởi động lại sau khi cập nhật | Cập nhật plugin rồi mở lại phiên (xem README, mục cài cho từng công cụ) |
| Lệnh tắt không hiện trong agy | Một số bản agy không hiện lệnh tắt | Gọi thẳng tên skill trong câu |
| Gõ lời thường như "làm chức năng đăng nhập" mà agent không theo quy trình | Lệnh chỉ chạy khi bạn gõ, còn lời thường thì agent tự chọn skill nên kết quả không ổn định | Gõ `/spec`, rồi `/plan` và `/build` |
| Task có giao diện mà agent không nạp `frontend-ui-engineering` | Điều kiện nạp thêm do agent tự đánh giá | Ghi tên skill vào prompt |

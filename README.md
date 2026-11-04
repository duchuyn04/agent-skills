# agent-skills (bản tùy biến)

Bộ quy trình làm việc cho AI coding agent, tách nhánh (fork) từ [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) bản 0.6.15. Bản này thêm quy tắc riêng: trả lời tiếng Việt, comment tiếng Việt, làm frontend và backend song song, và mỗi module có thư mục kế hoạch riêng.

README gốc bằng tiếng Anh của tác giả nằm ở [README.upstream.md](README.upstream.md).

## Tóm tắt

AI coding agent là trợ lý lập trình chạy trong terminal hoặc editor, ví dụ Claude Code, Codex, Cursor, GitHub Copilot. Agent đọc code, sửa file và chạy lệnh thay bạn.

Skill là một file hướng dẫn quy trình mà agent đọc trước khi làm việc. Ví dụ: skill `test-driven-development` bắt agent viết test trước rồi mới viết code. Giống một bảng quy trình dán trên tường xưởng: thợ mới hay thợ cũ đều làm theo cùng các bước.

Bộ này có 25 skill, 4 persona và 9 lệnh tắt như `/spec`, `/plan`, `/build`. Persona là vai chuyên gia, ví dụ người review code hay người kiểm bảo mật. Bạn cài một lần, sau đó agent tự chọn skill hợp với việc đang làm.

## Khác gì so với bản gốc

| Thay đổi | Agent sẽ làm gì | File chính |
|---|---|---|
| Quy tắc chung (house rules) | Trả lời tiếng Việt. Viết comment tiếng Việt giải thích lý do của từng bước. Không dùng dấu gạch dài. Nạp skill `humanizer` trước khi viết file `.md`. Chạy đủ bộ test chậm trước khi báo xong. Không ghi công AI trong commit | `references/house-rules.md` |
| Frontend và backend làm song song | Viết hợp đồng API và dữ liệu mẫu trước. Frontend dựng giao diện bằng dữ liệu mẫu. Backend có test so response thật với dữ liệu mẫu. Hai bên gặp nhau ở bước E2E | `references/parallel-frontend-backend.md` |
| Mỗi module một thư mục kế hoạch | Lưu kế hoạch ở `tasks/[module]/plan.md` và `tasks/[module]/todo.md`. Giữ mục lục ở `tasks/README.md` | `skills/planning-and-task-breakdown/SKILL.md` |
| Không còn dấu gạch dài | Văn bản của mọi skill dùng dấu phẩy, dấu hai chấm hoặc ngoặc đơn | Toàn bộ repo |
| Tên plugin và marketplace mới | Lệnh và skill mang tiền tố `duchuyn04-agent-skills:`, ví dụ `/duchuyn04-agent-skills:spec`. Không lẫn với bản gốc tên `agent-skills` | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |

Khi repo bạn làm việc có `AGENTS.md` hoặc `CLAUDE.md` ghi luật khác, luật của repo đó được ưu tiên.

## Trước khi cài

Kiểm tra máy có đủ các công cụ sau:

1. Cài [Git](https://git-scm.com/downloads). Chạy `git --version` để kiểm tra.
2. Cài [Node.js](https://nodejs.org/) bản 18 trở lên, nếu bạn dùng cách cài bằng `npx`. Chạy `node --version` để kiểm tra.
3. Cài agent bạn muốn dùng, theo hướng dẫn của hãng.

Kết quả mong đợi: mỗi lệnh in ra số phiên bản. Lỗi `command not found` nghĩa là công cụ chưa cài hoặc chưa có trong `PATH`.

## Chọn cách cài

| Agent | Cách cài | Có đủ thư mục `references/` không |
|---|---|---|
| Claude Code | Plugin | Có |
| Codex CLI | Plugin | Có |
| GitHub Copilot CLI | Plugin | Có |
| Antigravity CLI | Plugin | Có |
| Gemini CLI | Lệnh `gemini skills install` | Không, cần chép thêm |
| Cursor | Chép thư mục | Có, nếu chép đủ hai thư mục |
| VS Code với GitHub Copilot | Chép thư mục | Có, nếu chép đủ hai thư mục |
| OpenCode | `npx skills` hoặc chép thư mục | Có, nếu chép đủ hai thư mục |
| Command Code | Lệnh `cmd skills add` | Không, cần chép thêm |
| Windsurf | Dán vào file rules | Dán thêm luật chung |
| Agent khác | `npx skills` | Không, cần chép thêm |

Thư mục `references/` chứa luật chung và tài liệu làm song song. Skill trỏ tới thư mục này bằng đường dẫn `../../references/`. Cách cài chỉ chép `skills/` sẽ làm mất các luật đó. Mục "Chép thêm thư mục references" bên dưới hướng dẫn cách bù.

## Cài cho Claude Code

Claude Code cài bộ này như một plugin, gồm skill, persona và lệnh tắt.

Gỡ bản gốc trước nếu máy đã cài nó. Hai bản cùng tên skill sẽ làm agent chọn nhầm.

1. Kiểm tra bản gốc có đang cài không:

   ```
   /plugin
   ```

2. Gỡ bản gốc nếu danh sách có `agent-skills@addy-agent-skills`:

   ```
   /plugin uninstall agent-skills@addy-agent-skills
   /plugin marketplace remove addy-agent-skills
   ```

3. Thêm marketplace của bản này:

   ```
   /plugin marketplace add duchuyn04/agent-skills
   ```

4. Cài plugin:

   ```
   /plugin install duchuyn04-agent-skills@duchuyn04-agent-skills
   ```

5. Thoát Claude Code rồi mở lại.

Kết quả mong đợi: gõ `/` thấy các lệnh `/spec`, `/plan`, `/build`. Skill hiện với tên dạng `duchuyn04-agent-skills:spec-driven-development`.

Lỗi thường gặp:

- Lỗi `Permission denied (publickey)`: máy chưa có SSH key cho GitHub. Thêm marketplace bằng URL HTTPS:

  ```
  /plugin marketplace add https://github.com/duchuyn04/agent-skills.git
  ```

  Lỗi vẫn còn thì chạy lệnh sau trong terminal, rồi cài lại:

  ```bash
  git config --global url."https://github.com/".insteadOf git@github.com:
  ```

- Lệnh `/review` chạy lệnh có sẵn của Claude Code: gõ `/duchuyn04-agent-skills:review`.

Cập nhật lên bản mới nhất:

```
/plugin marketplace update duchuyn04-agent-skills
```

Dùng bản trên máy, không qua GitHub (khi bạn đang sửa skill):

```bash
git clone https://github.com/duchuyn04/agent-skills.git
claude --plugin-dir ./agent-skills
```

## Cài cho Codex CLI

Cần Codex CLI bản 0.122 trở lên.

1. Thêm marketplace:

   ```bash
   codex plugin marketplace add duchuyn04/agent-skills
   ```

2. Cài plugin:

   ```bash
   codex plugin add duchuyn04-agent-skills@duchuyn04-agent-skills
   ```

3. Mở phiên Codex mới.

Kết quả mong đợi: gõ `@spec-driven-development` trong khung chat thì Codex gợi ý skill đó.

Lỗi thường gặp: lệnh `plugin marketplace` không tồn tại. Codex của bạn quá cũ. Cập nhật Codex, hoặc dùng lệnh cũ `codex marketplace add`.

Không dán nội dung `using-agent-skills/SKILL.md` vào `AGENTS.md` của dự án. Codex đã tự chọn skill theo mô tả, nên dán thêm chỉ làm agent chọn skill hai lần.

## Cài cho GitHub Copilot CLI

1. Thêm marketplace:

   ```bash
   copilot plugin marketplace add duchuyn04/agent-skills
   ```

2. Cài plugin:

   ```bash
   copilot plugin install duchuyn04-agent-skills@duchuyn04-agent-skills
   ```

3. Kiểm tra:

   ```bash
   copilot plugin list
   copilot skill list
   ```

Kết quả mong đợi: `copilot plugin list` có dòng `duchuyn04-agent-skills@duchuyn04-agent-skills`, và `copilot skill list` có các skill như `spec-driven-development`.

Lỗi thường gặp:

- Lệnh cài báo không tìm thấy `duchuyn04-agent-skills@duchuyn04-agent-skills`: chạy bước 1 trước. Tên này chỉ có sau khi thêm marketplace.
- Gõ `/spec` hay `/build` không có: Copilot CLI không nhận lệnh tắt của plugin. Gọi skill bằng tên, ví dụ "dùng skill spec-driven-development".

## Cài cho Antigravity CLI

1. Cài plugin từ GitHub:

   ```bash
   agy plugin install https://github.com/duchuyn04/agent-skills.git
   ```

2. Mở phiên mới.

Kết quả mong đợi: agent gọi được skill theo tên có tiền tố, ví dụ `duchuyn04-agent-skills:spec-driven-development`.

Một số bản Antigravity báo đã chuyển các lệnh tắt nhưng không hiện chúng. Khi đó gọi thẳng skill theo tên, thay cho lệnh tắt.

## Cài cho Gemini CLI

1. Cài các skill:

   ```bash
   gemini skills install https://github.com/duchuyn04/agent-skills.git --path skills
   ```

2. Mở Gemini CLI và gõ `/skills list`.

Kết quả mong đợi: danh sách có 25 skill như `spec-driven-development`, `test-driven-development`.

Lệnh này chỉ chép thư mục `skills/`. Làm thêm mục "Chép thêm thư mục references" với thư mục cài mà lệnh in ra.

Chỉ cài cho một dự án:

```bash
git clone https://github.com/duchuyn04/agent-skills.git
gemini skills install ./agent-skills/skills/ --scope workspace
```

## Cài cho Cursor

Cursor đọc skill trong thư mục `.cursor/skills/` của dự án.

1. Tải repo về một chỗ cố định trên máy:

   ```bash
   git clone https://github.com/duchuyn04/agent-skills.git ~/agent-skills
   ```

2. Mở terminal ở thư mục gốc của dự án.
3. Chép các skill:

   ```bash
   mkdir -p .cursor/skills
   cp -r ~/agent-skills/skills/. .cursor/skills/
   ```

4. Chép thư mục `references/` nằm cạnh thư mục `skills/`:

   ```bash
   cp -r ~/agent-skills/references .cursor/references
   ```

5. Mở lại dự án trong Cursor.

Kết quả mong đợi: dự án có `.cursor/skills/spec-driven-development/SKILL.md` và `.cursor/references/house-rules.md`. Nhờ một việc như "thêm tính năng, viết test trước" thì agent mở skill `test-driven-development`.

Dùng PowerShell trên Windows thì thay bước 3 và 4 bằng:

```powershell
New-Item -ItemType Directory -Force .cursor/skills
Copy-Item -Recurse -Force $HOME/agent-skills/skills/* .cursor/skills/
Copy-Item -Recurse -Force $HOME/agent-skills/references .cursor/references
```

Không dán toàn bộ skill vào `.cursor/rules/`. Rules luôn được nạp, nên dán skill vào đó làm tốn ngữ cảnh ở mọi lượt chat.

## Cài cho VS Code với GitHub Copilot

Copilot Chat đọc skill trong `.github/skills/` của dự án.

1. Tải repo về máy như bước 1 của Cursor.
2. Mở terminal ở thư mục gốc của dự án.
3. Chép các skill và thư mục `references/`:

   ```bash
   mkdir -p .github/skills
   cp -r ~/agent-skills/skills/. .github/skills/
   cp -r ~/agent-skills/references .github/references
   ```

4. Chép các persona nếu muốn dùng người review và người kiểm test:

   ```bash
   mkdir -p .github/agents
   cp ~/agent-skills/agents/code-reviewer.md .github/agents/code-reviewer.agent.md
   cp ~/agent-skills/agents/test-engineer.md .github/agents/test-engineer.agent.md
   cp ~/agent-skills/agents/security-auditor.md .github/agents/security-auditor.agent.md
   ```

5. Gõ `/skills` trong Copilot Chat để mở menu Configure Skills.

Kết quả mong đợi: menu liệt kê các skill vừa chép.

Lỗi thường gặp: skill không hiện. Kiểm tra mỗi skill nằm ở `.github/skills/<tên-skill>/SKILL.md`, không lồng thêm một cấp thư mục.

## Cài cho OpenCode

Cách nhanh nhất dùng `npx skills`, công cụ cài skill cho nhiều agent:

```bash
npx skills add duchuyn04/agent-skills
```

Lệnh hỏi bạn chọn skill và chọn agent. Sau đó làm thêm mục "Chép thêm thư mục references" với thư mục mà lệnh in ra.

Cách chép tay, ở thư mục gốc của dự án:

```bash
mkdir -p .opencode/skills
cp -r ~/agent-skills/skills/. .opencode/skills/
cp -r ~/agent-skills/references .opencode/references
```

Kết quả mong đợi: OpenCode tìm thấy skill trong `.opencode/skills/`. OpenCode cũng đọc `.claude/skills/` và `.agents/skills/`.

## Cài cho Command Code

1. Cài cho dự án hiện tại:

   ```bash
   cmd skills add duchuyn04/agent-skills
   ```

   Cài cho mọi dự án thì thêm `--global`.

2. Làm thêm mục "Chép thêm thư mục references" với thư mục `.commandcode/skills/` (hoặc `~/.commandcode/skills/` khi cài `--global`).

Kết quả mong đợi: menu lệnh trong Command Code có `/spec-driven-development`.

## Cài cho Windsurf

Windsurf đọc luật trong file `.windsurfrules` ở gốc dự án. File này luôn được nạp, nên chỉ dán vài skill hay dùng nhất.

1. Mở terminal ở thư mục gốc của dự án.
2. Tạo file rules từ luật chung và hai skill hay dùng:

   ```bash
   cat ~/agent-skills/references/house-rules.md > .windsurfrules
   printf '\n---\n\n' >> .windsurfrules
   cat ~/agent-skills/skills/test-driven-development/SKILL.md >> .windsurfrules
   printf '\n---\n\n' >> .windsurfrules
   cat ~/agent-skills/skills/code-review-and-quality/SKILL.md >> .windsurfrules
   ```

Kết quả mong đợi: agent của Windsurf trả lời tiếng Việt và viết test trước khi viết code.

## Cài cho agent khác

Công cụ `npx skills` hỗ trợ hơn 70 agent, trong đó có Cline:

```bash
npx skills add duchuyn04/agent-skills
npx skills add duchuyn04/agent-skills --list
npx skills add duchuyn04/agent-skills --skill spec-driven-development
```

Lệnh thứ hai liệt kê skill mà không cài. Lệnh thứ ba chỉ cài một skill.

Sau khi cài, làm thêm mục "Chép thêm thư mục references".

## Chép thêm thư mục references

Skill tìm luật chung ở `../../references/`, tính từ file `SKILL.md`. Vì vậy thư mục `references/` phải nằm cạnh thư mục chứa các skill.

Ví dụ: skill nằm ở `.claude/skills/spec-driven-development/SKILL.md`. Khi đó `references/` phải nằm ở `.claude/references/`.

1. Tìm thư mục chứa các skill. Lệnh cài thường in đường dẫn này.
2. Tải repo về máy nếu chưa có:

   ```bash
   git clone https://github.com/duchuyn04/agent-skills.git ~/agent-skills
   ```

3. Chép `references/` vào thư mục cha của thư mục skill. Thay `<thư-mục-skill>` bằng đường dẫn ở bước 1:

   ```bash
   cp -r ~/agent-skills/references "<thư-mục-skill>/../references"
   ```

Kết quả mong đợi: file `<thư-mục-skill>/../references/house-rules.md` tồn tại.

## Dùng thử sau khi cài

Thử với một dự án bất kỳ:

1. Gõ `/spec` rồi mô tả một tính năng nhỏ. Agent hỏi lại yêu cầu và viết spec có mục "Tóm tắt" bằng lời thường ở đầu.
2. Duyệt spec, rồi gõ `/plan`. Agent tạo `tasks/<tên-module>/plan.md`, `tasks/<tên-module>/todo.md` và cập nhật `tasks/README.md`.
3. Gõ `/build`. Agent làm task đầu tiên: viết test trước, rồi viết code có comment tiếng Việt.

Agent không có lệnh tắt thì gõ yêu cầu bằng lời. Ví dụ: "dùng skill planning-and-task-breakdown để lập kế hoạch cho module thanh toán".

## Áp dụng luật chung ở mọi lượt chat

Agent chỉ nạp một skill khi việc đang làm khớp với mô tả của skill đó. Câu hỏi ngắn có thể không khớp skill nào. Khi đó agent không đọc luật chung, ví dụ luật trả lời tiếng Việt.

Để luật chung luôn có hiệu lực trong một dự án:

1. Chép file luật vào dự án:

   ```bash
   mkdir -p docs
   cp ~/agent-skills/references/house-rules.md docs/agent-house-rules.md
   ```

2. Thêm dòng sau vào `AGENTS.md` hoặc `CLAUDE.md` ở gốc dự án:

   ```markdown
   Tuân theo mọi luật trong `docs/agent-house-rules.md` ở mọi task.
   ```

3. Mở phiên agent mới.

Kết quả mong đợi: agent trả lời tiếng Việt ngay từ câu đầu, kể cả khi chưa dùng skill nào.

Muốn áp dụng cho mọi dự án trên máy thì thêm dòng ở bước 2 vào file luật toàn cục của agent. Với Claude Code, file đó là `~/.claude/CLAUDE.md`. Ghi đường dẫn tuyệt đối tới file luật.

## Lệnh tắt

| Lệnh | Việc làm |
|---|---|
| `/spec` | Viết spec trước khi code |
| `/plan` | Chia việc thành task nhỏ, lưu vào `tasks/[module]/` |
| `/build` | Làm task kế tiếp. `/build auto` làm hết kế hoạch sau một lần duyệt. `/build <module>` chọn module |
| `/test` | Viết test trước, sửa lỗi bằng test tái hiện lỗi |
| `/review` | Review code theo 5 mặt: đúng, dễ đọc, kiến trúc, bảo mật, hiệu năng |
| `/code-simplify` | Làm code gọn hơn mà không đổi hành vi |
| `/ship` | Chạy checklist trước khi phát hành |
| `/constraints` | Ghi lại ngưỡng chất lượng của dự án |
| `/webperf` | Kiểm hiệu năng web |

Danh sách đầy đủ 25 skill và mô tả từng skill nằm ở [README.upstream.md](README.upstream.md).

## Lấy bản mới từ tác giả gốc

Bản này không tự cập nhật theo repo gốc. Người duy trì gộp thủ công:

1. Thêm repo gốc làm nguồn phụ (chỉ làm một lần):

   ```bash
   git remote add upstream https://github.com/addyosmani/agent-skills.git
   ```

2. Tải thay đổi mới:

   ```bash
   git fetch upstream
   ```

3. Gộp vào nhánh chính:

   ```bash
   git merge upstream/main
   ```

4. Sửa các chỗ xung đột. Giữ quy tắc của bản này: không dấu gạch dài, đường dẫn `tasks/[module]/`, tên marketplace `duchuyn04-agent-skills`.
5. Chạy bộ kiểm ở mục dưới.

Xung đột sẽ nhiều ở lần gộp đầu. Bản này đã đổi dấu câu ở gần 100 file.

## Kiểm tra trước khi đẩy thay đổi

Chạy các validator ở gốc repo:

```bash
node scripts/validate-skills.js
node scripts/validate-commands.js
node scripts/validate-artifact-paths.js
node scripts/validate-reference-links.js
node scripts/validate-versions.js
node scripts/run-evals.js --min-rank1 95
```

Kết quả mong đợi: mỗi lệnh kết thúc bằng `PASSED`.

Lỗi `require is not defined in ES module scope`: một thư mục cha có `package.json` khai báo `"type": "module"`. Tạo tạm file `package.json` ở gốc repo với nội dung `{"type":"commonjs"}`, chạy lại, rồi xóa file đó.

## Giấy phép

MIT, giống bản gốc. Bản quyền nội dung gốc thuộc Addy Osmani. Xem [LICENSE](LICENSE).

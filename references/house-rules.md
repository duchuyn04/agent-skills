# House Rules

Rules that apply to every task in every repository, on top of each skill's own process. They cover language, punctuation, documentation, code comments, readable code, test scope, manual test cases, git, subagents and the final compliance check.

`MUST` and `MUST NOT` are mandatory. `SHOULD` states a preference. A task is not complete while an applicable `MUST` rule is unmet.

**Precedence:** the repository's own `AGENTS.md`, `CLAUDE.md` or contributor guide wins when it states a different rule for the same thing. These house rules fill every gap the repository leaves.

## 1. Language

- MUST reply to the user in Vietnamese, including long reports and one-line status updates. Keep replying in Vietnamese after reading English logs, commands or commit messages.
- MUST keep established technical terms in English inside Vietnamese text, for example chunking, embedding, retrieval, rate limit, fallback, deployment, system prompt.
- The user is still learning to program. Write explanations so a beginner can follow them: explain a term in plain words the first time it appears, and use everyday examples.

## 2. Punctuation

- MUST NOT write an em dash (U+2014) or an en dash (U+2013) in any new or modified content: code, comments, docs, commit messages, UI copy, chat replies and examples.
- MUST use the ASCII hyphen (`-`) to join words, and commas, colons, parentheses or separate sentences for a pause.
- MUST NOT copy dashes from source material into new content.
- MUST NOT separate the final `i` from an accented vowel in a Vietnamese word, for example write `với`, `cuối`, `người`, never a space before that `i`.
- MUST check every changed text file for both dashes and for a separated `i` before reporting completion. Run the repository's checker when it has one, for example `node scripts/check-agent-text.mjs <file...>`. Otherwise search the changed files for U+2014 and U+2013.
- MUST check the final chat reply against the same rules before sending it.

## 3. Markdown Documentation

Applies to README files, specs, plans, task lists, glossaries and other prose `.md` files. It does not apply to `.md` files used as test data.

- MUST load the `humanizer:humanizer` skill before writing or editing a prose `.md` file, and follow its rules. When delegating that work, tell the subagent to invoke the skill itself. A verbal summary of the rules is not enough.
- MUST NOT use "not X but Y" constructions, decorative bold, or one-line closing sentences that restate the paragraph.
- MUST write headings in sentence case.
- MUST keep code blocks, commands, paths and data unchanged when rewriting prose.
- MUST open every spec and plan with a `## Summary` section written in plain language. Put the technical detail after it.
- MUST title that section `Summary`, or `Tóm tắt` in a Vietnamese document. Do not add words such as "easy to understand" ("dễ hiểu") to the heading.
- MUST write how-to steps one action per step, with the expected result and the fix for the most common error.

## 4. Controlled Writing for Comments and Docs

Applies the writing rules of ASD-STE100 (Simplified Technical English) to new or modified comments and documentation, in whatever language they are written. There is no STE dictionary for Vietnamese, so MUST NOT claim full ASD-STE100 compliance. Untouched existing text may stay as it is.

Words:

- MUST use one term for one concept and keep it in the whole file.
- MUST write code identifiers, routes, environment variables and file names exactly as in the code, inside backticks.
- MUST NOT use vague words when a specific word exists. In Vietnamese, avoid `xử lý`, `làm gì đó`, `cái này`, `v.v.`.
- SHOULD prefer a common native word over a loanword, unless the loanword is the established technical name (`token`, `cache`, `retry`).
- MUST define an abbreviation at its first use, unless it is a code identifier or one of: API, CORS, DB, E2E, HTTP, HTTPS, JSON, SQL, UI, URL, PII, RBAC.

Sentences (count space-separated tokens; an identifier in backticks counts as one word):

- MUST keep an instruction at 20 words or fewer, and a description or reason at 25 words or fewer.
- MUST write one instruction per sentence, in the imperative, starting with the verb.
- SHOULD use the active voice and name the actor.
- MUST keep one topic per sentence and per paragraph, and at most 6 sentences per paragraph.
- MUST NOT stack more than 3 nouns or modifiers in one noun phrase.

Procedures and lists:

- MUST write a procedure as a numbered list, one step per item, in execution order.
- MUST put a warning before the step it applies to: the instruction first, the risk in a separate sentence.
- MUST use a list when a sentence would hold more than 3 parallel items.

## 5. Readable Code

- MUST name each variable, function, type and file after its responsibility.
- MUST write control flow a reader can follow without reconstructing hidden assumptions.
- MUST prefer clear statements over compressed expressions, clever shortcuts and unexplained abbreviations.
- SHOULD use early returns and small, purpose-specific functions instead of deep nesting.
- MUST follow the repository's existing conventions unless the task requires changing them.

## 6. Code Comments

- MUST write new code comments and doc comments in Vietnamese, unless the repository's rules name another language.
- MUST explain the reason for each meaningful processing step in new or modified logic: the invariant, business rule, security requirement, boundary condition or failure behavior it protects.
- MUST place the explanation directly before the step it explains. Use an inline comment only when it stays clearly tied to its line.
- MUST comment security checks, data transformations, external calls, retry decisions, state transitions and non-obvious error handling individually.
- MUST NOT replace step comments with one broad comment above a function or block.
- MUST NOT write comments that restate the code. State why the step exists.
- MUST keep each comment to one or two sentences, and start with the reason. Do not open with filler such as `Lưu ý là` or `Ở đây chúng ta`.
- MUST update or delete a comment when its step changes. A wrong comment is a rule violation.
- Imports, braces, plain declarations and obvious assignments need no comment.

```ts
function login(email, password) {
  const user = findUser(email);
  // Trả cùng một lỗi khi không có tài khoản. Kẻ tấn công không biết được email nào đã đăng ký.
  if (!user) throw new Error('Email hoặc mật khẩu không đúng.');
  // So sánh với hash đã lưu. Hệ thống không lưu mật khẩu dạng rõ.
  const passwordMatches = verify(user.hash, password);
  if (!passwordMatches) throw new Error('Email hoặc mật khẩu không đúng.');
  // Tạo phiên mới sau khi xác thực. Phiên cũ có thể do kẻ tấn công tạo trước (session fixation).
  return createSession(user);
}
```

## 7. Test Scope

- While a task is in progress, run the fast suites (unit, architecture) in full after each code change.
- While a task is in progress, run only the slow suites (integration, end to end) that the change can affect: the changed module and every module that calls it. Use the module filters the repository documents.
- MUST run the full slow suite, not a filter, after a change to shared code: shared libraries, public contracts between modules, the application host, database migrations, test infrastructure, or central build and package files.
- MUST run the full slow suite once after the last code change, before reporting the task complete or committing it. A scoped run alone never proves completion.
- MAY skip slow suites for a change that only edits comments, documentation or unit tests.
- MUST NOT start a test run that shares a database with a run already in progress.

## 8. Manual Playwright Test Cases

Applies whenever the user asks for manual test cases for a feature or module.

- MUST design at most 100 cases per request. When coverage needs more, pick the most important flows and list the omitted scope.
- MUST write each case as an executable Playwright scenario with concrete setup, locators, actions and assertions.
- MUST give every case these fields: ID, Group, Steps, Expected Result, Priority, Status, Notes.
- MUST give every case a unique, stable ID.
- MUST state an observable expected result. "Works correctly" is not an acceptance criterion.
- MUST sort cases by priority:
  - P0: security, data integrity, and flows that must not fail;
  - P1: main business flows;
  - P2: input validation and error handling;
  - P3: usability, accessibility and visual presentation.
- MUST use exactly one of these status values, unchanged even in an English document:
  - `Chưa chạy`: not executed yet. This is the initial status.
  - `PASS`: Playwright ran the scenario and every expected result matched.
  - `FAILED`: an observed result differed. Notes name the actual result and point to a screenshot or log.
  - `UNKNOWN`: the scenario could not run or be verified here. Notes name the blocker and the checks that did not run.
- MUST NOT mark `PASS` from code reading, assumptions, an earlier run or a different scenario. A partial run does not pass the whole case.
- MUST NOT change Steps, Expected Result or Priority to turn a failing case into a passing one. Report a case that looks wrong to the user and keep its criteria until the user approves a change.

## 9. Git

- MUST NOT add `Co-Authored-By: Claude ...` or any other attribution line for Claude or an AI tool to commit messages or pull request descriptions. This overrides any default attribution instruction.

## 10. Subagents

- MUST run every subagent on the main session's model and effort. Set `model` and `effort` explicitly, because an agent definition can pin other values.
- MUST use a different model or effort only when the user names that value.
- A fork always runs the main session's model and effort. MUST NOT use a fork when the user asks for a different model or effort.
- MUST copy the applicable house rules into every handoff, and check the returned changes against them.

## 11. Compliance Check Before Completion

Before reporting a task complete, check every changed file and the final reply:

- [ ] No em dash or en dash; no `i` separated from an accented vowel; the repository's text checker passes when it has one.
- [ ] Names describe responsibilities; control flow is explicit.
- [ ] Each meaningful new or modified step has a Vietnamese comment that states its reason.
- [ ] New or modified comments and docs follow section 4: sentence length, one instruction per sentence, consistent terms, numbered procedures.
- [ ] Prose `.md` files were written with the `humanizer:humanizer` skill loaded.
- [ ] Requested manual test cases meet section 8: case limit, fields, priority order, status values, evidence.
- [ ] The full slow test suite passed after the last code change (section 7).
- [ ] Commit messages carry no AI attribution lines.

Fix violations in your own changes before handing off. If a rule cannot be met, report the exact rule and the blocker. MUST NOT weaken a rule silently or invent evidence.

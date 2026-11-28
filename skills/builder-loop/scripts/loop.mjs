#!/usr/bin/env node
// Script điều phối cho skill builder-loop.
//
// check-task.mjs kiểm code của builder. Script này lo phần việc lặp lại của reviewer:
// ảnh chụp review theo lượt, file trạng thái để làm tiếp sau khi mất phiên, cầu dao
// dừng vòng lặp xoay vòng, khung file giao việc, theo dõi builder bị treo, thống kê
// và hàng đợi nhiều task. Cách dùng chi tiết ở references/loop.md.
//
// Trạng thái lưu trong <thư mục .git chung>/builder-loop/, ngoài thư mục làm việc,
// nên không lẫn vào Git và còn nguyên sau /clear hay khi mở phiên mới.
// Mã thoát: 0 bình thường, 1 cầu dao ngắt hoặc không tìm thấy thứ cần tìm, 2 sai cách dùng.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UsageError,
  git,
  workingTree,
  changedFiles,
  loadProfile,
  matcher,
  evidenceDir,
  PICTURE_SUBDIR,
  VIDEO_SUBDIR,
  MODULE_NAME,
} from './check-task.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TASK_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const STATUSES = ['chuan-bi', 'cho-builder', 'dang-review', 'cho-nguoi-dung', 'commit', 'xong', 'dung'];
const STATE_KEYS = ['status', 'builderPane', 'reviewerPane', 'module', 'exchangeDir', 'handoff', 'report', 'after', 'breaker', 'note'];
const FLAGS = new Set(['force', 'list', 'next', 'stat', 'no-evidence', 'once']);
const ID_STREAK = 3; // cùng một mã lỗi còn mở ở 3 lượt liên tiếp thì ngắt
const FLAT_ROUNDS = 3; // số lỗi chặn không giảm qua 3 lượt (2 lần so) thì ngắt
const GRACE_MS = 2 * 60_000; // builder vừa dừng chưa tới 2 phút thì chưa nhắc

const USAGE = `Cách dùng (chạy ở gốc repo, hoặc thêm --repo <thư mục>):
  node loop.mjs snapshot --task <mã>                  tạo ảnh chụp lượt kế tiếp
  node loop.mjs diff --task <mã> [--round <N>] [--stat]
  node loop.mjs cleanup --task <mã>                   xóa mọi ảnh chụp của task
  node loop.mjs state --task <mã> [--set khóa=giá-trị ...]
  node loop.mjs state --list
  node loop.mjs round --task <mã> --blocking <số> [--open R1-02,R2-01] [--keys khoa-loi,...]
  node loop.mjs handoff --task <mã> --module <module> --out <file> [--no-evidence] [--force]
  node loop.mjs footer --task <mã>
  node loop.mjs watch --task <mã> [--every <phút>] [--once]
  node loop.mjs stats [--task <mã>]
  node loop.mjs queue [--set A,B,C] [--after "<việc sau khi đạt>"] [--next]`;

// ---------- tham số ----------

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = { cmd, set: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) throw new UsageError(`Tham số không hợp lệ: ${a}`);
    const key = a.slice(2);
    if (FLAGS.has(key)) {
      opts[key] = true;
      continue;
    }
    if (i + 1 >= rest.length) throw new UsageError(`Thiếu giá trị cho ${a}`);
    if (key === 'set') opts.set.push(rest[++i]);
    else opts[key] = rest[++i];
  }
  const cmds = ['snapshot', 'diff', 'cleanup', 'state', 'round', 'handoff', 'footer', 'watch', 'stats', 'queue'];
  if (!cmds.includes(cmd)) throw new UsageError(`Lệnh phải là một trong: ${cmds.join(', ')}.`);
  const needTask = !['stats', 'queue'].includes(cmd) && !(cmd === 'state' && opts.list);
  if (needTask && !opts.task) throw new UsageError('Thiếu --task.');
  if (opts.task && !TASK_NAME.test(opts.task)) {
    throw new UsageError('Mã task bắt đầu bằng chữ hoặc số, chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối.');
  }
  if (opts.module && !MODULE_NAME.test(opts.module)) {
    throw new UsageError('Tên module viết thường, bắt đầu bằng chữ hoặc số, nối bằng gạch nối. Ví dụ: support-desk.');
  }
  return opts;
}

const csv = (s) => (s ? String(s).split(',').map((x) => x.trim()).filter(Boolean) : []);
const now = () => new Date().toISOString();
// Đường dẫn ghi dạng C:/... để dán được vào cả Git Bash lẫn PowerShell.
const slash = (p) => path.resolve(p).replace(/\\/g, '/');

// ---------- file trạng thái ----------

function stateDir(repo) {
  const common = git(repo, ['rev-parse', '--git-common-dir']).trim();
  return path.join(path.resolve(repo, common), 'builder-loop');
}

const statePath = (repo, task) => path.join(stateDir(repo), `${task}.json`);

function readState(repo, task) {
  const file = statePath(repo, task);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function allStates(repo) {
  const dir = stateDir(repo);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'queue.json')
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

function newState(task) {
  const at = now();
  return { task, status: 'chuan-bi', round: null, startedAt: at, events: [{ at, status: 'chuan-bi' }], history: [] };
}

function writeState(repo, state) {
  fs.mkdirSync(stateDir(repo), { recursive: true });
  state.updatedAt = now();
  fs.writeFileSync(statePath(repo, state.task), JSON.stringify(state, null, 2) + '\n');
}

function setStatus(state, status) {
  if (!STATUSES.includes(status)) throw new UsageError(`status phải là một trong: ${STATUSES.join(', ')}.`);
  if (state.status === status) return;
  state.status = status;
  state.events.push({ at: now(), status });
}

// ---------- ảnh chụp review ----------

function rounds(repo, task) {
  return git(repo, ['for-each-ref', '--format=%(refname)', `refs/review/${task}/`])
    .split('\n')
    .map((r) => r.trim().split('/').pop())
    .filter((n) => /^\d+$/.test(n))
    .map(Number)
    .sort((a, b) => a - b);
}

// Tree của ảnh chụp = HEAD cộng thay đổi trong phạm vi commit. File ngoài phạm vi giữ như HEAD.
// Dùng danh sách stage tạm, nên danh sách stage của repo không đổi.
function scopedTree(repo, cfg) {
  const full = workingTree(repo);
  const noStage = matcher(cfg.noStage);
  const scope = matcher(cfg.scope.length ? cfg.scope : ['.']);
  const exclude = matcher(cfg.scopeExclude);
  const inScope = (f) => scope(f) && !exclude(f) && !noStage(f);
  const changes = changedFiles(repo, 'HEAD', full).filter((c) => inScope(c.file));
  const index = path.join(os.tmpdir(), `loop-${process.pid}-${Date.now()}.index`);
  const env = { GIT_INDEX_FILE: index };
  try {
    git(repo, ['read-tree', 'HEAD'], { env });
    if (changes.length) {
      const lines = changes.map((c) => {
        if (c.status === 'D') return `0 ${'0'.repeat(40)}\t${c.file}`;
        const [meta] = git(repo, ['ls-tree', '-z', full, '--', c.file]).split('\0')[0].split('\t');
        const [mode, , sha] = meta.split(' ');
        return `${mode} ${sha}\t${c.file}`;
      });
      const r = spawnSync('git', ['update-index', '--index-info'], {
        cwd: repo,
        env: { ...process.env, ...env },
        input: lines.join('\n') + '\n',
        encoding: 'utf8',
      });
      if (r.status !== 0) throw new Error(`git update-index: ${r.stderr.trim()}`);
    }
    return git(repo, ['write-tree'], { env }).trim();
  } finally {
    fs.rmSync(index, { force: true });
  }
}

function cmdSnapshot(repo, opts) {
  const cfg = loadProfile(path.resolve(repo, opts.profile ?? '.claude/builder-loop.md')).config;
  const have = rounds(repo, opts.task);
  const round = have.length ? have[have.length - 1] + 1 : 0;
  const parent = round === 0 ? 'HEAD' : `refs/review/${opts.task}/${round - 1}`;
  const tree = scopedTree(repo, cfg);
  const snap = git(repo, ['commit-tree', tree, '-p', parent, '-m', `review snapshot ${opts.task} ${round}`]).trim();
  const ref = `refs/review/${opts.task}/${round}`;
  git(repo, ['update-ref', ref, snap]);
  const state = readState(repo, opts.task);
  if (state) {
    state.round = round;
    writeState(repo, state);
  }
  if (round === 0) {
    console.log(`Đã tạo ảnh chụp lượt 0: ${ref} = ${snap.slice(0, 10)} (mốc trước khi builder bắt đầu)`);
    return 0;
  }
  const changed = git(repo, ['diff', '--name-only', parent, ref]).split('\n').filter(Boolean).length;
  console.log(`Đã tạo ảnh chụp lượt ${round}: ${ref} = ${snap.slice(0, 10)} (${changed} file đổi so với lượt ${round - 1})`);
  if (changed === 0) console.log('[CẢNH BÁO] Lượt này không đổi file nào trong phạm vi commit. Kiểm tra builder đã thật sự sửa chưa.');
  return 0;
}

function cmdDiff(repo, opts) {
  const have = rounds(repo, opts.task);
  const round = opts.round !== undefined ? Number(opts.round) : have[have.length - 1];
  if (!have.includes(round) || !have.includes(round - 1)) {
    console.error(`Cần cả ảnh chụp lượt ${round - 1} và ${round}. Đang có: ${have.join(', ') || 'chưa có'}.`);
    return 1;
  }
  const from = `refs/review/${opts.task}/${round - 1}`;
  const to = `refs/review/${opts.task}/${round}`;
  const args = ['-c', 'core.quotepath=off', 'diff', ...(opts.stat ? ['--stat'] : []), from, to];
  return spawnSync('git', args, { cwd: repo, stdio: 'inherit' }).status ?? 2;
}

function cmdCleanup(repo, opts) {
  const refs = git(repo, ['for-each-ref', '--format=%(refname)', `refs/review/${opts.task}/`]).split('\n').filter(Boolean);
  for (const ref of refs) git(repo, ['update-ref', '-d', ref]);
  const state = readState(repo, opts.task);
  if (state) {
    setStatus(state, 'xong');
    writeState(repo, state);
  }
  const tail = state ? ' File trạng thái chuyển sang xong và được giữ lại cho thống kê.' : '';
  console.log(`Đã xóa ${refs.length} ảnh chụp của ${opts.task}.${tail}`);
  return 0;
}

// ---------- state ----------

function cmdState(repo, opts) {
  if (opts.list) {
    const open = allStates(repo)
      .filter((s) => !['xong', 'dung'].includes(s.status))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (!open.length) {
      console.log('Không có task nào đang dở.');
      return 1;
    }
    for (const s of open) console.log(`${s.task}  status=${s.status}  lượt=${s.round ?? '-'}  cập nhật ${s.updatedAt}`);
    return 0;
  }
  let state = readState(repo, opts.task);
  if (!state && !opts.set.length) {
    console.error(`Chưa có file trạng thái của ${opts.task}.`);
    return 1;
  }
  state ??= newState(opts.task);
  for (const pair of opts.set) {
    const eq = pair.indexOf('=');
    if (eq < 1) throw new UsageError(`--set cần dạng khóa=giá-trị, nhận: ${pair}`);
    const key = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (!STATE_KEYS.includes(key)) throw new UsageError(`Khóa lạ: ${key}. Khóa hợp lệ: ${STATE_KEYS.join(', ')}.`);
    if (key === 'status') setStatus(state, value);
    else if (key === 'module' && value && !MODULE_NAME.test(value)) throw new UsageError('Tên module viết thường, nối bằng gạch nối.');
    else state[key] = value;
  }
  if (opts.set.length) writeState(repo, state);
  console.log(JSON.stringify({ ...state, events: state.events.slice(-5) }, null, 2));
  return 0;
}

// ---------- cầu dao ----------

function breaker(history) {
  const reasons = [];
  const last = history[history.length - 1];
  for (const id of last.open) {
    let streak = 0;
    for (let i = history.length - 1; i >= 0 && history[i].open.includes(id); i--) streak++;
    if (streak >= ID_STREAK) reasons.push(`Lỗi ${id} vẫn chưa sửa sau ${streak} lượt liên tiếp.`);
  }
  if (history.length >= FLAT_ROUNDS && last.blocking > 0) {
    const tail = history.slice(-FLAT_ROUNDS).map((h) => h.blocking);
    if (tail.every((b, i) => i === 0 || b >= tail[i - 1])) {
      reasons.push(`Số lỗi Critical và Bắt buộc không giảm qua ${FLAT_ROUNDS} lượt gần nhất: ${tail.join(' -> ')}.`);
    }
  }
  return reasons;
}

function cmdRound(repo, opts) {
  const blocking = Number(opts.blocking);
  if (opts.blocking === undefined || !Number.isInteger(blocking) || blocking < 0) {
    throw new UsageError('--blocking là số lỗi Critical cộng Bắt buộc của lượt, số nguyên từ 0.');
  }
  const state = readState(repo, opts.task) ?? newState(opts.task);
  const round = state.round ?? rounds(repo, opts.task).pop() ?? state.history.length + 1;
  const entry = { round, blocking, open: csv(opts.open), keys: csv(opts.keys), at: now() };
  const idx = state.history.findIndex((h) => h.round === round);
  if (idx >= 0) state.history[idx] = entry;
  else state.history.push(entry);
  writeState(repo, state);
  console.log(`Đã ghi lượt ${round}: ${blocking} lỗi Critical/Bắt buộc, còn mở: ${entry.open.join(', ') || 'không'}.`);
  if (state.breaker === 'off') {
    console.log('[THÔNG TIN] Người dùng đã tắt cầu dao cho task này (breaker=off).');
    return 0;
  }
  const reasons = breaker(state.history);
  if (!reasons.length) return 0;
  for (const r of reasons) console.log(`[DỪNG] ${r}`);
  console.log('Dừng vòng lặp và hỏi người dùng theo bước 12. Người dùng cho chạy tiếp mà không hỏi lại thì đặt --set breaker=off.');
  return 1;
}

// ---------- khung file giao việc ----------

const code = (s) => '`' + s + '`';

function footerText(reviewerPane, report) {
  const rp = reviewerPane || '<pane_id reviewer>';
  return [
    '## Bước cuối: báo xong cho reviewer',
    '',
    'Chạy lần lượt, không bỏ bước nào. Thiếu bước 2, reviewer có thể không nhận được tin và vòng lặp đứng yên.',
    '',
    `1. Chạy ${code(`herdr agent prompt ${rp} "XONG, báo cáo ở ${report}"`)}.`,
    `2. Chạy ${code(`herdr agent read ${rp}`)}. Tin còn nằm ở ô nhập thì chạy ${code(`herdr agent send-keys ${rp} Enter`)}.`,
    '3. Chữ mờ trong ô nhập có thể là gợi ý của agent, không phải tin đang chờ. Không gửi Enter cho gợi ý đó.',
    '',
    `Gửi theo pane id ${code(rp)}, không gửi theo tên: tên pane mất khi phiên agent đổi.`,
    '',
  ].join('\n');
}

function handoffText(repo, opts, state, cfg) {
  const task = opts.task;
  const report = state.report;
  const check = slash(path.join(SKILL_DIR, 'scripts', 'check-task.mjs'));
  const forbidden = [...new Set([...(cfg.noStage ?? []), ...(cfg.noEdit ?? [])])];
  const rules = ['CLAUDE.md', 'AGENTS.md'].map((f) => path.join(repo, f)).filter((f) => fs.existsSync(f));
  const out = [];
  const add = (...lines) => out.push(...lines);

  add(`# Giao việc ${task}`, '');
  add('<!-- Reviewer: thay mọi dòng có chữ ĐIỀN rồi xóa comment này. Phần còn lại do loop.mjs điền sẵn. -->', '');

  add('## Luật bắt buộc', '');
  if (rules.length) for (const f of rules) add(`- Đọc toàn bộ file luật của repo: ${code(slash(f))}.`);
  else add('- Repo không có file luật ở gốc.');
  add('- ĐIỀN: các luật trong mục "Luật bắt buộc" của hồ sơ mà chưa có kiểm tự động. Không có thì xóa dòng này.');
  add('- Không commit, không push.');
  add(`- Không chạy ${code('git add -A')}, ${code('git add .')} hay ${code('git add -u')}.`);
  add('- Không hoàn tác thay đổi chưa commit của task khác.', '');

  add('## Đường dẫn cấm', '');
  if (forbidden.length) for (const p of forbidden) add(`- ${code(p)}: không stage, không sửa, không xóa.`);
  else add('Không có.');
  add('');

  add('## Bối cảnh', '');
  add('- ĐIỀN: tiêu chí của task, chép nguyên văn kèm file và số dòng.');
  add('- ĐIỀN: file code và test liên quan, đường dẫn đầy đủ.');
  add('- ĐIỀN: điểm mơ hồ đã chốt. Task dựa trên task trước thì ghi quyết định và commit của task đó, vì builder bắt đầu với phiên trống.', '');

  add('## Pattern xấu không được sao chép', '');
  add(`- ĐIỀN: ${code('file:dòng')}: không sao chép. Cách làm đúng: ... Không có thì ghi "Không có."`, '');

  add('## Các bước', '');
  add('1. ĐIỀN: từng bước theo thứ tự, mỗi bước kèm kết quả kiểm tra được.', '');

  add('## Agent skills', '');
  add(`Có bộ ${code('agent-skills')} thì dùng skill cùng tên. Không có thì làm theo mô tả ở mỗi dòng.`, '');
  add(`1. ${code('incremental-implementation')} và ${code('test-driven-development')}: làm từng lát nhỏ, mỗi lát đi qua đỏ, xanh, refactor.`);
  add(`2. ${code('test-driven-development')}: refactor sau khi xanh (gom code lặp, đặt lại tên cho rõ). Logic thuần (không DB, không HTTP) có unit test. Test phụ thuộc thời gian hoặc chạy đồng thời phải cho kết quả ổn định, ghi cách đảm bảo vào báo cáo.`);
  add(`3. ${code('code-review-and-quality')}: tự review 5 trục (đúng đắn, dễ đọc, kiến trúc, bảo mật, hiệu năng) trước khi báo cáo. Báo cáo có mục "Tự review" liệt kê lỗi đã tự sửa.`);
  add(`4. ${code('debugging-and-error-recovery')}: build hỏng hoặc test đỏ chưa rõ lý do thì tìm nguyên nhân gốc trước khi sửa, ghi nguyên nhân vào báo cáo.`);
  add(`5. ${code('doubt-driven-development')}: việc không hoàn tác được bằng ${code('git revert')} (đổi quyền hoặc đăng nhập, migration xóa dữ liệu, thanh toán, deploy, secret) thì dừng, ghi việc đó và lý do vào báo cáo, rồi chờ reviewer đồng ý. Mỗi lỗi cho là có thật phải kèm lệnh đã chạy và kết quả in ra.`, '');
  add(`Luật của repo thắng luật của skill: không commit sau mỗi lát, không chạy chế độ tự làm hết plan (ví dụ ${code('/build auto')}), việc thấy ngoài phạm vi thì ghi vào mục "Ngoài phạm vi" của báo cáo, không tự sửa.`, '');

  add('## TDD và phép thử đột biến', '');
  add('- Viết test đỏ trước rồi mới viết code. Test xanh ngay lần đầu thì làm phép thử đột biến: sửa code cho sai, chạy test và thấy đỏ, rồi hoàn tác. Ghi kết quả vào báo cáo.');
  add('- ĐIỀN: gợi ý đột biến cụ thể cho từng tiêu chí.', '');

  add('## Lệnh kiểm tra', '');
  add('- ĐIỀN: lệnh nhanh theo thứ tự lint, typecheck, unit test, test module.');
  add('- ĐIỀN: bộ lọc lệnh chậm nếu task cần. Không cần thì ghi "Không chạy lệnh chậm."');
  add('- Ghi kết quả thật của lần chạy cuối vào báo cáo. Chạy từ nhanh đến chậm. Đã chạy toàn bộ bộ test thì không chạy lại bộ lọc con ngay trước đó.');
  add(`- Không tách lệnh test ra nền bằng ${code('&')}, ${code('nohup')} hay ${code('Start-Process')} rồi kết thúc lượt: reviewer không nhận được tin xong và vòng lặp đứng yên.`, '');

  if (!opts['no-evidence']) {
    const dir = evidenceDir(cfg, repo, opts.module, task);
    fs.mkdirSync(path.join(dir, PICTURE_SUBDIR), { recursive: true });
    fs.mkdirSync(path.join(dir, VIDEO_SUBDIR), { recursive: true });
    const guide = slash(path.join(SKILL_DIR, 'references', 'bang-chung.md'));
    const cursor = slash(path.join(SKILL_DIR, 'references', 'video-cursor.ts'));
    add('## Bằng chứng chạy thật', '');
    add('Áp dụng cho tiêu chí người dùng nhìn thấy được (giao diện, luồng thao tác). Cần cả ảnh và video, thiếu một loại là task chưa đạt.', '');
    add(`- Thư mục task: ${code(slash(dir))}`);
    add(`- Ảnh: ${code(slash(path.join(dir, PICTURE_SUBDIR)))}`);
    add(`- Video: ${code(slash(path.join(dir, VIDEO_SUBDIR)))}`);
    add(`- Đọc toàn bộ mục "Phần của builder" trong ${code(guide)} và làm theo: cách đặt tên file, luật chụp ảnh, luật quay video, helper con trỏ ${code(cursor)}.`, '');
  }

  add('## Báo tiến độ và báo cáo', '');
  add(`- KHÔNG tick ${code('[x]')} tiêu chí hay dòng tiến độ nào. Reviewer tick sau khi task pass review. Không sửa nội dung tiêu chí.`);
  add(`- Ghi báo cáo vào ${code(report)}.`);
  add('- Báo cáo có bảng "Tiêu chí": mỗi tiêu chí một dòng, ghi đạt hay chưa đạt và bằng chứng (tên test, đường dẫn đầy đủ của ảnh hoặc video trong backtick). Tiêu chí chưa kiểm được thì ghi lý do và task sẽ kiểm.');
  add('- Báo cáo có các mục "Tự review", "Ngoài phạm vi" và kết quả thật của lệnh kiểm tra.');
  add(`- Sau khi ghi báo cáo, chạy ${code(`node "${check}" check --task ${task} --module ${opts.module} --report "${report}"`)}. Sửa hết dòng ${code('[LỖI]')} rồi chạy lại đến khi không còn. Chép dòng ${code('Kết quả:')} của lần chạy cuối vào báo cáo.`, '');

  add(footerText(state.reviewerPane, report));
  return out.join('\n');
}

function cmdHandoff(repo, opts) {
  if (!opts.module) throw new UsageError('Lệnh handoff cần --module.');
  if (!opts.out) throw new UsageError('Lệnh handoff cần --out <đường dẫn file giao việc>.');
  const out = path.resolve(opts.out);
  if (fs.existsSync(out) && !opts.force) {
    console.error(`Đã có ${out}. Dùng --force để ghi đè.`);
    return 2;
  }
  const cfg = loadProfile(path.resolve(repo, opts.profile ?? '.claude/builder-loop.md')).config;
  const state = readState(repo, opts.task) ?? newState(opts.task);
  state.module = opts.module;
  state.exchangeDir = slash(path.dirname(out));
  state.handoff = slash(out);
  state.report = slash(path.join(path.dirname(out), `${opts.task}-builder-report.md`));
  state.reviewerPane ||= process.env.HERDR_PANE_ID || '';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, handoffText(repo, opts, state, cfg));
  writeState(repo, state);
  const todo = fs.readFileSync(out, 'utf8').split('\n').filter((l) => l.includes('ĐIỀN')).length;
  console.log(`Đã viết khung ${slash(out)}. Còn ${todo} dòng có chữ ĐIỀN cần reviewer viết.`);
  if (!state.reviewerPane) console.log('[CẢNH BÁO] Chưa biết pane id của reviewer. Đặt bằng state --set reviewerPane=<id> rồi chạy lại với --force.');
  return 0;
}

function cmdFooter(repo, opts) {
  const state = readState(repo, opts.task);
  if (!state?.report) {
    console.error(`Chưa có đường dẫn báo cáo của ${opts.task}. Chạy handoff trước.`);
    return 1;
  }
  console.log(footerText(state.reviewerPane, state.report));
  return 0;
}

// ---------- theo dõi builder ----------

function herdr(args) {
  const r = spawnSync('herdr', args, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  return { ok: r.status === 0, out: r.stdout ?? '' };
}

// herdr agent get trả JSON. Tìm trường status ở mọi tầng để không phụ thuộc vỏ JSON.
function agentStatus(pane) {
  const r = herdr(['agent', 'get', pane]);
  if (!r.ok) return 'mat';
  try {
    const stack = [JSON.parse(r.out)];
    while (stack.length) {
      const v = stack.pop();
      for (const [k, x] of Object.entries(v)) {
        if ((k === 'status' || k === 'state') && typeof x === 'string' && /^(idle|working|blocked|done|unknown)$/.test(x)) return x;
        if (x && typeof x === 'object') stack.push(x);
      }
    }
  } catch {
    // không phải JSON thì coi như unknown
  }
  return 'unknown';
}

function lastStatusAt(state) {
  const e = [...state.events].reverse().find((x) => x.status === state.status);
  return e ? Date.parse(e.at) : 0;
}

// Câu nhắc cần gửi reviewer, hoặc null khi chưa có gì bất thường.
function stuckMessage(state, builder, reportMtime, at = Date.now()) {
  if (state.status !== 'cho-builder') return null;
  const since = lastStatusAt(state);
  if (at - since < GRACE_MS) return null;
  const task = state.task;
  if (builder === 'blocked') return `NHẮC ${task}: builder ${state.builderPane} đang chờ duyệt hoặc đang hỏi (blocked). Đọc màn hình builder và hỏi người dùng trước khi trả lời thay.`;
  if (builder === 'mat') return `NHẮC ${task}: không thấy agent ở pane ${state.builderPane}. Builder có thể đã thoát.`;
  if (builder !== 'idle' && builder !== 'done') return null;
  if (reportMtime && reportMtime > since) return `NHẮC ${task}: builder đã dừng và báo cáo ${state.report} đã cập nhật nhưng chưa có tin XONG. Coi như XONG và review.`;
  return `NHẮC ${task}: builder ${state.builderPane} đã dừng mà chưa có báo cáo mới. Đọc màn hình builder để xem nó kẹt ở đâu.`;
}

async function cmdWatch(repo, opts) {
  const everyMs = Math.max(1, Number(opts.every ?? 5)) * 60_000;
  let lastSent = null;
  for (;;) {
    const state = readState(repo, opts.task);
    if (!state) {
      console.error(`Chưa có file trạng thái của ${opts.task}.`);
      return 1;
    }
    if (['xong', 'dung'].includes(state.status)) {
      console.log(`${opts.task} đã ở trạng thái ${state.status}. Dừng theo dõi.`);
      return 0;
    }
    const builder = state.builderPane ? agentStatus(state.builderPane) : 'mat';
    const mtime = state.report && fs.existsSync(state.report) ? fs.statSync(state.report).mtimeMs : 0;
    const msg = stuckMessage(state, builder, mtime);
    const stamp = new Date().toLocaleTimeString();
    if (msg && msg !== lastSent && state.reviewerPane) {
      const r = herdr(['agent', 'prompt', state.reviewerPane, msg]);
      console.log(`[${stamp}] ${r.ok ? 'Đã nhắc reviewer' : 'Không nhắc được reviewer'}: ${msg}`);
      lastSent = msg;
    } else {
      if (!msg) lastSent = null;
      console.log(`[${stamp}] status=${state.status}, builder=${builder}${msg ? ' (đã nhắc, chờ reviewer)' : ''}`);
    }
    if (opts.once) return msg ? 1 : 0;
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

// ---------- thống kê ----------

function spent(state, status) {
  let total = 0;
  state.events.forEach((e, i) => {
    if (e.status !== status) return;
    const end = state.events[i + 1] ? Date.parse(state.events[i + 1].at) : Date.now();
    total += end - Date.parse(e.at);
  });
  return total;
}

const minutes = (ms) => `${Math.round(ms / 60000)} phút`;

function cmdStats(repo, opts) {
  let states = allStates(repo);
  if (opts.task) states = states.filter((s) => s.task === opts.task);
  if (!states.length) {
    console.log('Chưa có dữ liệu thống kê.');
    return 1;
  }
  states.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  console.log('| Task | Trạng thái | Số lượt | Lỗi chặn theo lượt | Builder làm | Reviewer review |');
  console.log('|---|---|---|---|---|---|');
  const keys = new Map();
  let roundSum = 0;
  for (const s of states) {
    roundSum += s.history.length;
    for (const h of s.history) for (const k of h.keys) keys.set(k, (keys.get(k) ?? new Set()).add(s.task));
    const trend = s.history.map((h) => h.blocking).join(' -> ') || '-';
    console.log(`| ${s.task} | ${s.status} | ${s.history.length} | ${trend} | ${minutes(spent(s, 'cho-builder'))} | ${minutes(spent(s, 'dang-review'))} |`);
  }
  console.log(`\nSố task: ${states.length}. Trung bình ${(roundSum / states.length).toFixed(1)} lượt mỗi task.`);
  if (keys.size) {
    console.log('\nLoại lỗi gặp nhiều nhất (số task):');
    const top = [...keys.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 10);
    for (const [k, t] of top) console.log(`  ${k}: ${t.size} (${[...t].join(', ')})`);
  }
  return 0;
}

// ---------- hàng đợi ----------

function cmdQueue(repo, opts) {
  const file = path.join(stateDir(repo), 'queue.json');
  let q = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { tasks: [], after: 'chỉ báo cáo' };
  const changed = opts.set.length > 0 || opts.after !== undefined || opts.next;
  if (opts.set.length) {
    const tasks = opts.set.flatMap(csv);
    const bad = tasks.find((t) => !TASK_NAME.test(t));
    if (bad) throw new UsageError(`Mã task không hợp lệ: ${bad}`);
    q = { tasks, after: opts.after ?? q.after, createdAt: now() };
  } else if (opts.after !== undefined) q.after = opts.after;
  const next = opts.next ? (q.tasks.shift() ?? null) : null;
  if (changed) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(q, null, 2) + '\n');
  }
  if (opts.next) {
    console.log(next ?? 'Hàng đợi trống.');
    return next ? 0 : 1;
  }
  console.log(`Hàng đợi: ${q.tasks.join(', ') || 'trống'}. Việc sau khi đạt: ${q.after}.`);
  return 0;
}

// ---------- main ----------

const COMMANDS = {
  snapshot: cmdSnapshot,
  diff: cmdDiff,
  cleanup: cmdCleanup,
  state: cmdState,
  round: cmdRound,
  handoff: cmdHandoff,
  footer: cmdFooter,
  watch: cmdWatch,
  stats: cmdStats,
  queue: cmdQueue,
};

async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const repo = git(path.resolve(opts.repo ?? '.'), ['rev-parse', '--show-toplevel']).trim();
    return await COMMANDS[opts.cmd](repo, opts);
  } catch (e) {
    console.error(e.message);
    if (e instanceof UsageError) console.error(USAGE);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();

export { breaker, stuckMessage };

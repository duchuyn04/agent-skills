#!/usr/bin/env node
// Kiểm tự động cho skill builder-loop.
//
// Script làm thay các bước reviewer từng kiểm bằng tay ở mỗi lượt: đường dẫn cấm,
// file sửa ngoài phạm vi commit, tiêu chí bị viết lại, file quá dài, chữ cấm trong
// dòng mới, bằng chứng chạy thật và lỗi lặp lại chưa có kiểm tra chặn.
// Luật lấy từ khối JSON trong mục "Kiểm tự động" của hồ sơ `.claude/builder-loop.md`.
//
// Cách dùng, chạy ở gốc repo (hoặc thêm --repo <thư mục>):
//   node check-task.mjs start --task <mã>
//       Ghi trạng thái toàn bộ thư mục làm việc lúc bắt đầu task vào
//       refs/review/<mã>/start. Lệnh check so với mốc này, nên thay đổi có sẵn
//       của người dùng từ trước task không bị tính cho builder.
//   node check-task.mjs check --task <mã> [--report <file báo cáo của builder>]
//
// Tùy chọn khác: --profile <file hồ sơ>, --base <ref thay cho mốc start>,
// --force (cho start ghi đè mốc đã có).
// Mã thoát: 0 không có LỖI, 1 có LỖI, 2 sai cách dùng hoặc hồ sơ hỏng.
// Script không đổi file nào trong thư mục làm việc và không đổi danh sách stage của repo.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const USAGE = `Cách dùng:
  node check-task.mjs start --task <mã> [--repo <thư mục>] [--force]
  node check-task.mjs check --task <mã> [--report <file>] [--repo <thư mục>] [--profile <file>] [--base <ref>]`;

const DEFAULTS = {
  noStage: [],
  noEdit: [],
  warnEdit: [],
  scope: ['.'],
  scopeExclude: [],
  criteria: [],
  maxLines: 1000,
  textCheck: null,
  bannedText: [],
  evidence: null,
};

const MEDIA_EXT = /\.(png|jpe?g|webp|gif|webm|mp4|mov|zip)$/i;
const CHECKBOX = /^(\s*(?:[-*+]|\d+[.)]|#{1,6})\s+)\[[ xX]\]/;
const CHECKED = /^\s*(?:[-*+]|\d+[.)]|#{1,6})\s+\[[xX]\]/;
const LIST_LIMIT = 20;

class UsageError extends Error {}

// ---------- tiện ích git ----------

function git(repo, args, { env, allowFail = false, buffer = false } = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], {
    cwd: repo,
    env: { ...process.env, ...env },
    encoding: buffer ? 'buffer' : 'utf8',
    maxBuffer: 1 << 29,
  });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFail) {
    const err = buffer ? r.stderr.toString('utf8') : r.stderr;
    throw new Error(`git ${args.join(' ')}: ${err.trim()}`);
  }
  return allowFail ? r : r.stdout;
}

function refExists(repo, ref) {
  return git(repo, ['rev-parse', '--verify', '-q', `${ref}^{commit}`], { allowFail: true }).status === 0;
}

// Ghi toàn bộ thư mục làm việc (trừ file bị .gitignore loại) thành một tree.
// Dùng danh sách stage tạm, nên danh sách stage của repo không đổi.
function workingTree(repo) {
  const index = path.join(os.tmpdir(), `check-task-${process.pid}-${Date.now()}.index`);
  const env = { GIT_INDEX_FILE: index };
  try {
    git(repo, ['read-tree', 'HEAD'], { env });
    git(repo, ['add', '-A', '--', '.'], { env });
    return git(repo, ['write-tree'], { env }).trim();
  } finally {
    fs.rmSync(index, { force: true });
  }
}

function changedFiles(repo, baseCommit, tree) {
  const raw = git(repo, ['diff-tree', '-r', '-z', '--name-status', baseCommit, tree]);
  const parts = raw.split('\0').filter((s) => s !== '');
  const out = [];
  for (let i = 0; i + 1 < parts.length; i += 2) out.push({ status: parts[i][0], file: parts[i + 1] });
  return out;
}

function stagedFiles(repo) {
  return git(repo, ['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
}

function baseContent(repo, commit, file) {
  const r = git(repo, ['cat-file', 'blob', `${commit}:${file}`], { allowFail: true, buffer: true });
  return r.status === 0 ? r.stdout : null;
}

// ---------- hồ sơ ----------

function section(text, title) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${title}`);
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end).join('\n');
}

function loadProfile(file) {
  if (!fs.existsSync(file)) return { text: '', config: { ...DEFAULTS }, note: `không có file hồ sơ ${file}` };
  const text = fs.readFileSync(file, 'utf8');
  const sec = section(text, 'Kiểm tự động');
  if (sec === null) return { text, config: { ...DEFAULTS }, note: 'hồ sơ chưa có mục "Kiểm tự động"' };
  const m = sec.match(/```json[^\n]*\n([\s\S]*?)\n```/);
  if (!m) throw new UsageError('Mục "Kiểm tự động" của hồ sơ không có khối ```json.');
  let config;
  try {
    config = JSON.parse(m[1]);
  } catch (e) {
    throw new UsageError(`Khối JSON trong mục "Kiểm tự động" lỗi: ${e.message}`);
  }
  const unknown = Object.keys(config).filter((k) => !(k in DEFAULTS));
  if (unknown.length) throw new UsageError(`Khóa lạ trong khối "Kiểm tự động": ${unknown.join(', ')}`);
  return { text, config: { ...DEFAULTS, ...config }, note: null };
}

// ---------- so khớp đường dẫn ----------

// Mẫu tính từ gốc repo. `*` khớp trong một tầng thư mục, `**` khớp nhiều tầng,
// mẫu kết thúc bằng `/` là cả thư mục, mẫu không có `/` cuối cũng khớp file bên trong
// nếu đó là thư mục.
function globToRegex(pattern) {
  let p = pattern.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
  if (p === '' || p === '.') return /^/;
  const isDir = p.endsWith('/');
  if (isDir) p = p.slice(0, -1);
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*' && p[i + 1] === '*') {
      if (p[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}${isDir ? '/' : '(?:/|$)'}`);
}

function matcher(patterns) {
  const res = (patterns ?? []).map(globToRegex);
  return (file) => res.some((r) => r.test(file));
}

// ---------- đọc nội dung ----------

const isBinary = (buf) => buf.subarray(0, 8000).includes(0);
const toLines = (buf) => buf.toString('utf8').split(/\r?\n/);

function lineCount(buf) {
  const lines = toLines(buf);
  return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

// Dòng có trong bản mới mà không có trong bản cũ, tính theo số lần xuất hiện.
function addedLines(oldBuf, newBuf) {
  const pool = new Map();
  for (const l of oldBuf ? toLines(oldBuf) : []) pool.set(l, (pool.get(l) ?? 0) + 1);
  const out = [];
  toLines(newBuf).forEach((l, i) => {
    const n = pool.get(l) ?? 0;
    if (n > 0) pool.set(l, n - 1);
    else out.push({ line: i + 1, text: l });
  });
  return out;
}

// ---------- kết quả ----------

class Findings {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.infos = [];
  }
  error(m) { this.errors.push(m); }
  warn(m) { this.warnings.push(m); }
  info(m) { this.infos.push(m); }
  print() {
    for (const m of this.errors) console.log(`[LỖI] ${m}`);
    for (const m of this.warnings) console.log(`[CẢNH BÁO] ${m}`);
    for (const m of this.infos) console.log(`[THÔNG TIN] ${m}`);
    console.log(`\nKết quả: ${this.errors.length} LỖI, ${this.warnings.length} CẢNH BÁO.`);
  }
}

function listing(items, fmt = (x) => x) {
  const shown = items.slice(0, LIST_LIMIT).map((x) => `\n    ${fmt(x)}`).join('');
  const more = items.length > LIST_LIMIT ? `\n    ... và ${items.length - LIST_LIMIT} mục nữa` : '';
  return shown + more;
}

// ---------- các phép kiểm ----------

function checkPaths(f, cfg, staged, changes) {
  const noStage = matcher(cfg.noStage);
  const noEdit = matcher(cfg.noEdit);
  const warnEdit = matcher(cfg.warnEdit);

  const badStaged = staged.filter(noStage);
  if (badStaged.length) {
    f.error(`Đường dẫn cấm đang nằm trong stage. Bỏ stage bằng \`git reset -q -- <đường dẫn>\`:${listing(badStaged)}`);
  }

  const edited = changes.filter((c) => noEdit(c.file));
  if (edited.length) f.error(`File cấm sửa đã bị đổi trong task:${listing(edited, (c) => `${c.status} ${c.file}`)}`);

  const warned = changes.filter((c) => warnEdit(c.file));
  if (warned.length) {
    f.warn(`File chỉ được sửa khi task ghi rõ. Đối chiếu với tiêu chí:${listing(warned, (c) => `${c.status} ${c.file}`)}`);
  }
}

function checkScope(f, changes, inScope, noEdit) {
  const outside = changes.filter((c) => !inScope(c.file) && !noEdit(c.file));
  if (outside.length) {
    f.warn(`File đổi ngoài phạm vi commit. Các thay đổi này không được commit:${listing(outside, (c) => `${c.status} ${c.file}`)}`);
  }
}

function checkSize(f, cfg, repo, baseCommit, files) {
  const big = [];
  for (const c of files) {
    const buf = fs.readFileSync(path.join(repo, c.file));
    if (isBinary(buf)) continue;
    const n = lineCount(buf);
    if (n <= cfg.maxLines) continue;
    const old = baseContent(repo, baseCommit, c.file);
    big.push(`${c.file}: ${n} dòng (lúc bắt đầu task: ${old ? lineCount(old) : 'chưa có file'})`);
  }
  if (big.length) f.warn(`File vượt ${cfg.maxLines} dòng, xem có cần tách không:${listing(big)}`);
}

function checkCriteria(f, cfg, repo, baseCommit, changes) {
  if (!cfg.criteria.length) return;
  const isCriteria = matcher(cfg.criteria);
  const files = changes.filter((c) => isCriteria(c.file));
  if (!files.length) {
    f.warn('Không file tiêu chí nào đổi. Builder chưa tick tiêu chí nào.');
    return;
  }
  const norm = (l) => l.replace(CHECKBOX, '$1[ ]').trimEnd();
  for (const c of files) {
    if (c.status === 'D') {
      f.error(`File tiêu chí bị xóa: ${c.file}`);
      continue;
    }
    const oldBuf = baseContent(repo, baseCommit, c.file);
    const newLines = toLines(fs.readFileSync(path.join(repo, c.file)));
    const oldLines = oldBuf ? toLines(oldBuf) : [];

    // Bỏ dấu tick rồi so: dòng cũ nào không còn trong bản mới là nội dung đã bị sửa hoặc xóa.
    const pool = new Map();
    for (const l of newLines) pool.set(norm(l), (pool.get(norm(l)) ?? 0) + 1);
    const rewritten = [];
    for (const l of oldLines) {
      if (norm(l).trim() === '') continue;
      const n = pool.get(norm(l)) ?? 0;
      if (n > 0) pool.set(norm(l), n - 1);
      else rewritten.push(l.trim());
    }
    if (rewritten.length) {
      f.error(`${c.file}: nội dung tiêu chí cũ bị sửa hoặc xóa. Chỉ được đổi dấu tick và thêm dòng mới:${listing(rewritten)}`);
    }

    const oldExact = new Set(oldLines);
    const newExact = new Set(newLines);
    const ticked = [];
    newLines.forEach((l, i) => {
      if (CHECKED.test(l) && !oldExact.has(l)) ticked.push(`${c.file}:${i + 1} ${l.trim()}`);
    });
    const unticked = oldLines.filter((l) => CHECKED.test(l) && !newExact.has(l) && newLines.some((n) => norm(n) === norm(l)));
    if (unticked.length) f.warn(`${c.file}: tiêu chí đã tick bị bỏ tick:${listing(unticked, (l) => l.trim())}`);
    if (ticked.length) {
      f.info(`Tiêu chí mới tick (${ticked.length}). Mỗi dòng cần có test hoặc bằng chứng chạy thật:${listing(ticked)}`);
    }
  }
}

function checkBannedText(f, cfg, repo, baseCommit, files) {
  cfg.bannedText.forEach((rule, idx) => {
    if (!rule.pattern || !rule.files) throw new UsageError(`bannedText[${idx}] cần có "pattern" và "files".`);
    // Bỏ cờ g: regex có cờ g nhớ vị trí giữa các lần test và bỏ sót dòng khớp.
    const re = new RegExp(rule.pattern, (rule.flags ?? 'u').replace(/g/g, ''));
    const include = matcher(rule.files);
    const exclude = matcher(rule.exclude ?? []);
    const hits = [];
    for (const c of files) {
      if (!include(c.file) || exclude(c.file)) continue;
      const buf = fs.readFileSync(path.join(repo, c.file));
      if (isBinary(buf)) continue;
      for (const a of addedLines(baseContent(repo, baseCommit, c.file), buf)) {
        if (re.test(a.text)) hits.push(`${c.file}:${a.line}: ${a.text.trim().slice(0, 120)}`);
      }
    }
    if (hits.length) f.error(`${rule.message ?? `Dòng mới khớp mẫu cấm ${rule.pattern}`}${listing(hits)}`);
  });
}

function checkText(f, cfg, repo, files) {
  if (!cfg.textCheck) return;
  const spec = typeof cfg.textCheck === 'string' ? { run: cfg.textCheck } : cfg.textCheck;
  const only = spec.files ? matcher(spec.files) : () => true;
  const targets = files
    .filter((c) => only(c.file))
    .filter((c) => !isBinary(fs.readFileSync(path.join(repo, c.file))))
    .map((c) => c.file);
  if (!targets.length) return;
  const quote = (s) => `"${s.replace(/"/g, '\\"')}"`;
  for (let i = 0; i < targets.length; i += 40) {
    const chunk = targets.slice(i, i + 40);
    const r = spawnSync(`${spec.run} ${chunk.map(quote).join(' ')}`, { cwd: repo, shell: true, encoding: 'utf8' });
    if (r.status !== 0) {
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split(/\r?\n/);
      f.error(`Lệnh kiểm chữ \`${spec.run}\` báo lỗi (mã thoát ${r.status}):${listing(out)}`);
    }
  }
  f.info(`Lệnh kiểm chữ \`${spec.run}\` đã quét ${targets.length} file.`);
}

function extractEvidence(text) {
  const found = new Set();
  // Đường dẫn trong backtick được nhận cả khi có dấu cách, nếu trông như đường dẫn.
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const s = m[1].trim();
    if (!/\s/.test(s) || /^([A-Za-z]:[\\/]|\/|~\/|\.\.?[\\/])/.test(s)) found.add(s);
  }
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) found.add(m[1]);
  const bare = text.replace(/`[^`\n]*`/g, ' ').replace(/\]\([^)\s]+\)/g, ' ');
  for (const m of bare.matchAll(/(?:^|[\s(])((?:[A-Za-z]:)?[^\s`()<>"'|]+)/gm)) {
    found.add(m[1].replace(/[.,;:]+$/, ''));
  }
  return [...found].filter((s) => MEDIA_EXT.test(s));
}

function resolveEvidence(p, reportDir, repo) {
  let s = p.replace(/^<|>$/g, '');
  if (process.platform === 'win32') {
    const drive = s.match(/^\/([a-zA-Z])\/(.*)$/);
    if (drive) s = `${drive[1].toUpperCase()}:/${drive[2]}`;
    else if (s.startsWith('/tmp/')) s = path.join(os.tmpdir(), s.slice(5));
  }
  if (s.startsWith('~/')) s = path.join(os.homedir(), s.slice(2));
  if (path.isAbsolute(s)) return [s];
  return [path.resolve(reportDir, s), path.resolve(repo, s)];
}

function checkEvidence(f, cfg, repo, baseTime, changes, inScope, reportPath) {
  const uiPaths = cfg.evidence?.uiPaths ?? [];
  const isUi = matcher(uiPaths);
  const uiFiles = uiPaths.length ? changes.filter((c) => inScope(c.file) && isUi(c.file)).map((c) => c.file) : [];

  if (!reportPath) {
    if (uiFiles.length) f.warn('Diff chạm giao diện. Chạy lại với --report <file báo cáo> để kiểm ảnh và video.');
    return;
  }
  if (!fs.existsSync(reportPath)) {
    f.error(`Không thấy file báo cáo: ${reportPath}`);
    return;
  }
  const reportDir = path.dirname(path.resolve(reportPath));
  const refs = extractEvidence(fs.readFileSync(reportPath, 'utf8'));
  const missing = [];
  const stale = [];
  let valid = 0;
  for (const p of refs) {
    const hit = resolveEvidence(p, reportDir, repo).find((c) => fs.existsSync(c));
    if (!hit) {
      missing.push(p);
      continue;
    }
    const st = fs.statSync(hit);
    if (st.size === 0) {
      missing.push(`${p} (file rỗng)`);
      continue;
    }
    valid++;
    if (st.mtimeMs < baseTime) stale.push(p);
  }
  if (missing.length) f.error(`Báo cáo nhắc tới bằng chứng không tồn tại:${listing(missing)}`);
  if (stale.length) f.warn(`Bằng chứng có từ trước khi task bắt đầu, có thể không phải của lượt này:${listing(stale)}`);
  if (uiFiles.length && valid === 0) {
    f.error(`Diff chạm giao diện nhưng báo cáo không có ảnh hoặc video nào:${listing(uiFiles)}`);
  }
  if (refs.length) f.info(`Bằng chứng trong báo cáo: ${valid} file hợp lệ trên ${refs.length} đường dẫn.`);
}

function checkRepeated(f, profileText) {
  const sec = section(profileText, 'Lỗi lặp lại');
  if (sec === null) return;
  const rows = sec
    .split(/\r?\n/)
    .filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s|:-]+\|\s*$/.test(l))
    .slice(1);
  const open = [];
  for (const row of rows) {
    const cells = row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
    if (cells.length < 4) continue;
    const [key, desc, tasks, blocked] = cells;
    const count = tasks.split(/[,;]/).map((s) => s.trim()).filter(Boolean).length;
    if (count >= 2 && /^(chưa|không|-|)$/i.test(blocked)) open.push(`${key} (${count} task): ${desc}`);
  }
  if (open.length) {
    f.warn(`Lỗi đã lặp lại ở từ 2 task trở lên mà chưa có kiểm tra tự động. Đề xuất cách chặn cho người dùng:${listing(open)}`);
  }
}

// ---------- lệnh ----------

function cmdStart(repo, opts) {
  const ref = `refs/review/${opts.task}/start`;
  if (refExists(repo, ref) && !opts.force) {
    console.error(`Đã có ${ref}. Mốc này phải giữ nguyên suốt task. Dùng --force nếu thật sự muốn ghi lại.`);
    return 2;
  }
  const tree = workingTree(repo);
  const commit = git(repo, ['commit-tree', tree, '-p', 'HEAD', '-m', `review start ${opts.task}`]).trim();
  git(repo, ['update-ref', ref, commit]);
  console.log(`Đã ghi mốc bắt đầu task ${opts.task}: ${ref} = ${commit.slice(0, 10)}`);
  return 0;
}

function cmdCheck(repo, opts) {
  const profilePath = path.resolve(repo, opts.profile ?? '.claude/builder-loop.md');
  const profile = loadProfile(profilePath);
  const cfg = profile.config;
  const f = new Findings();
  if (profile.note) f.warn(`${profile.note}. Script chỉ kiểm theo giá trị mặc định.`);

  let base = opts.base;
  if (!base) {
    const start = `refs/review/${opts.task}/start`;
    const zero = `refs/review/${opts.task}/0`;
    if (refExists(repo, start)) base = start;
    else if (refExists(repo, zero)) {
      base = zero;
      f.warn(`Chưa có ${start}, so với ảnh chụp 0. File ngoài phạm vi commit được so với HEAD, nên thay đổi có sẵn của người dùng ở đó cũng bị liệt kê.`);
    } else {
      base = 'HEAD';
      f.warn('Không có ảnh chụp nào của task, so với HEAD.');
    }
  }
  const baseCommit = git(repo, ['rev-parse', '--verify', `${base}^{commit}`]).trim();
  const baseTime = Number(git(repo, ['show', '-s', '--format=%ct', baseCommit]).trim()) * 1000;

  const changes = changedFiles(repo, baseCommit, workingTree(repo));
  const staged = stagedFiles(repo);
  const noStage = matcher(cfg.noStage);
  const noEdit = matcher(cfg.noEdit);
  const scope = matcher(cfg.scope.length ? cfg.scope : ['.']);
  const scopeExclude = matcher(cfg.scopeExclude);
  const inScope = (file) => scope(file) && !scopeExclude(file) && !noStage(file);
  const live = changes.filter((c) => c.status !== 'D' && inScope(c.file));

  f.info(`So với ${base} (${baseCommit.slice(0, 10)}). File đổi: ${changes.length}, trong phạm vi commit: ${changes.filter((c) => inScope(c.file)).length}.`);

  checkPaths(f, cfg, staged, changes);
  checkScope(f, changes, inScope, noEdit);
  checkSize(f, cfg, repo, baseCommit, live);
  checkCriteria(f, cfg, repo, baseCommit, changes);
  checkBannedText(f, cfg, repo, baseCommit, live);
  checkText(f, cfg, repo, live);
  checkEvidence(f, cfg, repo, baseTime, changes, inScope, opts.report);
  checkRepeated(f, profile.text);

  console.log(`check-task ${opts.task}\n`);
  f.print();
  return f.errors.length ? 1 : 0;
}

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = { cmd };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--force') {
      opts.force = true;
      continue;
    }
    if (!a.startsWith('--') || i + 1 >= rest.length) throw new UsageError(`Tham số không hợp lệ: ${a}`);
    opts[a.slice(2)] = rest[++i];
  }
  if (!['start', 'check'].includes(cmd)) throw new UsageError('Lệnh phải là start hoặc check.');
  if (!opts.task) throw new UsageError('Thiếu --task.');
  if (!/^[A-Za-z0-9._-]+$/.test(opts.task)) throw new UsageError('Mã task chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối.');
  return opts;
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const repo = git(path.resolve(opts.repo ?? '.'), ['rev-parse', '--show-toplevel']).trim();
    return opts.cmd === 'start' ? cmdStart(repo, opts) : cmdCheck(repo, opts);
  } catch (e) {
    console.error(e.message);
    if (e instanceof UsageError) console.error(USAGE);
    return 2;
  }
}

process.exitCode = main();

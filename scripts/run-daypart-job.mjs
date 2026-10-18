// Local, date-bound operator job. Token is loaded only by the child capture
// process from .env; it is never passed as an argument or copied to the relay.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const [date, period, option] = process.argv.slice(2);
if (date !== '2026-10-19' || !['lunch', 'dinner'].includes(period)) throw new Error('INVALID_SCHEDULE');
const start = Date.parse(`${date}T${period === 'lunch' ? '11:30' : '18:30'}:00+08:00`);
const inWindow = Date.now() >= start && Date.now() < start + 3 * 3600_000;
if (option === '--check') {
  console.log(JSON.stringify({ date, period, inWindow, node: process.execPath, root, tokenFilePresent: existsSync('.env') }));
  process.exit(0);
}
mkdirSync('.local/menu-captures', { recursive: true, mode: 0o700 });
const statePath = `.local/menu-captures/${date}-${period}-job.json`;
const state = { date, period, startedAt: new Date().toISOString(), status: 'pending', pushed: false };
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', timeout: 60_000 }).trim();
function load(path) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return undefined; } }

export function writeProgress() {
  const text = [
    '# 麦麦现拼 · 20261019 补菜单进度', '',
    `更新：${new Date().toISOString()}。真实采集未完成前不记为完成；390px 发起页截图与新界面媒体仍待真实菜单到齐后验。`, '',
    '分支：ui/nana-mcd-theme；保留 4c68d1d 的主题和 84/72px 托盘。main 尚未合并本批次。', '',
    `当前本机代码提交：${git('rev-parse', 'HEAD')}。`, '',
  ];
  for (const p of ['lunch', 'dinner']) {
    const report = load(`.local/menu-captures/${date}-${p}.json`);
    const job = load(`.local/menu-captures/${date}-${p}-job.json`);
    text.push(`## ${p === 'lunch' ? '午市' : '晚市'}`, '',
      report ? `真实采集 ${report.startedAt} 至 ${report.finishedAt ?? '进行中'}；状态 ${report.status}；只读调用 ${report.callCount} 次。` : '尚无真实采集记录。',
      job ? `本机任务：${job.status}；提交：${job.commit ?? '尚未提交'}；已推送：${Boolean(job.pushed)}。` : '本机任务已排在当日 11:35 / 18:35，尚未运行。', '');
    for (const store of report?.stores ?? []) {
      text.push(`- ${store.storeCode}：本轮完整采集 ${store.captured.length} 个；可回放候选 ${store.offered?.length ?? 0} 个。`);
      for (const meal of store.offered ?? []) text.push(`  - ${meal.code} ${meal.name}`);
      if (store.error) text.push(`  - 错误：${store.error}`);
      if (store.rejected?.length) text.push(`  - 未采成 ${store.rejected.length} 个，原始只读记录与原因留在 MacBook .local。`);
    }
    for (const error of report?.errors ?? []) text.push(`- ${error}`);
    text.push('');
  }
  text.push('边界：仅门店/菜单/明细/算价；不查券、不下单；未部署、未转公开、未报名。');
  const path = `.local/menu-captures/20261019-maimai-xianpin-more-meals-PROGRESS.md`;
  const body = text.join('\n') + '\n';
  writeFileSync(path, body, { mode: 0o600 });
  const target = '/home/ajingops/mimo-work/tasks/20261019-maimai-xianpin-more-meals-PROGRESS.md';
  execFileSync('scp', [path, `hostdzire-inbox:${target}.macbook.tmp`], { timeout: 60_000 });
  const hash = execFileSync('ssh', ['hostdzire-inbox', `mv ${target}.macbook.tmp ${target} && sha256sum ${target}`], { encoding: 'utf8', timeout: 60_000 }).split(/\s/)[0];
  if (hash !== createHash('sha256').update(body).digest('hex')) throw new Error('RELAY_HASH_MISMATCH');
  return hash;
}

if (option === '--receipt') {
  console.log('Progress receipt SHA-256:', writeProgress());
  process.exit(0);
}
try {
  if (!inWindow) throw new Error('OUTSIDE_CAPTURE_WINDOW');
  const branch = git('branch', '--show-current');
  const clean = git('status', '--porcelain') === '';
  const baseline = git('rev-parse', 'HEAD');
  const capture = spawnSync(process.execPath, ['--env-file-if-exists=.env', '--import', 'tsx', 'scripts/capture-daypart.ts', date, period], { stdio: 'inherit', timeout: 3 * 3600_000 });
  if (capture.status !== 0) throw new Error('CAPTURE_PROCESS_FAILED');
  const report = load(`.local/menu-captures/${date}-${period}.json`);
  if (!report?.finishedAt) throw new Error('CAPTURE_REPORT_MISSING');
  state.captureStatus = report.status;
  for (const args of [['run', 'typecheck'], ['test']]) {
    if (spawnSync('/usr/local/bin/npm', args, { stdio: 'inherit', timeout: 120_000 }).status !== 0) throw new Error('CAPTURE_CHECK_FAILED');
  }
  // Capture even if someone has switched branches, but never commit their work.
  if (!clean || !['ui/nana-mcd-theme', ''].includes(branch) || git('branch', '--show-current') !== branch || git('rev-parse', 'HEAD') !== baseline) throw new Error('CAPTURE_SAVED_REVIEW_NEEDED');
  git('fetch', 'origin', 'ui/nana-mcd-theme');
  if (git('rev-parse', 'origin/ui/nana-mcd-theme') !== baseline) throw new Error('REMOTE_ADVANCED_REVIEW_NEEDED');
  const allowed = ['fixtures/mcp-calls.json', 'fixtures/mcp-tools.json', 'fixtures/manifest.json'];
  const changed = git('diff', '--name-only').split('\n').filter(Boolean);
  if (changed.some(path => !allowed.includes(path)) || git('diff', '--cached', '--name-only')) throw new Error('WORKTREE_CHANGED_REVIEW_NEEDED');
  if (changed.length) {
    git('add', '--', ...allowed);
    git('diff', '--cached', '--check');
    git('commit', '-m', `data: capture ${date} ${period} store menus (${report.status})`);
    state.commit = git('rev-parse', 'HEAD');
    git('push', 'origin', 'HEAD:ui/nana-mcd-theme');
    state.pushed = true;
  }
  state.status = report.status === 'captured' ? 'captured_and_checked_screenshot_pending' : 'partial_capture_review_needed';
} catch (error) {
  state.status = /^[A-Z_]+$/.test(error.message ?? '') ? error.message : 'LOCAL_JOB_FAILED';
} finally {
  state.finishedAt = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  try { console.log('Progress receipt SHA-256:', writeProgress()); }
  catch { console.error('PROGRESS_RELAY_FAILED'); }
  console.log('Local capture job:', state.status);
}

import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'artifacts', 'lab-04', 'screenshots');
const project = JSON.parse(execFileSync('gh', [
  'project', 'item-list', '2', '--owner', 'Ohmmykung09', '--format', 'json'
], { cwd: root, encoding: 'utf8' }));
const history = execFileSync('git', [
  'log', '--graph', '--decorate', '--oneline', '--all', '--max-count=24'
], { cwd: root, encoding: 'utf8' }).trim();
const issues = project.items
  .filter(({ content }) => content?.type === 'Issue' && content.number >= 48 && content.number <= 56)
  .map(({ content, status }) => ({
    number: content.number,
    title: content.title,
    status: status || 'No status'
  }))
  .sort((a, b) => a.number - b.number);

if (issues.length !== 9) {
  throw new Error(`Expected 9 Lab 4 project issues (#48–#56), received ${issues.length}.`);
}

const statuses = ['Backlog', 'Specified', 'Started', 'PR Review', 'Fixing', 'Done'];
const unexpectedStatuses = issues.filter(({ status }) => !statuses.includes(status));
if (unexpectedStatuses.length > 0) {
  const details = unexpectedStatuses.map(({ number, status }) => `#${number}: ${status}`).join(', ');
  throw new Error(`Unsupported Project status; refusing to omit issue cards from the evidence image: ${details}`);
}

const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const capturedAt = new Date().toISOString();
const boardColumns = statuses.map((status) => {
  const cards = issues.filter((issue) => issue.status === status);
  return `<section class="column"><header><strong>${escape(status)}</strong><span>${cards.length}</span></header><div class="cards">${cards.map((issue) => `<article><small>#${issue.number}</small><b>${escape(issue.title)}</b><small class="status">${escape(issue.status)}</small></article>`).join('')}</div></section>`;
}).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#f6f8fa;color:#1f2328;font:16px/1.4 "Segoe UI",Arial,sans-serif}.wrap{padding:36px}.top{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px}.eyebrow{color:#59636e;font-size:13px;text-transform:uppercase;letter-spacing:.08em}.top h1{font-size:30px;margin:4px 0}.top p{margin:0;color:#59636e}.board{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;align-items:start}.column{background:#ebeff3;border-radius:10px;padding:12px;min-height:875px}.column header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:0 3px 9px;border-bottom:1px solid #d0d7de}.column header span{background:#d8dee4;border-radius:20px;padding:1px 9px;color:#59636e}.cards{display:flex;flex-direction:column;gap:10px}article{background:white;border:1px solid #d0d7de;border-radius:8px;padding:13px;box-shadow:0 1px 2px #1f23281a;min-height:80px}article b{display:block;font-size:14px;margin:5px 0 8px}article small{font-size:12px;color:#59636e}.status{display:none}.footer{margin-top:18px;color:#59636e;font-size:12px}.history{background:#0d1117;color:#e6edf3;padding:34px 40px;border-radius:12px;font:15px/1.65 Consolas,"Cascadia Code",monospace;white-space:pre;overflow:hidden}.caption{color:#59636e;font-size:13px;margin:12px 2px 0}
</style></head><body><main class="wrap"><div class="top"><div><div class="eyebrow">GitHub Project #2 · CLI-sourced snapshot</div><h1>TokTickIT — Lab 4 issue status</h1><p>Project cards #48–#56 · ${issues.length} linked issues</p></div><div class="eyebrow">Captured ${escape(capturedAt)}</div></div><div class="board">${boardColumns}</div><p class="footer">Data source: authenticated GitHub CLI gh project item-list 2 --owner Ohmmykung09. This locally rendered evidence image preserves the live issue titles and status fields.</p></main></body></html>`;

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1880, height: 1010 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(output, 'project-board-lab4.png'), fullPage: true });

  await page.setViewportSize({ width: 1800, height: 1040 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0d1117;color:#e6edf3;font:15px/1.7 Consolas,"Cascadia Code",monospace}.wrap{padding:30px 38px}.title{font:600 25px/1.3 "Segoe UI",Arial,sans-serif;margin-bottom:6px}.subtitle{font:13px "Segoe UI",Arial,sans-serif;color:#9da7b3;margin-bottom:24px}.graph{white-space:pre;}</style><div class="wrap"><div class="title">TokTickIT · Lab 4 integrated commit history</div><div class="subtitle">Git graph from the local checkout · ${escape(capturedAt)} · includes feature refs, origin/lab4-staging, and origin/main</div><div class="graph">${escape(history)}</div></div>`, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(output, 'commit-history-lab4.png'), fullPage: true });
} finally {
  await browser.close();
}

console.log(`Rendered evidence from ${issues.length} project issues and ${history.split('\n').length} commit graph rows at ${output}.`);

// Record public UI and dated testnet evidence. Never load signer keys or fake wallet state.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.VEIL_PLAYWRIGHT_MODULE || 'playwright');
const ffmpeg = process.env.VEIL_FFMPEG || 'ffmpeg';
const output = fileURLToPath(new URL('../results/video-assets/green-ui/', import.meta.url));
const appUrl = 'https://veil-eta-khaki.vercel.app';
const recaptureId = process.argv.find((arg) => arg.startsWith('--recapture='))?.split('=')[1];
const renderSceneId = recaptureId || process.argv.find((arg) => arg.startsWith('--render-scene='))?.split('=')[1];
const scenes = JSON.parse(await readFile(new URL('../docs/narrated-tour-scenes.json', import.meta.url), 'utf8'));
if (renderSceneId && !scenes.some((scene) => scene.id === renderSceneId)) throw new Error('Unknown scene');
const timing = JSON.parse(await readFile(new URL('../results/narrated-tour-timing.json', import.meta.url), 'utf8'));
const demoPath = 'results/demo-20261111221900.json', daoPath = 'results/demo-dao-20261111220608.json';
const demoBytes = await readFile(new URL('../' + demoPath, import.meta.url)), daoBytes = await readFile(new URL('../' + daoPath, import.meta.url));
const demo = JSON.parse(demoBytes), dao = JSON.parse(daoBytes);
if (scenes.reduce((n, s) => n + s.seconds, 0) !== 117 || timing.duration_seconds !== 117 || timing.truncated_speech) throw new Error('Narration must fit the complete 117-second scene plan');
if (demo.scan.found !== 3 || dao.status !== 'PASS' || dao.scan.found !== 1) throw new Error('Unexpected source evidence');
await mkdir(output, { recursive: true });
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const short = (s) => `${s.slice(0, 12)}…${s.slice(-12)}`;
const browser = await chromium.launch({ headless: true });
const report = {
  recordedAt: new Date().toISOString(), appUrl, type: 'CURRENT_UI_WITH_PRIOR_TESTNET_EVIDENCE',
  walletTransactionsSubmitted: false, walletSignedIn: false, privateKeysLoaded: false,
  syntheticNarration: true, durationSeconds: 117, pageErrors: [], scenes: [],
  evidence: [demoPath, daoPath].map((path, i) => ({ path, sha256: createHash('sha256').update(i ? daoBytes : demoBytes).digest('hex') })),
  editor: 'Playwright + Windows System.Speech + FFmpeg',
  clipdio: 'Browser requires email sign-in; desktop download requires email submission. Neither was performed.',
};
function evidenceHtml(kind) {
  let title, body, source = demoPath;
  const sendRows = demo.sends.map((s, i) => `<tr><td>0${i + 1}</td><td>${escape(s.sender)}</td><td class="mono">${escape(short(s.stealthAccount))}</td><td>0.01 NEAR</td></tr>`).join('');
  if (kind === 'send') {
    title = 'Three senders. Three fresh accounts.';
    body = `<table><thead><tr><th>Payment</th><th>Sender</th><th>One-time destination</th><th>Amount</th></tr></thead><tbody>${sendRows}</tbody></table><div class="hashes">${demo.sends.map((s, i) => `<p><span>Transaction ${i + 1}</span><code>${escape(s.hash)}</code></p>`).join('')}</div>`;
  } else if (kind === 'scan') {
    title = 'The recipient found all three payments.';
    body = `<div class="metric"><strong>3 / 3</strong><p>Owned payments matched<br />by the recipient scanner</p></div><table><thead><tr><th>Payment</th><th>Sender</th><th>Matched account</th><th>Received</th></tr></thead><tbody>${sendRows}</tbody></table><p class="note">This is the earlier verified scan result, not a scan performed in this recording.</p>`;
  } else if (kind === 'spend') {
    title = 'A one-time account can spend.';
    body = `<div class="status">Recorded spend completed</div><p class="label">Transaction hash</p><code class="large-hash">${escape(demo.spend.hash)}</code><p class="explorer">testnet.nearblocks.io/txns/${escape(demo.spend.hash)}</p><div class="warning"><h2>Spending can reveal a link.</h2><p>Sending to your named account connects that identity to the one-time account.<br />The current app warns before its 0.001 NEAR spend.</p></div>`;
  } else {
    title = 'A DAO can make a private payout.'; source = daoPath;
    body = `<dl><dt>DAO</dt><dd>${escape(dao.daoId)}</dd><dt>Sole council member</dt><dd>${escape(dao.council[0])}</dd><dt>Recipient scan</dt><dd class="positive">1 owned payment found</dd></dl><p class="label">Council approval transaction</p><code class="large-hash">${escape(dao.approvals[0].split('/').at(-1))}</code><p class="note">Recorded on testnet. There is no DAO proposal screen in the web app.</p>`;
  }
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Veil: recorded testnet evidence</title><style>
    *{box-sizing:border-box}body{margin:0;background:#111713;color:#edf4ee;font:20px/1.5 'Segoe UI',sans-serif;padding:38px 60px;height:608px;overflow:hidden}
    .eyebrow{color:#65d6a0;letter-spacing:.12em;font-size:14px;text-transform:uppercase;margin:0 0 12px}h1{font-size:38px;line-height:1.15;letter-spacing:-.02em;margin:0 0 25px;font-weight:600}h2{font-size:24px;margin:0 0 8px}
    table{width:100%;border-collapse:collapse;font-size:18px}th{font-size:14px;color:#a3b0a7;font-weight:500;text-align:left}td,th{padding:12px 10px;border-bottom:1px solid #344239}td:first-child{color:#65d6a0}
    .mono,code{font-family:Consolas,monospace}code{color:#d7e8dd}.hashes{margin-top:16px}.hashes p{display:flex;gap:30px;margin:7px 0;font-size:17px}.hashes span{color:#a3b0a7;min-width:128px}
    .source{position:absolute;bottom:28px;left:60px;font-size:14px;color:#a3b0a7}.metric{display:flex;align-items:center;gap:32px;margin:8px 0 24px}.metric strong{font-size:64px;line-height:1;color:#65d6a0}.metric p{font-size:20px;margin:0;color:#a3b0a7}
    .note{font-size:17px;color:#a3b0a7;margin:20px 0 0}.status{color:#65d6a0;border-left:3px solid #65d6a0;padding-left:14px;margin:18px 0 32px}.label{color:#a3b0a7;font-size:16px;margin:20px 0 8px}.large-hash{font-size:24px;display:block}.explorer{font-size:16px;color:#a3b0a7;margin-top:8px}.warning{border-top:1px solid #344239;padding-top:25px;margin-top:30px}.warning p{color:#c5d1c8;font-size:20px;margin:0}dl{display:grid;grid-template-columns:260px 1fr;gap:14px 24px;margin:24px 0 30px}dt{color:#a3b0a7}dd{margin:0}.positive{color:#65d6a0}
    </style><p class="eyebrow">Recorded testnet evidence · 11 November 2026</p><h1>${escape(title)}</h1>${body}<p class="source">Source: ${source} · Public transaction receipts</p></html>`;
}
async function focusPanel(page, selector) {
  await page.locator(selector).evaluate((el) => el.closest('.panel').scrollIntoView({ block: 'center', behavior: 'instant' }));
}
async function highlight(page, selector) {
  await page.locator(selector).evaluate((el) => { el.style.outline = '2px solid #65d6a0'; el.style.outlineOffset = '5px'; });
}
async function recordScene(scene) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 608 }, recordVideo: { dir: output, size: { width: 1280, height: 608 } } });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push({ scene: scene.id, error: error.message }));
  let live = !['scan', 'spend', 'dao'].includes(scene.id);
  if (live) {
    const response = await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 45000 });
    if (!response.ok() || !(await page.locator('#hero-title').textContent()).includes('Keep each payment separate.')) throw new Error('Expected restored green UI');
    await page.waitForFunction(() => document.querySelector('#scan-output').textContent !== 'No scan yet.', null, { timeout: 45000 });
    if (scene.id === 'register') await focusPanel(page, '#resolve');
    if (scene.id === 'send') await focusPanel(page, '#recipient');
    if (scene.id === 'auditor') await focusPanel(page, '#view-key');
    if (scene.id === 'limits') await page.locator('footer').scrollIntoViewIfNeeded();
  } else await page.setContent(evidenceHtml(scene.id));
  await page.waitForTimeout(350);
  const started = Date.now();
  const at = async (seconds, action) => { const remaining = started + seconds * 1000 - Date.now(); if (remaining > 0) await page.waitForTimeout(remaining); if (action) await action(); };
  if (scene.id === 'intro') {
    await at(3, () => highlight(page, '#registry-id'));
  } else if (scene.id === 'enable') {
    await at(0.5, () => page.locator('#connect').click());
    await page.getByText('Select wallet', { exact: false }).waitFor({ timeout: 8000 });
    await at(4, () => page.mouse.click(10, 10));
    await page.getByText('Select wallet', { exact: false }).waitFor({ state: 'hidden', timeout: 3000 });
    await page.reload({ waitUntil: 'networkidle' }); // Restore the real disconnected state after cancelling the chooser.
    await at(5, () => focusPanel(page, '#enable'));
    await at(6, () => highlight(page, '#enable'));
    await at(10, () => highlight(page, '#register'));
  } else if (scene.id === 'register') {
    await at(0.5, () => page.locator('#resolve').click());
    await page.waitForFunction(() => document.querySelector('#resolve-output').textContent.includes('spend_pub_hex'), null, { timeout: 8000 });
    await at(3, () => highlight(page, '#resolve-output'));
  } else if (scene.id === 'send') {
    await at(0.5, () => page.locator('#recipient').fill('alice.veil-williams.testnet'));
    await at(2, () => page.locator('#amount').fill('0.01'));
    await at(3, () => highlight(page, '#send'));
    await at(8, () => page.setContent(evidenceHtml('send')));
  } else if (scene.id === 'auditor') {
    await at(1, () => page.locator('#auditor-name').fill('alice.veil-williams.testnet'));
    await at(3, () => highlight(page, '#view-key'));
    await at(7, () => highlight(page, '#auditor-output'));
  } else if (scene.id === 'limits') {
    await at(1, () => highlight(page, 'footer'));
  }
  if (Date.now() - started > scene.seconds * 1000 + 200) throw new Error(`Scene action overran: ${scene.id}`);
  await at(scene.seconds + 2); // Tail padding is removed in render, not spoken audio.
  const video = page.video(); await context.close();
  const path = `${output}${scene.id}.webm`; await video.saveAs(path); await video.delete();
  report.scenes.push({ id: scene.id, seconds: scene.seconds, scope: scene.scope, source: live ? appUrl : scene.id === 'dao' ? daoPath : demoPath });
  console.log(`Captured ${scene.id}: ${scene.seconds}s (${scene.scope})`);
}
async function run(args, { allowFailure = false } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { cwd: output, windowsHide: true }); let log = '';
    child.stderr.on('data', (data) => { log += data; if (log.length > 100000) log = log.slice(-100000); });
    child.on('error', reject);
    child.on('close', (code) => code && !allowFailure ? reject(new Error(`FFmpeg exited ${code}: ${log.slice(-3000)}`)) : resolve(log));
  });
}
async function mediaInfo(path) {
  const log = await run(['-hide_banner', '-i', path], { allowFailure: true });
  const duration = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
  if (!duration) throw new Error('Cannot probe media: ' + path);
  return { seconds: Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]), log };
}
async function makeHeader(scene, index) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 72 } });
  const scope = scene.scope === 'LIVE_UI' ? 'LIVE UI · TESTNET' : scene.scope === 'RECORDED_EVIDENCE' ? 'RECORDED EVIDENCE · 11 NOV 2026' : 'LIVE FORM + RECORDED TRANSACTIONS';
  await page.setContent(`<html><style>body{margin:0;background:#0a0e0c;color:#edf4ee;display:flex;align-items:center;height:72px;padding:0 40px;font:26px 'Segoe UI',sans-serif;gap:20px}span{color:#65d6a0;font-size:19px}strong{font-weight:500}aside{margin-left:auto;text-align:right;font-size:16px;color:#a3b0a7}small{display:block;font-size:14px;margin-top:4px}</style><span>${String(index + 1).padStart(2, '0')} / 09</span><strong>${escape(scene.title)}</strong><aside>${scope}<small>veil-eta-khaki.vercel.app</small></aside></html>`);
  await page.screenshot({ path: `${output}${scene.id}-header.png` }); await page.close();
}
function stamp(seconds, ass = false) {
  const ms = Math.round(seconds * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${ass ? h : String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${ass ? '.' + String(Math.floor(ms % 1000 / 10)).padStart(2, '0') : ',' + String(ms % 1000).padStart(3, '0')}`;
}
async function captions() {
  const cues = JSON.parse(await readFile(`${output}sentence-cues.json`, 'utf8'));
  for (const scene of timing.scenes) {
    const sceneCues = cues.filter((cue) => cue.scene === scene.id);
    if (sceneCues.map((cue) => cue.text).join(' ') !== scenes.find((s) => s.id === scene.id).text) throw new Error('Incomplete caption text: ' + scene.id);
    if (sceneCues.some((cue) => cue.start < scene.start || cue.end > scene.end || cue.end <= cue.start)) throw new Error('Invalid caption timing: ' + scene.id);
  }
  const srt = cues.map((cue, i) => `${i + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n');
  const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Segoe UI,32,&H00F2F4F0,&H00F2F4F0,&H00100E0A,&H00100E0A,0,0,0,0,100,100,0,0,1,1,0,2,100,100,16,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` + cues.map((c) => `Dialogue: 0,${stamp(c.start, true)},${stamp(c.end, true)},Default,,0,0,0,,${c.text.replace(/[{}]/g, '')}`).join('\n');
  await writeFile(`${output}captions.ass`, ass); await writeFile(new URL('../results/veil-demo-green-ui.srt', import.meta.url), srt);
  report.captionCount = cues.length;
}
try {
  if (recaptureId) {
    const captured = JSON.parse(await readFile(`${output}capture-manifest.json`, 'utf8'));
    report.scenes = captured.scenes.filter((s) => s.id !== recaptureId); report.pageErrors = captured.pageErrors.filter((e) => e.scene !== recaptureId);
    const scene = scenes.find((s) => s.id === recaptureId);
    if (!scene) throw new Error('Unknown scene to recapture');
    await recordScene(scene); report.scenes.sort((a, b) => scenes.findIndex((s) => s.id === a.id) - scenes.findIndex((s) => s.id === b.id));
    await writeFile(`${output}capture-manifest.json`, JSON.stringify(report, null, 2));
  } else if (!process.argv.includes('--render-only')) {
    for (const scene of scenes) await recordScene(scene);
    await writeFile(`${output}capture-manifest.json`, JSON.stringify(report, null, 2));
  } else {
    const captured = JSON.parse(await readFile(`${output}capture-manifest.json`, 'utf8'));
    report.recordedAt = captured.recordedAt; report.scenes = captured.scenes; report.pageErrors = captured.pageErrors;
  }
  if (report.pageErrors.length) throw new Error('Recording contains browser runtime errors');
  if (process.argv.includes('--capture-only')) {
    console.log('Capture saved; rendering deferred.');
  } else {
  for (const [i, scene] of scenes.entries()) {
    if (process.argv.includes('--assemble-only')) continue;
    if (renderSceneId && scene.id !== renderSceneId) continue;
    await makeHeader(scene, i);
    const { seconds } = await mediaInfo(`${scene.id}.webm`);
    if (seconds < scene.seconds + 1.8) throw new Error('Captured clip too short: ' + scene.id);
    const trimStart = report.scenes.find((s) => s.id === scene.id)?.trimStartSeconds ?? Math.max(0, seconds - scene.seconds - 2);
    if (trimStart < 0 || trimStart + scene.seconds > seconds) throw new Error('Invalid reviewed clip trim');
    await run(['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(trimStart), '-i', `${scene.id}.webm`, '-loop', '1', '-i', `${scene.id}-header.png`, '-filter_complex', '[0:v]fps=30,scale=1920:912,pad=1920:1080:0:72:color=0x0a0e0c[frame];[frame][1:v]overlay=0:0:shortest=1,format=yuv420p[v]', '-map', '[v]', '-an', '-t', String(scene.seconds), '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-threads', '2', `${scene.id}.mp4`]);
    console.log(`Rendered ${scene.id}`);
  }
  await captions();
  await writeFile(`${output}clips.txt`, scenes.map((s) => `file '${s.id}.mp4'`).join('\n'));
  await run(['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'clips.txt', '-i', 'voiceover-final.wav', '-vf', 'ass=captions.ass', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-threads', '2', '-c:a', 'aac', '-b:a', '192k', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-movflags', '+faststart', '-t', '117', '../../veil-demo-green-ui.mp4']);
  const media = await mediaInfo('../../veil-demo-green-ui.mp4');
  if (Math.abs(media.seconds - 117) > 0.1 || !/Video: h264/.test(media.log) || !/1920x1080/.test(media.log) || !/Audio: aac/.test(media.log)) throw new Error('Final media checks failed');
  await run(['-hide_banner', '-v', 'error', '-i', '../../veil-demo-green-ui.mp4', '-f', 'null', '-']);
  await run(['-hide_banner', '-loglevel', 'error', '-y', '-i', '../../veil-demo-green-ui.mp4', '-vf', 'fps=1/13,scale=640:360,tile=3x3', '-frames:v', '1', 'contact-sheet.png']);
  const finalBytes = await readFile(new URL('../results/veil-demo-green-ui.mp4', import.meta.url));
  report.status = 'PASS'; report.file = 'results/veil-demo-green-ui.mp4'; report.bytes = finalBytes.length;
  report.renderedAt = new Date().toISOString();
  report.sha256 = createHash('sha256').update(finalBytes).digest('hex'); report.resolution = '1920x1080'; report.fps = 30;
  report.videoCodec = 'H.264'; report.audioCodec = 'AAC'; report.speechTruncated = false;
  report.validation = ['117-second duration', 'H.264 1080p video and AAC audio', 'full decode without errors', 'sentence-timed captions with complete narration coverage', 'public UI and dated evidence clearly distinguished'];
  await writeFile(new URL('../results/narrated-tour-video.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, file: report.file, seconds: media.seconds, bytes: report.bytes, sha256: report.sha256 }));
  }
} finally { await browser.close(); }

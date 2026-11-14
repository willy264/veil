#!/usr/bin/env node
// Offline edit only: never imports the signer, opens .env/keyfiles, visits the
// hosted app, signs, or broadcasts. Inputs are public evidence and raw captures.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { access, copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const WEB = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(WEB, '../..');
const RESULTS = path.join(REPO, 'results');
const CAPTURES = path.join(RESULTS, 'video-assets', 'product-polish');
const EDIT = path.join(CAPTURES, 'edit');
const PLAN = path.join(WEB, 'demo-scenes.json');
const TIMING = path.join(RESULTS, 'product-video-timing.json');
const VERIFICATION = path.join(RESULTS, 'product-video-verification.json');
const DAO = path.join(RESULTS, 'demo-dao-20261111220608.json');
const TEMP_MODULES = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Temp', 'veil-video-tools', 'node_modules');
const HOSTED = 'https://veil-eta-khaki.vercel.app/';
const DISCLOSURE = 'TESTNET · SCRIPTED SIGNER · NOT BROWSER WALLET APPROVALS';
const IDS = ['intro', 'enable', 'register', 'send', 'scan', 'spend', 'auditor', 'dao', 'limits'];
const SECONDS = [12, 16, 10, 18, 14, 12, 13, 12, 10];
const HASH = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const require = createRequire(import.meta.url);
class EditError extends Error {}
function need(ok, message) { if (!ok) throw new EditError(message); }
const publicError = (error) => error instanceof EditError ? error.message : 'Product render failed; raw input/tool diagnostics withheld.';
const number = (value) => Number(value.toFixed(6));
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const env = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !/PRIVATE|SECRET|TOKEN|PASSWORD|CREDENTIAL|^VEIL_DEMO_/i.test(name)));
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
const json = async (file) => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
const relative = (file) => path.relative(REPO, file).replaceAll('\\', '/');

export function parseArgs(argv) {
  const options = {};
  const names = new Map([['--capture-dir', 'captureDir'], ['--evidence', 'evidence'], ['--ffmpeg', 'ffmpeg'], ['--playwright', 'playwright'], ['--voice', 'voice']]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (['--check', '--skip-narration', '--help'].includes(arg)) options[arg.slice(2)] = true;
    else {
      const name = names.get(arg);
      need(name && argv[i + 1] && !argv[i + 1].startsWith('--') && !options[name], 'Unknown, duplicate, or incomplete render option.');
      options[name] = argv[++i];
    }
  }
  need(!!options.captureDir === !!options.evidence, 'Provide --capture-dir and --evidence together.');
  return options;
}
function child(executable, args, { allowFailure = false, cwd = EDIT, label = 'Media processing', binary = false } = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn(executable, args, { cwd, windowsHide: true, env: env(), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const buffers = [];
    process.stdout.on('data', (data) => { if (binary) buffers.push(data); else stdout = (stdout + data).slice(-1_000_000); });
    process.stderr.on('data', (data) => { stderr = (stderr + data).slice(-1_000_000); });
    process.once('error', () => reject(new EditError('Required media tool could not start. Check the executable override.')));
    process.once('close', (code) => {
      if (code === 0 || allowFailure) { resolve({ stdout: binary ? Buffer.concat(buffers) : stdout, stderr, code }); return; }
      // Surface only the narrator's own fixed phase labels; never tool command
      // lines, input files, or arbitrary stderr from media dependencies.
      const phase = /Product narration failed during ([a-z0-9 ,]+)\./.exec(stderr)?.[1];
      reject(new EditError(phase ? `Narration failed during ${phase}. Speech was not truncated.`
        : `${label} failed (exit ${code}). Raw tool diagnostics withheld.`));
    });
  });
}
async function ffmpegPath(options) {
  if (options.ffmpeg || process.env.VEIL_FFMPEG) return options.ffmpeg || process.env.VEIL_FFMPEG;
  const local = path.join(TEMP_MODULES, 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  try { await access(local); return local; } catch { return 'ffmpeg'; }
}
function playwright(options) {
  const choices = options.playwright || process.env.VEIL_PLAYWRIGHT_MODULE
    ? [options.playwright || process.env.VEIL_PLAYWRIGHT_MODULE] : ['playwright', path.join(TEMP_MODULES, 'playwright')];
  for (const choice of choices) { try { return require(choice); } catch { /* No package install. */ } }
  throw new EditError('Set --playwright or VEIL_PLAYWRIGHT_MODULE to an existing Playwright installation.');
}
async function contained(file, root) {
  const absolute = await realpath(path.resolve(file));
  const base = await realpath(root);
  const rel = path.relative(base, absolute);
  need(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'Input must stay inside the approved public results directory.');
  return absolute;
}
export function validateScenes(scenes) {
  need(Array.isArray(scenes) && scenes.length === 9 && scenes.every((s, i) => s.id === IDS[i] && s.seconds === SECONDS[i]), 'Scene order and durations must total the prescribed 117 seconds.');
  const words = scenes.map((s) => s.text).join(' ').trim().split(/\s+/).length;
  need(words >= 230 && words <= 260, 'Narration must contain 230–260 words.');
  need(scenes[0].text.includes('scripted signer, not browser wallet approvals') && scenes[7].text.includes('not DAO interface footage'), 'Required spoken disclosures are missing.');
  return words;
}
export function validateEvidence(evidence) {
  const required = ['preflight', 'executeRequested', 'receiverConnected', 'receiverEnabled', 'receiverRegistered', 'senderConnected',
    'recipientResolved', 'deliveredPrivately', 'receiverFoundPayment', 'spendConfirmed', 'spendCompleted', 'auditorFoundPayment',
    'auditorUnsigned', 'auditorCannotSpend', 'capturesSafe', 'completed'];
  need(evidence.sourceUrl === HOSTED && evidence.scriptedSigner === true && evidence.browserWallet === false
    && required.every((key) => evidence.checks?.[key] === true), 'Completed real hosted flow is required; preflight-only, local, incomplete or unsafe captures cannot be rendered.');
  const accounts = evidence.accountIds;
  need(accounts?.receiver === 'veil-demo-recv.testnet' && accounts.sender === 'veil-demo-send.testnet'
    && accounts.registry === 'registry2.veil-williams.testnet' && accounts.router === 'router2.veil-williams.testnet'
    && /^[0-9a-f]{64}$/.test(accounts.stealth), 'Unexpected public testnet accounts.');
  function tx(kind, signer, receiver, amount) {
    const row = evidence.transactions?.[kind];
    need(row && HASH.test(row.hash) && row.accountId === signer && row.receiverId === receiver && row.nearAmount === amount
      && row.explorerUrl === `https://testnet.nearblocks.io/txns/${row.hash}`, 'Required transaction evidence is missing or inconsistent.');
  }
  tx('send', accounts.sender, accounts.router, '0.05');
  tx('spend', accounts.stealth, accounts.receiver, '0.001');
  if (evidence.checks.receiverRegistrationAlreadyPresent !== true) tx('register', accounts.receiver, accounts.registry, '0.01');
  return true;
}
function validateDao(dao) {
  need(dao.status === 'PASS' && dao.network === 'testnet' && dao.factory === 'sputnikv2.testnet'
    && /^[a-z0-9-]+\.sputnikv2\.testnet$/.test(dao.daoId) && dao.council?.length === 1
    && /^[a-z0-9-]+\.testnet$/.test(dao.council[0]) && dao.scan?.found === 1
    && dao.scan.owned?.length === 1 && dao.scan.owned[0].owned === true && dao.scan.owned[0].amount === '40000000000000000000000'
    && dao.approvals?.length === 1 && /^https:\/\/testnet\.nearblocks\.io\/txns\/[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(dao.approvals[0]), 'Dated DAO evidence did not pass its expected public-field checks.');
}
function event(markers, role, step, edge) {
  const found = markers.events.filter((row) => row.role === role && row.step === step && row.edge === edge);
  need(found.length === 1 && Number.isFinite(found[0].videoSeconds) && found[0].videoSeconds >= 0, 'Required action timing marker is missing or ambiguous.');
  return found[0].videoSeconds;
}
export function mobileIntervals(markers, role) {
  const spans = [];
  for (const row of markers.events.filter((e) => e.role === role && /^screenshot-.+-1440$/.test(e.step))) {
    const end = event(markers, role, row.step.replace(/1440$/, '390'), 'point');
    // The runner marks after each screenshot, then restores desktop and waits
    // 1.2s. Exclude the whole mobile interval with conservative frame margins.
    need(end >= row.videoSeconds, 'Screenshot timing markers are out of order.');
    spans.push([Math.max(0, row.videoSeconds - 0.15), end + 1.0]);
  }
  return spans;
}
function subtract(range, excludes) {
  let ranges = [range];
  for (const [start, end] of excludes) {
    ranges = ranges.flatMap(([a, b]) => end <= a || start >= b ? [[a, b]] : [[a, Math.min(b, start)], [Math.max(a, end), b]].filter(([x, y]) => y - x >= 0.08));
  }
  return ranges;
}
function merge(ranges) {
  const output = [];
  for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
    if (output.length && start <= output.at(-1)[1] + 0.05) output.at(-1)[1] = Math.max(end, output.at(-1)[1]);
    else output.push([start, end]);
  }
  return output;
}
async function detectMobileFrames(ffmpeg, file) {
  // Chromium's 390px viewport leaves a flat gray matte at the right of the
  // 1440px recording. Measure actual frames: screenshot marker clocks alone
  // differ by several tenths of a second from the screencast timestamps.
  const { stdout: pixels } = await child(ffmpeg, ['-v', 'error', '-i', file, '-vf',
    'fps=25,crop=200:200:1000:300,scale=1:1,format=rgb24', '-f', 'rawvideo', 'pipe:1'],
  { cwd: REPO, binary: true, label: 'Viewport frame inspection' });
  const ranges = []; let start;
  for (let frame = 0; frame < pixels.length / 3; frame++) {
    const gray = [0, 1, 2].every((channel) => Math.abs(pixels[frame * 3 + channel] - 128) <= 3);
    if (gray && start === undefined) start = frame / 25;
    if (!gray && start !== undefined) { ranges.push([start, frame / 25]); start = undefined; }
  }
  if (start !== undefined) ranges.push([start, pixels.length / 75]);
  return ranges;
}
export function selectSegments(scene, markers, durations, measuredMobile = {}) {
  const segments = [];
  for (const shot of scene.visual.shots) {
    const start = event(markers, shot.role, shot.step, 'start');
    const end = event(markers, shot.role, shot.step, 'end');
    need(end >= start && end <= durations[shot.role] + 0.5, 'Action timing exceeds its raw video.');
    let windows = [[Math.max(0, start - 0.4), Math.min(durations[shot.role], end + 0.35)]];
    if (end - start > 9) {
      // Retain the action start, actual signature/confirm events, and result.
      // Remove the middle of a long RPC wait; never manufacture a UI state.
      const important = markers.events.filter((e) => e.role === shot.role && e.edge === 'point'
        && /signed|confirm/.test(e.step) && e.videoSeconds >= start && e.videoSeconds <= end);
      windows = merge([[Math.max(0, start - 0.4), start + 2.5], [Math.max(start, end - 3.5), Math.min(durations[shot.role], end + 0.35)],
        ...important.map((e) => [Math.max(start, e.videoSeconds - 0.65), Math.min(end, e.videoSeconds + 0.65)])]);
    }
    const observed = measuredMobile[shot.role];
    const excluded = observed ? observed.map(([a, b]) => [Math.max(0, a - 0.12), b + 0.15]) : mobileIntervals(markers, shot.role);
    for (const range of windows) for (const [a, b] of subtract(range, excluded)) {
      segments.push({ role: shot.role, step: shot.step, start: number(a), end: number(b) });
    }
    const resultShot = { register: 'registered', send: 'delivered', scan: 'received', spend: 'spent', 'scan-read-only': 'read-only' }[shot.step];
    if (observed && resultShot) {
      const mobileMarker = event(markers, shot.role, `screenshot-${resultShot}-390`, 'point');
      const matching = observed.filter(([a, b]) => Math.abs((a + b) / 2 - mobileMarker) < 1.2);
      need(matching.length === 1, 'Cannot align the recorded desktop result with its screenshot interval.');
      // Capture the real result after desktop is restored and scrolled into view.
      // It then supplies the final held frame, never the intermediate mobile UI.
      const a = matching[0][1] + 0.32, b = Math.min(matching[0][1] + 0.92, durations[shot.role] - 0.12);
      need(b > a, 'Desktop result footage is too short for a safe hold.');
      segments.push({ role: shot.role, step: `${shot.step}-desktop-result`, start: number(a), end: number(b) });
    }
  }
  need(segments.length && segments.every((s) => s.end > s.start), 'No safe desktop action footage is available.');
  return segments;
}
function stamp(seconds, ass = false) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${ass ? h : String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${ass ? '.' + String(Math.floor(ms % 1000 / 10)).padStart(2, '0') : ',' + String(ms % 1000).padStart(3, '0')}`;
}
function wrap(text, limit = 88) {
  const lines = [''];
  for (const word of text.split(/\s+/)) {
    if ((lines.at(-1) + ' ' + word).trim().length > limit) lines.push(word);
    else lines[lines.length - 1] = (lines.at(-1) + ' ' + word).trim();
  }
  need(lines.length <= 2, 'Caption exceeds the reserved two-line footer.');
  return lines;
}
export function validateCaptions(scenes, timing, cues) {
  need(timing.status === 'PASS' && timing.speechTruncated === false && Math.abs(timing.durationSeconds - 117) < 0.01, 'Narration timing is not a complete 117-second pass.');
  let offset = 0, count = 0, prior = 0;
  for (const scene of scenes) {
    const measured = timing.scenes.find((row) => row.id === scene.id);
    need(measured?.start === offset && measured.end === offset + scene.seconds && measured.spokenSeconds <= scene.seconds - 0.49, 'Narration exceeds its scene slot.');
    const part = cues.filter((cue) => cue.scene === scene.id);
    need(part.length && part.map((c) => c.text).join(' ') === scene.text, 'Sentence captions do not cover the complete narration text.');
    let expectedStart = offset;
    for (const cue of part) {
      need(Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.end > cue.start
        && Math.abs(cue.start - expectedStart) < 0.002 && cue.start >= prior - 0.002 && cue.end <= measured.end, 'Caption timing has overlaps, gaps in speech, or crosses a scene.');
      wrap(cue.text); expectedStart = cue.end; prior = cue.end; count++;
    }
    need(Math.abs(expectedStart - offset - measured.spokenSeconds) < 0.01, 'Captions do not cover every measured second of narration.');
    offset += scene.seconds;
  }
  need(count === cues.length, 'Unrecognized extra caption cues.');
  return true;
}
export function captionFiles(cues) {
  const srt = cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${wrap(c.text).join('\n')}\n`).join('\n');
  const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Segoe UI,32,&H00EEF4ED,&H00EEF4ED,&H0010110D,&H0010110D,0,0,0,0,100,100,0,0,1,1,0,2,100,100,28,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`
    + cues.map((c) => `Dialogue: 0,${stamp(c.start, true)},${stamp(c.end, true)},Default,,0,0,0,,${wrap(c.text.replace(/[{}\\]/g, '')).join('\\N')}`).join('\n');
  return { srt, ass };
}
export function validateSrt(srt, cues) {
  const blocks = srt.trim().replaceAll('\r\n', '\n').split(/\n\n+/);
  need(blocks.length === cues.length, 'SRT sentence count differs from the narration.');
  const time = (text) => {
    const [h, m, s, ms] = text.split(/[:,]/).map(Number);
    return h * 3600 + m * 60 + s + ms / 1000;
  };
  for (const [i, block] of blocks.entries()) {
    const match = /^(\d+)\n(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})\n([\s\S]+)$/.exec(block);
    need(match && +match[1] === i + 1 && Math.abs(time(match[2]) - cues[i].start) <= 0.001
      && Math.abs(time(match[3]) - cues[i].end) <= 0.001 && match[4].replace(/\s+/g, ' ') === cues[i].text,
    'SRT timings or words differ from the measured sentence narration.');
  }
  return true;
}
async function mediaInfo(ffmpeg, file) {
  const { stderr } = await child(ffmpeg, ['-hide_banner', '-i', file], { allowFailure: true });
  const duration = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr);
  need(duration, 'Could not measure input media duration.');
  const size = /Video:[^\r\n]*?\b(\d{3,5})x(\d{3,5})\b/.exec(stderr);
  return { seconds: Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]),
    width: size ? Number(size[1]) : null, height: size ? Number(size[2]) : null,
    h264: /Video: h264/.test(stderr), aac: /Audio: aac/.test(stderr), fps30: /\b30 fps\b/.test(stderr) };
}
function headerHtml(scene, index, editNote) {
  return `<html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;height:70px;background:#0d1110;color:#edf4ee;font:24px 'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:space-between;padding:0 44px}strong{font-weight:600}small{display:block;color:#a3b0a7;font-size:16px;line-height:1.4}aside{text-align:right;color:#65d6a0;font-size:17px}</style><div><strong>${index + 1} / 9 · ${escape(scene.title)}</strong><small>${escape(DISCLOSURE)}</small></div><aside>${scene.id === 'dao' ? 'VERIFIED EVIDENCE · 11 NOV 2026' : 'RECORDED HOSTED FLOW'}<small>${escape(editNote || 'veil-eta-khaki.vercel.app')}</small></aside></html>`;
}
function daoHtml(dao) {
  return `<html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:70px 80px;background:#151b18;color:#edf4ee;font:26px/1.5 'Segoe UI',sans-serif;height:900px}h1{font-size:52px;line-height:1.15;margin:20px 0 40px}p{margin:16px 0}.label{color:#65d6a0;font-size:22px}.muted,dt{color:#a3b0a7}dl{display:grid;grid-template-columns:300px 1fr;gap:20px}dd{margin:0}code{font:24px Consolas,monospace}footer{border-top:1px solid #415348;margin-top:40px;padding-top:26px;font-size:22px}.source{font-size:19px;color:#a3b0a7}</style><p class="label">Verified testnet evidence · 11 November 2026</p><h1>A DAO payout reached a private account.</h1><dl><dt>DAO</dt><dd>${escape(dao.daoId)}</dd><dt>Council</dt><dd>${escape(dao.council[0])}</dd><dt>Recipient scan</dt><dd>1 owned payment · 0.0400 NEAR</dd></dl><p class="muted">Council approval transaction</p><code>${escape(dao.approvals[0].split('/').at(-1))}</code><footer>This is a dated evidence panel.<br>There is no DAO proposal screen in this web app.</footer><p class="source">Source: results/demo-dao-20261111220608.json<br>Public testnet receipt; no new DAO transaction in this recording.</p></html>`;
}
const HELP = `Offline Veil product video editor (no signing or credential access).
node apps/web/render-demo.mjs --capture-dir results/video-assets/product-polish/<timestamp> --evidence results/hosted-wallet-<timestamp>.json
Options: --check (read-only validation), --skip-narration (verified existing audio), --ffmpeg PATH, --playwright MODULE, --voice NAME
Environment overrides: VEIL_FFMPEG, VEIL_PLAYWRIGHT_MODULE, VEIL_POWERSHELL.
Defaults: existing local Temp/veil-video-tools modules and Microsoft Hazel Desktop.
Outputs: results/veil-demo-product.mp4/.srt, product-video-{timing,verification}.json;
intermediates and contact-sheet.png: results/video-assets/product-polish/edit/.
No arguments prints this help. --check alone checks the plan and installed tools.
`;

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help || (!options.captureDir && !options.check)) { process.stdout.write(HELP); return; }
  need(!['DEBUG', 'DEBUG_FILE', 'PWDEBUG', 'NODE_DEBUG'].some((name) => process.env[name]), 'Disable protocol/debug logging before rendering.');
  const scenes = await json(PLAN);
  const wordCount = validateScenes(scenes);
  const ffmpeg = await ffmpegPath(options);
  const { chromium } = playwright(options);
  await child(ffmpeg, ['-hide_banner', '-version'], { cwd: REPO });
  const filters = await child(ffmpeg, ['-hide_banner', '-filters'], { cwd: REPO });
  need(/\bass\s/.test(filters.stdout + filters.stderr), 'FFmpeg requires the ass/libass subtitle filter.');
  if (options.check && !options.captureDir) { process.stdout.write(`PASS: ${wordCount} words, 117 seconds, Playwright and FFmpeg/libass available. No files written.\n`); return; }
  const captureDir = await contained(options.captureDir, CAPTURES);
  need(path.basename(captureDir) !== 'edit', 'Choose a raw capture directory, not the edit output.');
  need(/^hosted-wallet-[\w-]+\.json$/.test(path.basename(options.evidence)), 'Use the runner public hosted-wallet evidence JSON.');
  const evidencePath = await contained(options.evidence, RESULTS);
  need(path.basename(evidencePath) === `hosted-wallet-${path.basename(captureDir)}.json`, 'Capture directory and evidence timestamps must match.');
  const evidence = await json(evidencePath);
  validateEvidence(evidence);
  const markersPath = await contained(path.join(captureDir, 'timing-markers.json'), captureDir);
  const markers = await json(markersPath);
  need(Array.isArray(markers.events) && !markers.events.some((e) => e.edge === 'failed'), 'Timing markers contain a failed or incomplete capture.');
  const dao = await json(DAO); validateDao(dao);
  const raw = {}, durations = {}, measuredMobile = {};
  for (const role of ['receiver', 'sender', 'auditor']) {
    need(markers.videos?.[role] === `${role}-raw.webm`, 'Unexpected raw video filename.');
    raw[role] = await contained(path.join(captureDir, markers.videos[role]), captureDir);
    // Probe before making the edit folder, using a known existing working dir.
    const { stderr } = await child(ffmpeg, ['-hide_banner', '-i', raw[role]], { cwd: REPO, allowFailure: true });
    const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr);
    need(d && /1440x900/.test(stderr), 'Expected a raw 1440 by 900 browser video.');
    durations[role] = +d[1] * 3600 + +d[2] * 60 + +d[3];
    measuredMobile[role] = await detectMobileFrames(ffmpeg, raw[role]);
    need(measuredMobile[role].length === mobileIntervals(markers, role).length, 'Recorded viewport transitions do not match the screenshot markers.');
  }
  const edits = scenes.map((scene) => ({ id: scene.id, seconds: scene.seconds,
    segments: scene.visual.kind === 'actions' ? selectSegments(scene, markers, durations, measuredMobile) : [],
    screenshot: scene.visual.kind === 'screenshot' ? scene.visual.file : undefined }));
  const screenshots = {};
  for (const scene of scenes.filter((s) => s.visual.kind === 'screenshot')) {
    need(scene.visual.file === 'receiver-initial-1440.png', 'Only the public desktop initial screenshot is used for opening/limits.');
    screenshots[scene.id] = await contained(path.join(captureDir, scene.visual.file), captureDir);
  }
  if (options.check) { process.stdout.write('PASS: completed real hosted flow, paired capture/evidence, dated DAO evidence and safe desktop edit ranges. No files written.\n'); return; }
  await mkdir(EDIT, { recursive: true });
  const report = { status: 'RUNNING', completedRealFlow: true, signingPerformed: false, credentialsRead: false,
    scriptedSigner: true, browserWallet: false, syntheticNarration: true, sourceUrl: HOSTED,
    disclosure: DISCLOSURE, daoEvidenceDate: '2026-11-11', daoUiClaimed: false,
    scenePlanSha256: await hashFile(PLAN), evidenceSha256: await hashFile(evidencePath), markersSha256: await hashFile(markersPath), daoSha256: await hashFile(DAO),
    sourceEvidence: relative(evidencePath), sourceCapture: relative(captureDir), rawVideoSha256: {}, measuredMobileIntervals: measuredMobile,
    timelineClock: 'Runner videoSeconds approximate page/video start; contact sheet and action continuity still require editorial review.',
    durationSeconds: 117, resolution: '1920x1080', frameRate: 30,
    layout: { headerHeight: 70, ui: { x: 256, y: 70, width: 1408, height: 880 }, captionFooterHeight: 130 },
    checks: {}, scenes: [] };
  let browser;
  try {
    for (const role of Object.keys(raw)) report.rawVideoSha256[role] = await hashFile(raw[role]);
    if (!options['skip-narration']) {
      process.stdout.write('Measuring complete sentence narration with Windows speech.\n');
      await child(process.env.VEIL_POWERSHELL || 'powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(WEB, 'narrate-product.ps1'), '-Ffmpeg', ffmpeg, '-Voice', options.voice || 'Microsoft Hazel Desktop'], { label: 'Narration' });
    }
    const timing = await json(TIMING), cues = await json(path.join(EDIT, 'sentence-cues.json'));
    need(timing.scenePlanSha256 === report.scenePlanSha256 && timing.audioSha256 === await hashFile(path.join(EDIT, 'voiceover-final.wav')), 'Narration is stale; regenerate it from this scene plan.');
    validateCaptions(scenes, timing, cues);
    const { srt, ass } = captionFiles(cues);
    validateSrt(srt, cues);
    await writeFile(path.join(EDIT, 'captions.ass'), ass);
    await writeFile(path.join(EDIT, 'product-candidate.srt'), srt);
    report.checks.captionCoverage = true;
    report.checks.srtCoverage = true;
    report.checks.speechFitsEveryScene = true;
    report.speechTruncated = false;
    report.wordCount = wordCount;
    report.captionCount = cues.length;
    browser = await chromium.launch({ headless: true, env: env() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', (route) => route.abort()); // Generated edit labels only; no network.
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 1440, height: 900 });
    await panel.setContent(daoHtml(dao));
    await panel.screenshot({ path: path.join(EDIT, 'dao-evidence.png') });
    for (const [i, scene] of scenes.entries()) {
      const edit = edits[i];
      const selectedSeconds = edit.segments.reduce((sum, part) => sum + part.end - part.start, 0);
      const speed = Math.max(1, selectedSeconds / (scene.seconds - 0.5));
      need(speed <= 4, 'Action footage needs more than four times speed; review timing markers instead of hiding actions.');
      const note = scene.visual.kind === 'actions' ? `Edited waits${speed > 1.001 ? ` · footage ${speed.toFixed(2)}×` : ' · normal speed'}${scene.id === 'register' && evidence.checks.receiverRegistrationAlreadyPresent ? ' · already registered' : ''}` : scene.id === 'dao' ? 'Dated evidence panel · no DAO UI' : 'Public hosted UI screenshot';
      await panel.setViewportSize({ width: 1920, height: 70 });
      await panel.setContent(headerHtml(scene, i, note));
      await panel.screenshot({ path: path.join(EDIT, `${scene.id}-header.png`) });
      const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y'];
      const filters = [];
      if (scene.visual.kind === 'actions') {
        for (const [j, segment] of edit.segments.entries()) {
          args.push('-ss', String(segment.start), '-t', String(number(segment.end - segment.start)), '-i', raw[segment.role]);
          filters.push(`[${j}:v]setpts=PTS-STARTPTS,fps=30,setsar=1[v${j}]`);
        }
        filters.push(`${edit.segments.map((_, j) => `[v${j}]`).join('')}concat=n=${edit.segments.length}:v=1:a=0,setpts=PTS/${number(speed)},fps=30,tpad=stop_mode=clone:stop_duration=${scene.seconds},trim=duration=${scene.seconds}[source]`);
      } else {
        args.push('-loop', '1', '-framerate', '30', '-i', scene.visual.kind === 'dao-evidence' ? path.join(EDIT, 'dao-evidence.png') : screenshots[scene.id]);
        const crop = scene.visual.kind === 'screenshot' ? `crop=1440:900:0:${scene.visual.crop === 'bottom' ? 'ih-900' : '0'},` : '';
        filters.push(`[0:v]${crop}fps=30,trim=duration=${scene.seconds},setpts=PTS-STARTPTS[source]`);
      }
      const headerIndex = scene.visual.kind === 'actions' ? edit.segments.length : 1;
      args.push('-loop', '1', '-framerate', '30', '-i', path.join(EDIT, `${scene.id}-header.png`));
      // 70 + 880 + 130 = 1080. All 1440x900 UI pixels remain visible with
      // aspect ratio preserved; neither banner nor subtitles overlaps the UI.
      filters.push('[source]scale=1408:880:flags=lanczos,pad=1920:1080:256:70:color=0x0d1110[frame]');
      filters.push(`[frame][${headerIndex}:v]overlay=0:0:shortest=1,setsar=1,format=yuv420p[out]`);
      args.push('-filter_complex_threads', '2', '-filter_complex', filters.join(';'), '-map', '[out]', '-an', '-t', String(scene.seconds),
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-threads', '2', `${scene.id}.mp4`);
      await child(ffmpeg, args, { label: `Scene ${scene.id} rendering` });
      const info = await mediaInfo(ffmpeg, `${scene.id}.mp4`);
      need(Math.abs(info.seconds - scene.seconds) < 0.08, 'Rendered scene duration mismatch.');
      report.scenes.push({ ...edit, speed: number(speed), selectedSeconds: number(selectedSeconds),
        paddedLastFrameSeconds: scene.visual.kind === 'actions' ? number(scene.seconds - selectedSeconds / speed) : 0, note });
      process.stdout.write(`Rendered ${scene.id}: ${scene.seconds}s.\n`);
    }
    await context.close(); await browser.close(); browser = undefined;
    await writeFile(path.join(EDIT, 'clips.txt'), scenes.map((s) => `file '${s.id}.mp4'`).join('\n'));
    await child(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'concat', '-safe', '0', '-i', 'clips.txt', '-i', 'voiceover-final.wav',
      '-vf', 'ass=captions.ass', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-threads', '2',
      '-c:a', 'aac', '-b:a', '192k', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-movflags', '+faststart', 'product-candidate.mp4']);
    // No -shortest or audio -t: measured speech is never truncated to fit video.
    const final = await mediaInfo(ffmpeg, 'product-candidate.mp4');
    need(Math.abs(final.seconds - 117) < 0.1 && final.width === 1920 && final.height === 1080 && final.h264 && final.aac && final.fps30, 'Final duration, resolution or codecs failed verification.');
    const decode = await child(ffmpeg, ['-hide_banner', '-v', 'error', '-xerror', '-i', 'product-candidate.mp4', '-f', 'null', '-']);
    need(!decode.stderr.trim(), 'Final video decode reported an error.');
    // One midpoint per actual scene, avoiding a uniform grid that misses cuts.
    let offset = 0; const midpoints = scenes.map((s) => { const point = offset + s.seconds / 2; offset += s.seconds; return Math.round(point * 30); });
    const select = midpoints.map((frame) => `eq(n\\,${frame})`).join('+');
    await child(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', 'product-candidate.mp4', '-vf', `select=${select},scale=640:360,tile=3x3`, '-frames:v', '1', 'contact-sheet.png']);
    const video = path.join(RESULTS, 'veil-demo-product.mp4'), subtitles = path.join(RESULTS, 'veil-demo-product.srt');
    await copyFile(path.join(EDIT, 'product-candidate.mp4'), video);
    await copyFile(path.join(EDIT, 'product-candidate.srt'), subtitles);
    report.status = 'PASS'; report.file = relative(video); report.subtitleFile = relative(subtitles);
    report.contactSheet = relative(path.join(EDIT, 'contact-sheet.png'));
    report.sha256 = await hashFile(video); report.bytes = (await stat(video)).size;
    report.renderedAt = new Date().toISOString(); report.measuredSeconds = final.seconds;
    Object.assign(report.checks, { fullDecode: true, duration117: true, h2641080pAac30fps: true, mobileIntervalsExcluded: true,
      completeSentenceSubtitles: true, disclosureSpokenAndOnScreen: true, contactSheetGenerated: true, humanVisualReview: false });
    await writeJson(VERIFICATION, report);
    process.stdout.write('PASS: results/veil-demo-product.mp4 and .srt; timing, verification and contact sheet ready for visual review.\n');
  } catch (error) {
    report.status = 'FAIL'; report.error = publicError(error);
    await writeJson(VERIFICATION, report);
    throw error;
  } finally { if (browser) await browser.close().catch(() => {}); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${publicError(error)}\n`); process.exitCode = 1; });
}

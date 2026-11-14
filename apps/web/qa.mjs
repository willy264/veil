#!/usr/bin/env node

import { createRequire } from 'node:module';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(WEB_ROOT, '..', '..');
const DEFAULT_MODULE_ROOT = path.join(
  process.env.LOCALAPPDATA || 'C:\\Users\\HP\\AppData\\Local',
  'Temp',
  'veil-video-tools',
  'node_modules',
);
const DEFAULT_PLAYWRIGHT = path.join(DEFAULT_MODULE_ROOT, 'playwright');
const DEFAULT_AXE = path.join(DEFAULT_MODULE_ROOT, '@axe-core', 'playwright');
const VIEWPORT_WIDTHS = [320, 360, 375, 390, 450, 768, 1024, 1280, 1440, 1536, 1920];
const AXE_WIDTHS = new Set([390, 1440]);
const PATHS = ['receive', 'send'];
const EXPECTED_STRUCTURE_COUNTS = { headings: 15, labels: 4 };
const SCREENSHOTS = [
  { width: 1440, height: 1000, path: 'receive', name: '1440-receive-fullpage.png' },
  { width: 1440, height: 1000, path: 'send', name: '1440-send-fullpage.png' },
  { width: 390, height: 844, path: 'receive', name: '390-receive-fullpage.png' },
  { width: 390, height: 844, path: 'send', name: '390-send-fullpage.png' },
];
const REQUIRED_IDS = [
  'connect',
  'enable',
  'register',
  'recipient',
  'amount',
  'send',
  'refresh',
  'inbox',
  'view-key',
  'auditor-name',
  'audit',
  'scan-output',
  'identity-output',
  'send-output',
  'resolve-output',
  'proof-public',
  'proof-private',
  'receive-path',
  'send-path',
];

function usage() {
  return `Usage: node qa.mjs [URL] [--out DIRECTORY] [--wallet-chooser]

With no URL, qa.mjs starts a static server rooted at apps/web.

Environment overrides:
  VEIL_PLAYWRIGHT_MODULE       Playwright package path or module name
  VEIL_AXE_PLAYWRIGHT_MODULE   @axe-core/playwright package path or module name
  VEIL_REGISTRY_ID             Expected testnet registry contract
  VEIL_ROUTER_ID               Expected testnet router contract
  VEIL_RPC_URL                 Effective RPC URL when runtime config is absent
`;
}

function parseArgs(argv) {
  const options = { url: null, out: null, walletChooser: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--wallet-chooser') options.walletChooser = true;
    else if (arg === '--local') {
      if (options.url) throw new Error('--local cannot be combined with a URL');
    } else if (arg === '--out') {
      options.out = argv[index + 1];
      if (!options.out) throw new Error('--out requires a directory');
      index += 1;
    } else if (arg === '--url') {
      options.url = argv[index + 1];
      if (!options.url) throw new Error('--url requires a value');
      index += 1;
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (options.url) throw new Error(`Unexpected argument: ${arg}`);
    else options.url = arg;
  }
  if (options.url) {
    const protocol = new URL(options.url).protocol;
    if (protocol !== 'http:' && protocol !== 'https:') throw new Error('URL must use http or https');
  }
  return options;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function displayPath(value) {
  const relative = path.relative(REPO_ROOT, value);
  return (relative && !relative.startsWith('..') ? relative : value).replaceAll('\\', '/');
}

function progress(message) {
  process.stdout.write(`[qa] ${message}\n`);
}

function contentType(filePath) {
  const types = {
    '.avif': 'image/avif',
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

async function startStaticServer() {
  const root = await realpath(WEB_ROOT);
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method || '')) {
        response.writeHead(405, { allow: 'GET, HEAD' }).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
      const relativeName = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      let candidate = path.resolve(root, relativeName);
      if (path.relative(root, candidate).startsWith('..') || path.isAbsolute(path.relative(root, candidate))) {
        response.writeHead(403).end();
        return;
      }
      let candidateStat = await stat(candidate);
      if (candidateStat.isDirectory()) {
        candidate = path.join(candidate, 'index.html');
        candidateStat = await stat(candidate);
      }
      if (!candidateStat.isFile()) throw new Error('Not a file');
      const resolvedCandidate = await realpath(candidate);
      const realRelative = path.relative(root, resolvedCandidate);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(resolvedCandidate);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-length': body.length,
        'content-type': contentType(resolvedCandidate),
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      const code = error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? 404 : 500;
      response.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' }).end(code === 404 ? 'Not found' : 'Server error');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

function closeServer(server) {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(resolve));
}

async function preparePage(page, url, details) {
  await page.addInitScript(() => {
    globalThis.__veilQaLayoutShifts = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            globalThis.__veilQaLayoutShifts.push({
              value: entry.value,
              startTime: entry.startTime,
            });
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {
      globalThis.__veilQaLayoutShiftUnsupported = true;
    }
  });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  details.httpStatus = response?.status() ?? null;
  details.finalUrl = page.url();
  if (!response?.ok()) throw new Error(`Page returned HTTP ${details.httpStatus ?? 'unknown'}`);
  await page.waitForLoadState('load', { timeout: 45_000 });
  await page.locator('#connect').waitFor({ state: 'attached', timeout: 45_000 });
  await page.waitForTimeout(1_200);
}

async function showPath(page, pathName) {
  await page.locator(`#tab-${pathName}`).click();
  await page.locator(`#tab-${pathName}`).waitFor({ state: 'visible' });
  await page.waitForFunction((name) => {
    const tab = document.getElementById(`tab-${name}`);
    const panel = document.getElementById(`${name}-path`);
    return tab?.getAttribute('aria-selected') === 'true' && panel && !panel.hidden;
  }, pathName);
}

function attachPageErrors(page, report, context) {
  page.on('pageerror', (error) => {
    report.pageErrors.push({ ...context, message: error.message, stack: error.stack || null });
  });
}

async function collectStructure(page) {
  return page.evaluate((requiredIds) => {
    const selectorFor = (element) => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const parts = [];
      for (let current = element; current && current.nodeType === Node.ELEMENT_NODE; current = current.parentElement) {
        const siblings = current.parentElement ? [...current.parentElement.children].filter((item) => item.tagName === current.tagName) : [];
        const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : '';
        parts.unshift(`${current.tagName.toLowerCase()}${suffix}`);
        if (current === document.body) break;
      }
      return parts.join(' > ');
    };
    const normalize = (value) => value.replace(/\s+/g, ' ').trim();
    const required = requiredIds.map((id) => ({ id, count: document.querySelectorAll(`#${CSS.escape(id)}`).length }));
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((heading) => ({
      level: Number(heading.tagName.slice(1)),
      text: normalize(heading.textContent || ''),
      selector: selectorFor(heading),
    }));
    const skippedLevels = [];
    for (let index = 1; index < headings.length; index += 1) {
      if (headings[index].level > headings[index - 1].level + 1) {
        skippedLevels.push({ from: headings[index - 1], to: headings[index] });
      }
    }
    const unlabelledInputs = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')]
      .filter((element) => {
        if (element.labels?.length) return false;
        if (normalize(element.getAttribute('aria-label') || '')) return false;
        const labelledBy = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
        return !labelledBy.some((id) => normalize(document.getElementById(id)?.textContent || ''));
      })
      .map((element) => selectorFor(element));
    const labels = [...document.querySelectorAll('label')].map((label) => ({
      text: normalize(label.textContent || ''),
      for: label.htmlFor || null,
      control: label.control ? selectorFor(label.control) : null,
    }));
    const valueTypes = new Set(['date', 'datetime-local', 'email', 'month', 'number', 'password', 'search', 'tel', 'text', 'time', 'url', 'week']);
    const prefilledInputs = [...document.querySelectorAll('input, textarea')]
      .filter((element) => {
        if (element instanceof HTMLTextAreaElement) return Boolean(element.value.trim() || element.defaultValue.trim());
        const type = (element.getAttribute('type') || 'text').toLowerCase();
        return valueTypes.has(type) && Boolean(element.value.trim() || (element.getAttribute('value') || '').trim());
      })
      .map((element) => ({ selector: selectorFor(element), type: element.getAttribute('type') || 'text' }));
    return {
      requiredIds: required,
      headings,
      labels,
      counts: { headings: headings.length, labels: labels.length },
      headingChecks: {
        h1Count: headings.filter(({ level }) => level === 1).length,
        skippedLevels,
        privatePayments: headings.some(({ text }) => text.toLowerCase() === 'private payments'),
        auditor: headings.some(({ text }) => text.toLowerCase() === 'auditor'),
      },
      unlabelledInputs,
      rawPreElements: [...document.querySelectorAll('pre')].map((element) => selectorFor(element)),
      prefilledInputs,
    };
  }, REQUIRED_IDS);
}

async function collectContractConfig(page) {
  const observed = await page.evaluate(() => {
    const raw = globalThis.VEIL_CONFIG ?? null;
    const text = (id) => document.getElementById(id)?.textContent?.trim() || null;
    return {
      raw,
      effective: {
        network: raw?.network ?? (/\btestnet\b/i.test(document.body.innerText) ? 'testnet' : null),
        registryId: raw?.registryId ?? text('registry-id'),
        routerId: raw?.routerId ?? text('router-id'),
        rpcUrl: raw?.rpcUrl ?? null,
      },
      source: raw ? 'window.VEIL_CONFIG' : 'document-and-app-defaults',
    };
  });
  if (!observed.effective.rpcUrl) observed.effective.rpcUrl = process.env.VEIL_RPC_URL || 'https://rpc.testnet.near.org';
  return {
    expected: {
      network: 'testnet',
      registryId: process.env.VEIL_REGISTRY_ID || 'registry2.veil-williams.testnet',
      routerId: process.env.VEIL_ROUTER_ID || 'router2.veil-williams.testnet',
      rpcUrl: process.env.VEIL_RPC_URL || 'https://rpc.testnet.near.org',
    },
    observed,
  };
}

async function collectViewportChecks(page) {
  return page.evaluate(() => {
    const selectorFor = (element) => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const name = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      const label = element.getAttribute('aria-label');
      return `${name}${role ? `[role="${role}"]` : ''}${label ? `[aria-label="${label.replaceAll('"', '\\"')}"]` : ''}`;
    };
    const root = document.documentElement;
    const body = document.body;
    const clientWidth = root.clientWidth;
    const overflow = Math.max(root.scrollWidth, body?.scrollWidth || 0) - clientWidth;
    const overflowElements = [...document.querySelectorAll('body *')]
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > clientWidth + 1);
      })
      .slice(0, 25)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { selector: selectorFor(element), left: rect.left, right: rect.right, width: rect.width };
      });
    const targetSelector = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      'summary',
      '[contenteditable="true"]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="switch"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="slider"]',
      '[role="spinbutton"]',
    ].join(',');
    const targets = [...new Set(document.querySelectorAll(targetSelector))].filter((element) => {
      if (element.matches(':disabled,[aria-disabled="true"]')) return false;
      if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
      if (element.checkVisibility && !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      return element.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
    });
    const undersized = targets.map((element) => {
      const rect = element.getBoundingClientRect();
      return { selector: selectorFor(element), width: rect.width, height: rect.height };
    }).filter(({ width, height }) => width < 24 || height < 24);
    const entries = globalThis.__veilQaLayoutShifts || [];
    let sessionValue = 0;
    let sessionStart = 0;
    let previousTime = 0;
    let cls = 0;
    for (const entry of entries) {
      if (entry.startTime - previousTime > 1000 || entry.startTime - sessionStart > 5000) {
        sessionValue = 0;
        sessionStart = entry.startTime;
      }
      sessionValue += entry.value;
      previousTime = entry.startTime;
      cls = Math.max(cls, sessionValue);
    }
    const animations = document.getAnimations({ subtree: true })
      .filter((animation) => animation.playState === 'running' || animation.playState === 'pending')
      .map((animation) => {
        const timing = animation.effect?.getComputedTiming?.() || {};
        const keyframes = animation.effect?.getKeyframes?.() || [];
        const transform = keyframes.some((frame) => ['transform', 'translate', 'scale', 'rotate'].some((name) => {
          const value = frame[name];
          return value !== undefined && value !== 'none' && value !== 'normal';
        }));
        return {
          selector: animation.effect?.target ? selectorFor(animation.effect.target) : null,
          animationName: animation.animationName || null,
          duration: timing.duration ?? null,
          iterations: timing.iterations ?? null,
          transform,
        };
      });
    const parseColor = (value) => {
      const values = String(value).match(/[\d.]+/g)?.map(Number) || [];
      return values.length >= 3 ? { r: values[0], g: values[1], b: values[2], a: values[3] ?? 1 } : null;
    };
    const luminance = ({ r, g, b }) => {
      const channel = (value) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const effectiveBackground = (element) => {
      for (let current = element; current; current = current.parentElement) {
        const color = parseColor(getComputedStyle(current).backgroundColor);
        if (color?.a === 1) return color;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const contrastRatio = (foreground, background) => {
      const high = Math.max(luminance(foreground), luminance(background));
      const low = Math.min(luminance(foreground), luminance(background));
      return (high + 0.05) / (low + 0.05);
    };
    const visible = (element) => {
      if (!element || element.closest('[hidden]')) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const contrastPairs = [];
    const addContrast = (name, element, colorValue) => {
      const foreground = parseColor(colorValue);
      const background = effectiveBackground(element);
      if (!foreground) return;
      contrastPairs.push({ name, foreground: colorValue, background: `rgb(${background.r}, ${background.g}, ${background.b})`, ratio: contrastRatio(foreground, background), minimum: 4.5 });
    };
    addContrast('body text', document.body, getComputedStyle(document.body).color);
    const muted = [...document.querySelectorAll('.muted')].find(visible);
    if (muted) addContrast('muted text', muted, getComputedStyle(muted).color);
    const input = [...document.querySelectorAll('input:not([type="hidden"])')].find(visible);
    if (input) {
      addContrast('input text', input, getComputedStyle(input).color);
      addContrast('input placeholder', input, getComputedStyle(input, '::placeholder').color);
    }
    return {
      documentOverflow: {
        clientWidth,
        scrollWidth: Math.max(root.scrollWidth, body?.scrollWidth || 0),
        overflow,
        elements: overflowElements,
      },
      pointerTargets: { checked: targets.length, minimum: 24, undersized },
      layoutShift: {
        supported: !globalThis.__veilQaLayoutShiftUnsupported,
        value: cls,
        threshold: 0.1,
        entries,
      },
      activeAnimations: animations,
      contrasts: { pairs: contrastPairs, failures: contrastPairs.filter(({ ratio, minimum }) => ratio < minimum) },
    };
  });
}

function compactAxeViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary,
    })),
  }));
}

function addFailure(report, failure) {
  report.failures.push(failure);
}

function assessStructure(report, structure) {
  const missing = structure.requiredIds.filter(({ count }) => count !== 1);
  if (missing.length) addFailure(report, { check: 'stable-ids', message: 'Required IDs must each occur exactly once', details: missing });
  if (structure.headingChecks.h1Count !== 1) addFailure(report, { check: 'headings', message: 'The page must have exactly one h1', details: { h1Count: structure.headingChecks.h1Count } });
  if (structure.headingChecks.skippedLevels.length) addFailure(report, { check: 'headings', message: 'Heading levels must not be skipped', details: structure.headingChecks.skippedLevels });
  if (structure.counts.headings !== EXPECTED_STRUCTURE_COUNTS.headings || structure.counts.labels !== EXPECTED_STRUCTURE_COUNTS.labels) {
    addFailure(report, { check: 'stable-heading-label-counts', message: 'Heading and label counts changed', details: { expected: EXPECTED_STRUCTURE_COUNTS, observed: structure.counts } });
  }
  if (structure.headings.some(({ text }) => !text) || structure.labels.some(({ text, control }) => !text || !control)) {
    addFailure(report, { check: 'stable-heading-labels', message: 'Headings and labels must be non-empty and labels must have controls', details: { headings: structure.headings, labels: structure.labels } });
  }
  if (!structure.headingChecks.privatePayments || !structure.headingChecks.auditor) {
    addFailure(report, { check: 'headings', message: 'Private payments and Auditor headings are required', details: structure.headingChecks });
  }
  if (structure.unlabelledInputs.length) addFailure(report, { check: 'input-labels', message: 'Every input must have an accessible label', details: structure.unlabelledInputs });
  if (structure.rawPreElements.length) addFailure(report, { check: 'raw-pre-logs', message: 'Raw preformatted log elements are not allowed', details: structure.rawPreElements });
  if (structure.prefilledInputs.length) addFailure(report, { check: 'prefilled-inputs', message: 'User-editable inputs must not be prefilled', details: structure.prefilledInputs });
}

function assessContractConfig(report, contractConfig) {
  const { expected, observed } = contractConfig;
  for (const key of ['network', 'registryId', 'routerId', 'rpcUrl']) {
    if (observed.effective[key] !== expected[key]) {
      addFailure(report, {
        check: 'testnet-contract-config',
        message: `Unexpected ${key}`,
        details: { expected: expected[key], observed: observed.effective[key] },
      });
    }
  }
}

function assessViewportPath(report, viewport, result) {
  const label = `${viewport.width}px/${viewport.motion}/${result.path}`;
  if (result.documentOverflow.overflow > 1) addFailure(report, { check: 'document-overflow', viewport: label, message: 'Document has horizontal overflow', details: result.documentOverflow });
  if (result.pointerTargets.undersized.length) addFailure(report, { check: 'pointer-target-size', viewport: label, message: 'Visible pointer targets must be at least 24 by 24 CSS pixels', details: result.pointerTargets.undersized });
  if (result.contrasts.failures.length) addFailure(report, { check: 'known-color-contrast', viewport: label, message: 'Known text and input color pairs must meet 4.5:1', details: result.contrasts.failures });
  if (result.axe?.violations?.length) addFailure(report, { check: 'axe', viewport: label, message: 'Axe must report zero violations', details: result.axe.violations });
  if (!result.layoutShift.supported) addFailure(report, { check: 'layout-shift', viewport: label, message: 'Layout Shift PerformanceObserver is unavailable' });
  else if (result.layoutShift.value > result.layoutShift.threshold) addFailure(report, { check: 'layout-shift', viewport: label, message: 'Observed lab CLS exceeds 0.1', details: result.layoutShift });
  if (viewport.motion === 'reduced') {
    const disallowed = result.activeAnimations.filter((animation) => animation.transform || animation.iterations === Infinity);
    if (disallowed.length) addFailure(report, { check: 'reduced-motion', viewport: label, message: 'Reduced motion has active transform or looping animations', details: disallowed });
    result.reducedMotion = { disallowed };
  }
}

async function captureScreenshots(browser, targetUrl, outputDirectory, report) {
  for (const shot of SCREENSHOTS) {
    const context = await browser.newContext({ viewport: { width: shot.width, height: shot.height }, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const details = { phase: 'screenshot', width: shot.width, motion: 'normal', path: shot.path };
    attachPageErrors(page, report, details);
    try {
      await preparePage(page, targetUrl, details);
      await showPath(page, shot.path);
      const filePath = path.join(outputDirectory, shot.name);
      await page.screenshot({ path: filePath, fullPage: true });
      report.screenshots.push({ ...details, path: displayPath(filePath), fullPage: true, httpStatus: details.httpStatus, finalUrl: details.finalUrl });
    } catch (error) {
      addFailure(report, { check: 'screenshot', viewport: `${shot.width}px/normal/${shot.path}`, message: error.message });
    } finally {
      await context.close();
    }
  }
}

async function runViewport(browser, AxeBuilder, targetUrl, width, motion, report, collectPageStructure) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 450 ? 844 : 900 },
    reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const details = { phase: 'evaluation', width, motion };
  const result = { width, motion, status: 'FAIL', paths: [] };
  const failuresBefore = report.failures.length;
  const errorsBefore = report.pageErrors.length;
  attachPageErrors(page, report, details);
  try {
    await preparePage(page, targetUrl, details);
    if (collectPageStructure) {
      report.structure = await collectStructure(page);
      assessStructure(report, report.structure);
      report.contractConfig = await collectContractConfig(page);
      assessContractConfig(report, report.contractConfig);
    }
    for (const pathName of PATHS) {
      progress(`${width}px ${motion}: checking ${pathName}`);
      const pathFailuresBefore = report.failures.length;
      await showPath(page, pathName);
      const pathResult = { path: pathName, status: 'FAIL' };
      Object.assign(pathResult, await collectViewportChecks(page));
      if (AXE_WIDTHS.has(width)) {
        const axe = await new AxeBuilder({ page }).analyze();
        pathResult.axe = {
          violations: compactAxeViolations(axe.violations),
          violationCount: axe.violations.length,
          passes: axe.passes.length,
          incomplete: axe.incomplete.map(({ id, impact, help }) => ({ id, impact, help })),
        };
      } else pathResult.axe = { skipped: true, reason: 'Axe runs at the 390px and 1440px core widths.' };
      assessViewportPath(report, result, pathResult);
      pathResult.status = report.failures.length === pathFailuresBefore ? 'PASS' : 'FAIL';
      result.paths.push(pathResult);
      progress(`${width}px ${motion}: ${pathName} ${pathResult.status}`);
    }
    result.httpStatus = details.httpStatus;
    result.finalUrl = details.finalUrl;
    result.pageErrorCount = report.pageErrors.length - errorsBefore;
    result.status = report.failures.length === failuresBefore && result.pageErrorCount === 0 ? 'PASS' : 'FAIL';
  } catch (error) {
    result.error = error.message;
    addFailure(report, { check: 'viewport-run', viewport: `${width}px/${motion}`, message: error.message });
  } finally {
    report.viewports.push(result);
    await context.close();
  }
}

async function focusedElement(page, label) {
  return page.evaluate((name) => {
    const element = document.activeElement;
    const style = element ? getComputedStyle(element) : null;
    const outlineWidth = Number.parseFloat(style?.outlineWidth || '0');
    const hasIndicator = Boolean(style && ((style.outlineStyle !== 'none' && outlineWidth >= 1) || style.boxShadow !== 'none'));
    return {
      label: name,
      id: element?.id || null,
      tag: element?.tagName?.toLowerCase() || null,
      disabled: Boolean(element?.disabled),
      focusVisible: Boolean(element?.matches?.(':focus-visible')),
      hasIndicator,
      outline: style ? `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}` : null,
      boxShadow: style?.boxShadow || null,
    };
  }, label);
}

async function checkKeyboardPath(browser, targetUrl, report) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const details = { phase: 'keyboard-path', width: 1440, motion: 'normal' };
  const failuresBefore = report.failures.length;
  attachPageErrors(page, report, details);
  try {
    progress('keyboard: checking path tabs and disabled-step navigation');
    await preparePage(page, targetUrl, details);
    await page.locator('#tab-receive').focus();
    await page.keyboard.press('ArrowRight');
    const sendTab = await focusedElement(page, 'ArrowRight selects Send');
    const sendState = await page.evaluate(() => ({
      receiveSelected: document.getElementById('tab-receive')?.getAttribute('aria-selected'),
      sendSelected: document.getElementById('tab-send')?.getAttribute('aria-selected'),
      receiveHidden: document.getElementById('receive-path')?.hidden,
      sendHidden: document.getElementById('send-path')?.hidden,
    }));
    await page.keyboard.press('Tab');
    const sendFirst = await focusedElement(page, 'Tab enters Send path');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('ArrowLeft');
    const receiveTab = await focusedElement(page, 'ArrowLeft selects Receive');
    await page.keyboard.press('Tab');
    const receiveFirst = await focusedElement(page, 'Tab enters Receive path');
    const receiveOrder = [receiveFirst];
    for (let index = 0; index < 7; index += 1) {
      await page.keyboard.press('Tab');
      receiveOrder.push(await focusedElement(page, `Receive Tab ${index + 2}`));
    }
    const disabledStepIds = await page.evaluate(() => ['enable', 'register', 'share', 'export-view', 'refresh', 'send'].filter((id) => document.getElementById(id)?.disabled));
    const focusSamples = [sendTab, sendFirst, receiveTab, ...receiveOrder];
    const hiddenOrDisabledFocus = receiveOrder.filter(({ id, disabled }) => disabled || (id && disabledStepIds.includes(id)));
    const missingFocusStyles = focusSamples.filter(({ focusVisible, hasIndicator }) => !focusVisible || !hasIndicator);
    report.keyboardChecks = { status: 'PASS', sendState, sendTab, sendFirst, receiveTab, receiveOrder, disabledStepIds, hiddenOrDisabledFocus, missingFocusStyles };
    if (sendTab.id !== 'tab-send' || sendState.sendSelected !== 'true' || sendState.receiveSelected !== 'false' || !sendState.receiveHidden || sendState.sendHidden) {
      addFailure(report, { check: 'keyboard-path-tabs', message: 'ArrowRight must select and reveal the Send path', details: report.keyboardChecks });
    }
    if (sendFirst.id !== 'recipient') addFailure(report, { check: 'keyboard-tab-order', message: 'Tab from the Send tab must enter the recipient field', details: sendFirst });
    if (receiveTab.id !== 'tab-receive' || receiveFirst.id !== 'connect-receive') {
      addFailure(report, { check: 'keyboard-tab-order', message: 'ArrowLeft and Tab must return to the first enabled Receive action', details: { receiveTab, receiveFirst } });
    }
    if (hiddenOrDisabledFocus.length) addFailure(report, { check: 'keyboard-disabled-steps', message: 'Tab navigation must skip disabled step actions', details: hiddenOrDisabledFocus });
    if (missingFocusStyles.length) addFailure(report, { check: 'focus-visible', message: 'Keyboard-focused controls must expose a visible focus indicator', details: missingFocusStyles });
    report.keyboardChecks.status = report.failures.length === failuresBefore ? 'PASS' : 'FAIL';
    progress(`keyboard: ${report.keyboardChecks.status}`);
  } catch (error) {
    report.keyboardChecks = { status: 'FAIL', error: error.message };
    addFailure(report, { check: 'keyboard-path', message: error.message });
  } finally {
    await context.close();
  }
}

async function waitForState(page, id, stateName, timeout = 30_000) {
  await page.waitForFunction(([targetId, expected]) => document.getElementById(targetId)?.dataset.state === expected, [id, stateName], { timeout });
  return page.locator(`#${id}`).evaluate((element) => ({
    state: element.dataset.state || null,
    text: element.textContent.replace(/\s+/g, ' ').trim(),
  }));
}

async function checkReadOnlyStates(browser, targetUrl, report) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const details = { phase: 'read-only-states', width: 1440, motion: 'normal' };
  const rpcMethods = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    try { rpcMethods.push(JSON.parse(request.postData() || '{}').method || 'unknown'); } catch { rpcMethods.push('unparseable'); }
  });
  attachPageErrors(page, report, details);
  try {
    progress('states: checking live recipient resolution and invalid forms');
    await preparePage(page, targetUrl, details);
    await showPath(page, 'send');
    const recipient = page.locator('#recipient');
    const amount = page.locator('#amount');

    await recipient.fill('alice.veil-williams.testnet');
    await amount.focus();
    const existing = await waitForState(page, 'resolve-output', 'success');

    await recipient.fill('INVALID NAME');
    await amount.focus();
    const invalidName = { ...(await waitForState(page, 'resolve-output', 'error')), ariaInvalid: await recipient.getAttribute('aria-invalid') };

    const unregisteredName = `qa-${Date.now()}-unregistered.testnet`;
    await recipient.fill(unregisteredName);
    await amount.focus();
    const unregistered = { name: unregisteredName, ...(await waitForState(page, 'resolve-output', 'error')) };

    await amount.fill('-1');
    await recipient.focus();
    const invalidAmount = { ...(await waitForState(page, 'amount-output', 'error')), ariaInvalid: await amount.getAttribute('aria-invalid'), sendDisabled: await page.locator('#send').isDisabled() };

    await page.locator('#auditor-name').fill('alice.veil-williams.testnet');
    await page.locator('#view-key').fill('invalid-auditor-key');
    await page.locator('#audit').click();
    const invalidAuditor = { ...(await waitForState(page, 'auditor-output', 'error')), ariaInvalid: await page.locator('#view-key').getAttribute('aria-invalid') };

    report.interactionChecks = { status: 'PASS', existing, invalidName, unregistered, invalidAmount, invalidAuditor, rpcMethods };
    const checks = [
      [existing.text.includes('Veil enabled'), 'live-existing-recipient', 'The known registered recipient must resolve successfully', existing],
      [invalidName.ariaInvalid === 'true', 'invalid-recipient-name', 'An invalid recipient name must expose its error state', invalidName],
      [/not on Veil/i.test(unregistered.text), 'unregistered-recipient', 'An unregistered name must expose its read-only registry result', unregistered],
      [invalidAmount.ariaInvalid === 'true' && invalidAmount.sendDisabled, 'invalid-amount', 'An invalid amount must be marked invalid and keep Send disabled', invalidAmount],
      [invalidAuditor.ariaInvalid === 'true', 'invalid-auditor', 'An invalid auditor key must expose its error state', invalidAuditor],
      [rpcMethods.every((method) => method === 'query'), 'read-only-network', 'QA state checks must issue only read-only RPC queries', rpcMethods],
    ];
    for (const [passed, check, message, checkDetails] of checks) if (!passed) addFailure(report, { check, message, details: checkDetails });
    report.interactionChecks.status = checks.every(([passed]) => passed) ? 'PASS' : 'FAIL';
    progress(`states: ${report.interactionChecks.status}`);
  } catch (error) {
    report.interactionChecks = { status: 'FAIL', error: error.message, rpcMethods };
    addFailure(report, { check: 'read-only-states', message: error.message });
  } finally {
    await context.close();
  }
}

async function checkWalletChooser(browser, targetUrl, report) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const details = { phase: 'wallet-chooser', width: 1440, motion: 'normal' };
  attachPageErrors(page, report, details);
  try {
    await preparePage(page, targetUrl, details);
    await page.locator('#connect').click();
    const chooserTitle = page.getByText('Select wallet', { exact: false }).first();
    await chooserTitle.waitFor({ state: 'visible', timeout: 10_000 });
    report.walletChecks.chooserOpened = true;
    await page.mouse.click(8, 8);
    const dismissed = await chooserTitle.waitFor({ state: 'hidden', timeout: 5_000 }).then(() => true, () => false);
    report.walletChecks.dismissedViaBackdrop = dismissed;
    if (!dismissed) addFailure(report, { check: 'wallet-chooser', message: 'Wallet chooser did not dismiss after a backdrop click' });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('#connect').waitFor({ state: 'attached', timeout: 45_000 });
    report.walletChecks.reloadedAfterDismissal = true;
  } catch (error) {
    report.walletChecks.error = error.message;
    addFailure(report, { check: 'wallet-chooser', message: error.message });
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
      report.walletChecks.reloadedAfterDismissal = true;
    } catch {
      report.walletChecks.reloadedAfterDismissal = false;
    }
  } finally {
    await context.close();
  }
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n\n${usage()}`);
  process.exitCode = 2;
}

if (options?.help) {
  process.stdout.write(usage());
} else if (options) {
  const outputDirectory = path.resolve(options.out || path.join(REPO_ROOT, 'results', 'ui-polish', timestamp()));
  const reportPath = path.join(outputDirectory, 'results.json');
  const report = {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    status: 'RUNNING',
    scope: options.url ? 'SUPPLIED_URL_BROWSER_QA' : 'LOCAL_STATIC_BROWSER_QA',
    target: { requestedUrl: options.url },
    outputDirectory: displayPath(outputDirectory),
    metricScope: 'Single-run browser lab observations only; no p75 field metrics are claimed.',
    requiredIds: REQUIRED_IDS,
    screenshots: [],
    viewports: [],
    pageErrors: [],
    failures: [],
    walletChecks: {
      chooserRequested: options.walletChooser,
      chooserOpened: false,
      dismissedViaBackdrop: false,
      reloadedAfterDismissal: false,
      realWalletConnection: 'NOT_TESTED',
      messageSignatureApproval: 'NOT_TESTED',
      transactionApproval: 'NOT_TESTED',
      walletSelected: false,
      signed: false,
      transactionsSubmitted: false,
      note: 'Automated QA never selects a wallet, signs a message, or submits a transaction. Real wallet checks remain absent.',
    },
    keyboardChecks: { status: 'NOT_RUN' },
    interactionChecks: { status: 'NOT_RUN' },
  };
  let server;
  let browser;
  try {
    await mkdir(outputDirectory, { recursive: true });
    const require = createRequire(import.meta.url);
    const playwrightModule = process.env.VEIL_PLAYWRIGHT_MODULE || DEFAULT_PLAYWRIGHT;
    const axeModule = process.env.VEIL_AXE_PLAYWRIGHT_MODULE || DEFAULT_AXE;
    const { chromium } = require(playwrightModule);
    const { AxeBuilder } = require(axeModule);
    if (!options.url) server = await startStaticServer();
    const targetUrl = options.url || `http://127.0.0.1:${server.address().port}/`;
    report.target.url = targetUrl;
    report.target.localStaticServer = !options.url;
    report.modules = { playwright: playwrightModule, axePlaywright: axeModule };
    browser = await chromium.launch({ headless: true });

    await captureScreenshots(browser, targetUrl, outputDirectory, report);
    await checkKeyboardPath(browser, targetUrl, report);
    await checkReadOnlyStates(browser, targetUrl, report);
    let collectPageStructure = true;
    for (const motion of ['normal', 'reduced']) {
      for (const width of VIEWPORT_WIDTHS) {
        await runViewport(browser, AxeBuilder, targetUrl, width, motion, report, collectPageStructure);
        collectPageStructure = !report.structure;
      }
    }
    if (options.walletChooser) await checkWalletChooser(browser, targetUrl, report);
  } catch (error) {
    addFailure(report, { check: 'qa-runner', message: error.message, stack: error.stack || null });
  } finally {
    if (browser) await browser.close().catch(() => {});
    await closeServer(server);
    if (report.pageErrors.length) {
      addFailure(report, { check: 'page-errors', message: 'Uncaught browser page errors occurred', details: report.pageErrors });
    }
    report.finishedAt = new Date().toISOString();
    report.status = report.failures.length ? 'FAIL' : 'PASS';
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ status: report.status, report: displayPath(reportPath), failures: report.failures }, null, 2)}\n`);
    if (report.status !== 'PASS') process.exitCode = 1;
  }
}

#!/usr/bin/env node
'use strict';

// Automatic review rules for every commit and pull request.
// Usage: node scripts/policy-check.js [rootDir]

const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['.git', 'node_modules', '.vercel', 'graphify-out']);
const TEXT_EXT = new Set(['.html', '.css', '.js', '.json', '.md', '.yml', '.yaml', '.svg', '.webmanifest', '.sql', '.txt']);
const NO_STYLE_CHECK = new Set(['LICENSE']);
const ALLOWED_DEPS = new Set(['@neondatabase/serverless']);

const DASH = /[\u2013\u2014]/u;
const EMOJI = /\p{Extended_Pictographic}/u;

const JS_BANS = [
  [/\beval\s*\(/, 'eval() est interdit'],
  [/\bnew\s+Function\b/, 'new Function est interdit'],
  [/document\.write\s*\(/, 'document.write est interdit'],
  [/\.(?:innerHTML|outerHTML)\s*=/, 'innerHTML / outerHTML est interdit (utiliser textContent)'],
  [/insertAdjacentHTML/, 'insertAdjacentHTML est interdit'],
  [/XMLHttpRequest/, 'XMLHttpRequest est interdit'],
  [/sendBeacon/, 'sendBeacon est interdit'],
  [/\bWebSocket\b/, 'WebSocket est interdit'],
  [/\bimportScripts\s*\(\s*['"`]https?:/, 'importScripts externe interdit'],
  [/\bimport\s*\(\s*['"`]https?:/, 'import externe interdit'],
];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function check(root) {
  const problems = [];
  const add = (file, line, msg) => problems.push(path.relative(root, file) + (line ? ':' + line : '') + ' ' + msg);

  for (const file of walk(root, [])) {
    const rel = path.relative(root, file);
    const ext = path.extname(file);
    const isTestOrScript = rel.startsWith('test' + path.sep) || rel.startsWith('scripts' + path.sep);
    if (!TEXT_EXT.has(ext) && path.basename(file) !== 'LICENSE') continue;
    const text = fs.readFileSync(file, 'utf8');

    if (!NO_STYLE_CHECK.has(path.basename(file))) {
      const d = text.search(DASH);
      if (d >= 0) add(file, lineOf(text, d), 'tiret long ou demi-cadratin interdit (utiliser une virgule ou un deux-points)');
      const m = text.match(EMOJI);
      if (m) add(file, lineOf(text, text.indexOf(m[0])), 'emoji interdit (utiliser un SVG)');
    }

    if (ext === '.js' && !isTestOrScript) {
      for (const [re, msg] of JS_BANS) {
        const m = re.exec(text);
        if (m) add(file, lineOf(text, m.index), msg);
      }
      if (rel === 'sw.js') {
        // The service worker relays same-origin requests only; keep that guard in place.
        if (!text.includes('url.origin !== self.location.origin')) add(file, 0, 'le service worker doit ignorer les requetes hors de son origine');
      } else {
        const fetchRe = /\bfetch\s*\(\s*([^)]*)/g;
        let f;
        while ((f = fetchRe.exec(text))) {
          if (!/^['"`]\/api\//.test(f[1].trim())) add(file, lineOf(text, f.index), 'fetch() autorise uniquement vers /api/ (rien ne doit quitter le navigateur)');
        }
      }
    }

    if (ext === '.html') {
      for (const m of text.matchAll(/<script\b([^>]*)>/gi)) {
        if (!/\bsrc\s*=/.test(m[1])) add(file, lineOf(text, m.index), 'script en ligne interdit (CSP)');
        if (/\bsrc\s*=\s*["']?(?:https?:)?\/\//i.test(m[1])) add(file, lineOf(text, m.index), 'script externe interdit');
      }
      for (const m of text.matchAll(/<(?:link|img|iframe|source|video|audio|form)\b[^>]*\b(?:href|src|action)\s*=\s*["']?(?:https?:)?\/\/[^>]*>/gi)) {
        if (/<link\b[^>]*rel\s*=\s*["']?(?:canonical|license|author)/i.test(m[0])) continue;
        add(file, lineOf(text, m.index), 'ressource externe interdite');
      }
      for (const m of text.matchAll(/\son[a-z]+\s*=/gi)) add(file, lineOf(text, m.index), 'gestionnaire en ligne (onclick, ...) interdit (CSP)');
      for (const m of text.matchAll(/\sstyle\s*=/gi)) add(file, lineOf(text, m.index), 'attribut style interdit (CSP)');
      for (const m of text.matchAll(/<style\b/gi)) add(file, lineOf(text, m.index), 'balise style interdite (CSP)');
    }

    if (ext === '.css' && /@import\s+(?:url\()?\s*['"]?https?:/i.test(text)) add(file, 0, '@import externe interdit');

    if (path.basename(file) === 'package.json') {
      let pkg;
      try { pkg = JSON.parse(text); } catch (_) { add(file, 0, 'JSON invalide'); continue; }
      for (const k of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        for (const dep of Object.keys(pkg[k] || {})) {
          if (!ALLOWED_DEPS.has(dep)) add(file, 0, 'nouvelle dependance non validee par le mainteneur : ' + dep);
        }
      }
      for (const s of ['preinstall', 'install', 'postinstall', 'prepare']) {
        if (pkg.scripts && pkg.scripts[s]) add(file, 0, 'script de cycle de vie interdit : ' + s);
      }
    }

    if (rel.startsWith('.github' + path.sep + 'workflows') && /pull_request_target/.test(text)) {
      add(file, lineOf(text, text.indexOf('pull_request_target')), 'pull_request_target est interdit');
    }
    if (rel.startsWith('.github' + path.sep + 'workflows')) {
      for (const m of text.matchAll(/uses:\s*([^\s#]+)/g)) {
        if (!/@[0-9a-f]{40}$/.test(m[1]) && !m[1].startsWith('./')) add(file, lineOf(text, m.index), 'action GitHub non epinglee sur un SHA : ' + m[1]);
      }
    }
  }
  return problems;
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  const problems = check(root);
  if (problems.length) {
    console.error('Verification de politique : ' + problems.length + ' probleme(s)');
    for (const p of problems) console.error('  ' + p);
    process.exit(1);
  }
  console.log('Verification de politique : OK');
}

module.exports = { check };

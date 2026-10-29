const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { check } = require('../scripts/policy-check.js');

function tmp(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-policy-'));
  for (const [name, content] of Object.entries(files)) {
    const p = path.join(dir, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return dir;
}

test('le depot courant respecte la politique', () => {
  assert.deepStrictEqual(check(path.join(__dirname, '..')), []);
});

test('detecte les pratiques interdites', () => {
  const dir = tmp({
    'js/a.js': "el.innerHTML = x; fetch('https://evil.example/c'); eval('1');",
    'index.html': '<script>alert(1)</script><img src="https://x.example/a.png"><b onclick="x()" style="color:red">t</b>',
    'package.json': JSON.stringify({ dependencies: { leftpad: '1.0.0' }, scripts: { postinstall: 'node x.js' } }),
    'doc.md': 'texte \u2014 avec tiret',
    '.github/workflows/w.yml': 'on: pull_request_target\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n',
  });
  const out = check(dir).join('\n');
  for (const needle of ['innerHTML', 'fetch()', 'eval()', 'script en ligne', 'ressource externe', 'gestionnaire en ligne', 'attribut style', 'leftpad', 'postinstall', 'tiret long', 'pull_request_target', 'non epinglee']) {
    assert.ok(out.includes(needle), 'manque : ' + needle + '\n' + out);
  }
});

test('autorise fetch vers /api/ uniquement', () => {
  const dir = tmp({ 'js/a.js': "fetch('/api/hit', { method: 'POST' });" });
  assert.deepStrictEqual(check(dir), []);
});

test('tous les scripts du site ont une syntaxe valide', () => {
  const { execFileSync } = require('node:child_process');
  const root = path.join(__dirname, '..');
  const files = ['sw.js', ...fs.readdirSync(path.join(root, 'js')).map((f) => 'js/' + f), ...fs.readdirSync(path.join(root, 'api')).map((f) => 'api/' + f)];
  for (const f of files) {
    execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' });
  }
});

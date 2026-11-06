(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const T = window.SansTraceText;
  const I = window.SansTraceImage;
  const D = window.SansTraceDoc;
  const L = window.SansTraceI18n;
  const t = L.t;
  L.init(document);

  const MAX_IMAGE_BYTES = 40 * 1024 * 1024;

  // Anonymous per-country counter, sent once per session. No body, no identifier.
  function countVisit() {
    try {
      if (sessionStorage.getItem('st-counted')) return;
      sessionStorage.setItem('st-counted', '1');
    } catch (_) { return; }
    fetch('/api/hit', { method: 'POST', keepalive: true }).catch(() => {});
  }

  // Tabs
  const tabs = { text: [$('tab-text'), $('panel-text')], image: [$('tab-image'), $('panel-image')], doc: [$('tab-doc'), $('panel-doc')] };
  Object.values(tabs).forEach(([btn]) => {
    btn.addEventListener('click', () => {
      Object.values(tabs).forEach(([b, p]) => {
        const on = b === btn;
        b.setAttribute('aria-selected', String(on));
        p.hidden = !on;
      });
    });
  });

  // Text
  function readOptions() {
    const o = { lang: $('o-lang').value };
    ['boilerplate', 'citations', 'invisible', 'markdown', 'dashes', 'emoji', 'humanize', 'contractions'].forEach((k) => {
      o[k] = $('o-' + k).checked;
    });
    return o;
  }

  function renderReport(r) {
    const box = $('report');
    box.replaceChildren();
    if (!$('in').value.trim()) { box.hidden = true; return; }
    box.hidden = false;
    const h = document.createElement('h2');
    h.textContent = t('report.title', { lang: t(r.lang === 'fr' ? 'lang.fr' : 'lang.en') });
    box.appendChild(h);
    const ul = document.createElement('ul');
    const entries = Object.entries(r.counts);
    if (!entries.length) {
      const li = document.createElement('li');
      li.textContent = t('report.none');
      ul.appendChild(li);
    }
    entries.forEach(([k, n]) => {
      const li = document.createElement('li');
      li.textContent = t('count.' + k, { n });
      ul.appendChild(li);
    });
    r.removedLines.forEach((l) => {
      const li = document.createElement('li');
      li.textContent = t('report.line', { line: l });
      ul.appendChild(li);
    });
    box.appendChild(ul);
    if (r.stats.sentences >= 5 && r.stats.variation < 0.35) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = t('report.regular', { v: r.stats.variation });
      box.appendChild(p);
    }
  }

  function renderMarked(input) {
    const box = $('marked-box');
    const out = $('marked');
    out.replaceChildren();
    let flagged = 0;
    T.highlight(input).forEach((seg) => {
      if (!seg.why) { out.appendChild(document.createTextNode(seg.t)); return; }
      flagged += 1;
      const m = document.createElement('mark');
      m.title = L.tr(seg.why);
      m.textContent = seg.t;
      out.appendChild(m);
    });
    box.hidden = flagged === 0;
  }

  let lastDetect = null;
  let lastLang = 'fr';

  function renderDetect(box, input) {
    const d = T.detect(input);
    lastDetect = d;
    lastLang = T.detectLang(input);
    const p = document.createElement('p');
    p.className = 'detect';
    if (d.level === 'insufficient') {
      p.textContent = t('detect.short');
    } else {
      p.textContent = t('detect.result', { level: t('level.' + d.level), signals: d.signals, words: d.words });
    }
    box.appendChild(p);
  }

  function runText() {
    const input = $('in').value;
    let r;
    try {
      r = T.process(input, readOptions());
    } catch (e) {
      $('out').value = '';
      const box = $('report');
      box.hidden = false;
      box.textContent = t('toolong', { max: T.MAX_CHARS.toLocaleString(L.lang === 'fr' ? 'fr-FR' : 'en-US') });
      lastDetect = null;
      $('feedback').hidden = true;
      $('marked-box').hidden = true;
      return;
    }
    $('out').value = r.text;
    renderReport(r);
    const hasText = input.trim().length > 0;
    if (hasText) {
      renderDetect($('report'), input);
      countVisit();
    }
    $('feedback').hidden = !hasText;
    if (hasText) renderMarked(input); else $('marked-box').hidden = true;
  }
  $('feedback').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!lastDetect) return;
    const pick = (name) => document.querySelector('input[name="' + name + '"]:checked').value;
    const helpful = { yes: true, no: false, skip: null }[pick('fb-helpful')];
    const status = $('fb-status');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: pick('fb-label'), lang: lastLang, level: lastDetect.level, signals: lastDetect.signals, words: lastDetect.words, helpful }),
      });
      status.textContent = res.ok ? t('fb.thanks') : t('fb.fail');
    } catch (_) {
      status.textContent = t('fb.fail');
    }
    setTimeout(() => { status.textContent = ''; }, 4000);
  });
  $('in').addEventListener('input', runText);
  document.addEventListener('sans-trace:lang', runText);
  document.querySelectorAll('.opts input, .opts select').forEach((el) => el.addEventListener('change', runText));
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('out').value);
      $('copied').textContent = t('copied');
    } catch (_) {
      $('out').select();
      $('copied').textContent = t('copied.select');
    }
    setTimeout(() => { $('copied').textContent = ''; }, 2500);
  });

  // Files (images and documents)
  const fmt = (n) => (n < 1024 ? n + ' ' + t('unit.b') : n < 1048576 ? (n / 1024).toFixed(1) + ' ' + t('unit.kb') : (n / 1048576).toFixed(1) + ' ' + t('unit.mb'));

  async function viaCanvas(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return { blob, ext: 'png', findings: [{ label: t('file.png') }], notes: [] };
  }

  async function cleanImage(file, bytes) {
    const res = I.clean(bytes);
    if (!res.type) return viaCanvas(file);
    const mime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[res.type];
    return {
      blob: new Blob([res.out], { type: mime }),
      ext: res.type === 'jpeg' ? 'jpg' : res.type,
      findings: res.findings,
      notes: res.notes.concat('Les pixels ne sont pas modifiés.'),
    };
  }

  const DOC_MIME = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };

  async function cleanDocument(file, bytes) {
    const res = await D.clean(bytes);
    if (!res.type) throw new TypeError('format non pris en charge');
    const ext = (/\.([a-z0-9]+)$/i.exec(file.name) || [])[1];
    const kind = res.type === 'pdf' ? 'pdf' : (DOC_MIME[(ext || '').toLowerCase()] ? ext.toLowerCase() : 'docx');
    return { blob: new Blob([res.out], { type: DOC_MIME[kind] }), ext: kind, findings: res.findings, notes: res.notes };
  }

  function renderFindings(left, findings, notes, isImage) {
    const aiTraces = findings.some((f) => f.ai);
    const list = document.createElement('div');
    list.className = 'removed';
    if (!findings.length) {
      const none = document.createElement('div');
      none.className = 'row';
      none.textContent = t('file.none');
      list.appendChild(none);
    }
    findings.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'row' + (f.ai ? ' ai' : '') + (f.sensitive ? ' sensitive' : '');
      const what = document.createElement('span');
      what.textContent = L.tr(f.label) + (f.detail ? ': ' + f.detail : '');
      row.appendChild(what);
      const size = document.createElement('span');
      size.textContent = f.bytes ? fmt(f.bytes) : '';
      row.appendChild(size);
      list.appendChild(row);
    });
    left.appendChild(list);
    notes.forEach((n) => {
      const p = document.createElement('div');
      p.className = 'muted';
      p.textContent = L.tr(n);
      left.appendChild(p);
    });
    const verdict = document.createElement('div');
    verdict.className = 'detect';
    if (aiTraces) {
      verdict.textContent = t('file.ai');
    } else {
      verdict.textContent = t(isImage ? 'file.noai.img' : 'file.noai.doc');
    }
    left.appendChild(verdict);
  }

  async function handleFile(file, listEl, isImage) {
    const li = document.createElement('li');
    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = file.name;
    left.appendChild(name);
    li.appendChild(left);
    listEl.appendChild(li);

    try {
      if (file.size > MAX_IMAGE_BYTES) throw new RangeError('fichier trop volumineux');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { blob, ext, findings, notes } = isImage ? await cleanImage(file, bytes) : await cleanDocument(file, bytes);
      renderFindings(left, findings, notes, isImage);
      countVisit();
      const size = document.createElement('div');
      size.className = 'muted';
      size.textContent = t('file.to', { a: fmt(file.size), b: fmt(blob.size) });
      left.appendChild(size);

      const a = document.createElement('a');
      a.className = 'btn';
      a.textContent = t('file.download');
      a.href = URL.createObjectURL(blob);
      a.download = file.name.replace(/\.[^.]+$/, '') + '-clean.' + ext;
      li.appendChild(a);
    } catch (e) {
      const err = document.createElement('div');
      err.className = 'muted';
      if (e instanceof RangeError && e.message === 'fichier trop volumineux') err.textContent = t('file.big');
      else if (e instanceof TypeError) err.textContent = t('file.format');
      else err.textContent = t('file.read');
      left.appendChild(err);
    }
  }

  function bindDrop(dropEl, inputEl, listEl, accept, isImage) {
    const add = (list) => Array.from(list).filter(accept).forEach((f) => handleFile(f, listEl, isImage));
    inputEl.addEventListener('change', (e) => { add(e.target.files); e.target.value = ''; });
    dropEl.addEventListener('dragover', (e) => { e.preventDefault(); dropEl.classList.add('over'); });
    dropEl.addEventListener('dragleave', () => dropEl.classList.remove('over'));
    dropEl.addEventListener('drop', (e) => { e.preventDefault(); dropEl.classList.remove('over'); add(e.dataTransfer.files); });
    dropEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputEl.click(); } });
  }
  bindDrop($('drop'), $('file'), $('files'), (f) => f.type.startsWith('image/'), true);
  bindDrop($('drop-doc'), $('file-doc'), $('files-doc'), (f) => /\.(pdf|docx|xlsx|pptx)$/i.test(f.name), false);
})();

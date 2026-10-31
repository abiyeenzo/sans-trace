(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const T = window.SansTraceText;
  const I = window.SansTraceImage;
  const D = window.SansTraceDoc;

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
  const LABELS = {
    boilerplate: "phrases d'assistant retirées",
    citations: 'résidus de citation retirés',
    invisible: 'caractères invisibles retirés',
    markdown: 'éléments Markdown retirés',
    dashes: 'tirets longs remplacés',
    emoji: 'emojis retirés',
    humanize: 'tics de style remplacés',
  };

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
    h.textContent = 'Ce qui a changé (' + (r.lang === 'fr' ? 'français' : 'anglais') + ')';
    box.appendChild(h);
    const ul = document.createElement('ul');
    const entries = Object.entries(r.counts);
    if (!entries.length) {
      const li = document.createElement('li');
      li.textContent = 'Aucune trace détectée.';
      ul.appendChild(li);
    }
    entries.forEach(([k, n]) => {
      const li = document.createElement('li');
      li.textContent = n + ' ' + LABELS[k];
      ul.appendChild(li);
    });
    r.removedLines.forEach((l) => {
      const li = document.createElement('li');
      li.textContent = 'Ligne retirée : ' + l;
      ul.appendChild(li);
    });
    box.appendChild(ul);
    if (r.stats.sentences >= 5 && r.stats.variation < 0.35) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'Les phrases ont une longueur très régulière (variation ' + r.stats.variation + '). Un mélange de phrases courtes et longues, écrit à la main, rend le texte plus naturel.';
      box.appendChild(p);
    }
  }

  const LEVELS = {
    low: 'faible',
    medium: 'moyen',
    high: 'élevé',
  };

  function renderMarked(input) {
    const box = $('marked-box');
    const out = $('marked');
    out.replaceChildren();
    let flagged = 0;
    T.highlight(input).forEach((seg) => {
      if (!seg.why) { out.appendChild(document.createTextNode(seg.t)); return; }
      flagged += 1;
      const m = document.createElement('mark');
      m.title = seg.why;
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
      p.textContent = "Indice de style IA : texte trop court pour estimer (moins de 40 mots).";
    } else {
      p.textContent = 'Indice de style IA du texte d\'origine : ' + LEVELS[d.level] + '. ' + d.signals + ' tics repérés pour ' + d.words + ' mots. C\'est une estimation : un humain écrit parfois ainsi, et une IA peut écrire autrement.';
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
      box.textContent = 'Texte trop long (limite : ' + T.MAX_CHARS.toLocaleString('fr-FR') + ' caractères).';
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
      status.textContent = res.ok ? 'Merci, retour envoyé.' : "Envoi impossible pour le moment.";
    } catch (_) {
      status.textContent = "Envoi impossible pour le moment.";
    }
    setTimeout(() => { status.textContent = ''; }, 4000);
  });
  $('in').addEventListener('input', runText);
  document.querySelectorAll('.opts input, .opts select').forEach((el) => el.addEventListener('change', runText));
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('out').value);
      $('copied').textContent = 'Copié';
    } catch (_) {
      $('out').select();
      $('copied').textContent = 'Sélectionné, copie avec Ctrl+C';
    }
    setTimeout(() => { $('copied').textContent = ''; }, 2500);
  });

  // Files (images and documents)
  const fmt = (n) => (n < 1024 ? n + ' o' : n < 1048576 ? (n / 1024).toFixed(1) + ' Ko' : (n / 1048576).toFixed(1) + ' Mo');

  async function viaCanvas(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return { blob, ext: 'png', findings: [{ label: 'Métadonnées retirées par conversion en PNG' }], notes: [] };
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
      none.textContent = 'Aucune métadonnée trouvée';
      list.appendChild(none);
    }
    findings.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'row' + (f.ai ? ' ai' : '') + (f.sensitive ? ' sensitive' : '');
      const what = document.createElement('span');
      what.textContent = f.label + (f.detail ? ' : ' + f.detail : '');
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
      p.textContent = n;
      left.appendChild(p);
    });
    const verdict = document.createElement('div');
    verdict.className = 'detect';
    if (aiTraces) {
      verdict.textContent = 'Traces de provenance IA trouvées (elles ont été retirées).';
    } else if (isImage) {
      verdict.textContent = "Aucune trace de provenance IA dans les métadonnées. Cela ne prouve pas que l'image est réelle.";
    } else {
      verdict.textContent = 'Aucune trace de provenance IA dans les métadonnées. Cela ne prouve pas que le contenu est écrit à la main.';
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
      size.textContent = fmt(file.size) + ' vers ' + fmt(blob.size);
      left.appendChild(size);

      const a = document.createElement('a');
      a.className = 'btn';
      a.textContent = 'Télécharger';
      a.href = URL.createObjectURL(blob);
      a.download = file.name.replace(/\.[^.]+$/, '') + '-clean.' + ext;
      li.appendChild(a);
    } catch (e) {
      const err = document.createElement('div');
      err.className = 'muted';
      if (e instanceof RangeError && e.message === 'fichier trop volumineux') err.textContent = 'Fichier trop volumineux (limite : 40 Mo).';
      else if (e instanceof TypeError) err.textContent = 'Format non pris en charge.';
      else err.textContent = 'Impossible de lire ce fichier.';
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

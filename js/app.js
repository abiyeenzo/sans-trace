(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const T = window.SansTraceText;
  const I = window.SansTraceImage;

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
  const tabs = { text: [$('tab-text'), $('panel-text')], image: [$('tab-image'), $('panel-image')] };
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
      return;
    }
    $('out').value = r.text;
    renderReport(r);
    lastLang = r.lang;
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

  // Images
  const fmt = (n) => (n < 1024 ? n + ' o' : n < 1048576 ? (n / 1024).toFixed(1) + ' Ko' : (n / 1048576).toFixed(1) + ' Mo');

  async function viaCanvas(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return { blob, ext: 'png', findings: [{ label: 'Métadonnées retirées par conversion en PNG' }] };
  }

  async function handleFile(file) {
    const li = document.createElement('li');
    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = file.name;
    left.appendChild(name);
    li.appendChild(left);
    $('files').appendChild(li);

    try {
      if (file.size > MAX_IMAGE_BYTES) throw new RangeError('fichier trop volumineux');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = I.clean(bytes);
      let blob, ext, findings;
      if (res.type) {
        const mime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[res.type];
        blob = new Blob([res.out], { type: mime });
        ext = res.type === 'jpeg' ? 'jpg' : res.type;
        findings = res.findings;
      } else {
        ({ blob, ext, findings } = await viaCanvas(file));
      }

      const tags = document.createElement('div');
      tags.className = 'tags';
      const aiTraces = findings.some((f) => f.ai);
      if (!findings.length) findings = [{ label: 'Aucune métadonnée trouvée' }];
      findings.forEach((f) => {
        const t = document.createElement('span');
        t.className = 'tag' + (f.ai ? ' ai' : '');
        t.textContent = f.label;
        tags.appendChild(t);
      });
      left.appendChild(tags);
      const verdict = document.createElement('div');
      verdict.className = 'detect';
      verdict.textContent = aiTraces
        ? "Traces de provenance IA trouvées dans les métadonnées (elles ont été retirées)."
        : "Aucune trace de provenance IA dans les métadonnées. Cela ne prouve pas que l'image est réelle.";
      left.appendChild(verdict);
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
      err.textContent = e instanceof RangeError ? 'Fichier trop volumineux (limite : 40 Mo).' : 'Impossible de lire ce fichier.';
      left.appendChild(err);
    }
  }

  function addFiles(list) {
    Array.from(list).filter((f) => f.type.startsWith('image/')).forEach(handleFile);
  }
  const drop = $('drop');
  $('file').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } });
})();

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const T = window.SansTraceText;
  const I = window.SansTraceImage;

  // Tabs
  const tabs = { text: [$('tab-text'), $('panel-text')], image: [$('tab-image'), $('panel-image')] };
  Object.entries(tabs).forEach(([, [btn]) => {
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

  function runText() {
    const r = T.process($('in').value, readOptions());
    $('out').value = r.text;
    renderReport(r);
  }
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
      if (!findings.length) findings = [{ label: 'Aucune métadonnée trouvée' }];
      findings.forEach((f) => {
        const t = document.createElement('span');
        t.className = 'tag' + (f.ai ? ' ai' : '');
        t.textContent = f.label;
        tags.appendChild(t);
      });
      left.appendChild(tags);
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
      err.textContent = "Impossible de lire ce fichier.";
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

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let names;
  try { names = new Intl.DisplayNames(['fr'], { type: 'region' }); } catch (_) { names = null; }
  const label = (code) => {
    if (code === 'XX') return 'Pays inconnu';
    try { return (names && names.of(code)) || code; } catch (_) { return code; }
  };

  function ago(iso) {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 90) return "il y a moins d'une minute";
    if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' minutes';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' heures';
    return 'il y a ' + Math.round(s / 86400) + ' jours';
  }

  function row(code, hits, max) {
    const li = document.createElement('li');
    const tag = document.createElement('span');
    tag.className = 'code';
    tag.textContent = code;
    const name = document.createElement('span');
    name.className = 'cname';
    name.textContent = label(code);
    const bar = document.createElement('progress');
    bar.max = max;
    bar.value = hits;
    const n = document.createElement('span');
    n.className = 'muted';
    n.textContent = hits.toLocaleString('fr-FR');
    li.append(tag, name, bar, n);
    return li;
  }

  async function load() {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('indisponible');
      const d = await res.json();
      $('total').textContent = d.total.toLocaleString('fr-FR');
      const list = $('top');
      list.replaceChildren();
      if (!d.top.length) {
        const li = document.createElement('li');
        li.className = 'muted';
        li.textContent = "Pas encore de données.";
        list.appendChild(li);
      }
      const max = d.top.length ? d.top[0].hits : 1;
      d.top.forEach((r) => list.appendChild(row(r.country, r.hits, max)));
      $('last').textContent = d.last ? label(d.last.country) + ', ' + ago(d.last.at) : 'Aucune visite enregistrée.';
    } catch (_) {
      $('last').textContent = 'Statistiques indisponibles pour le moment.';
    }
  }
  load();
})();

(function (root) {
  'use strict';

  const MARK = '\u0001';

  const DEFAULTS = {
    boilerplate: true,
    citations: true,
    invisible: true,
    markdown: true,
    dashes: true,
    emoji: false,
    humanize: true,
    contractions: true,
    lang: 'auto',
  };

  const INTERJECTION = {
    fr: /^\s*(?:bien sûr|bien sur|certainement|absolument|avec plaisir|excellente question|bonne question)\s*[!,.:]*\s*/iu,
    en: /^\s*(?:certainly|sure|of course|absolutely|great question|good question)\s*[!,.:]*\s*/iu,
  };

  const LEAD = {
    fr: /^\s*(?:voici|voilà)(?!\p{L})/iu,
    en: /^\s*here(?:['’]s| is| are)(?!\p{L})/iu,
  };

  const CLOSER = {
    fr: /(?:j['’]espère que (?:cela|ça|ce)|n['’]hésite(?:z)? pas à|dis-moi si|dites-moi si|si (?:tu|vous) (?:veux|souhaites|voulez|souhaitez)[^.!?\n]{0,80}\b(?:je peux|je te|je vous|dis|dites)|en tant qu['’](?:ia|intelligence artificielle|assistant|modèle)|je suis (?:un|une) (?:ia|intelligence artificielle|assistant|modèle de langage))/iu,
    en: /(?:i hope this helps|let me know if|feel free to (?:ask|reach)|don['’]t hesitate to|happy to help|if you(?:['’]d| would) like[^.!?\n]{0,80}\b(?:i can|i could|i['’]d be happy)|as an ai\b|as a language model|i['’]m just an ai|i am an ai)/iu,
  };

  const HUMANIZE = {
    fr: [
      [/\b(?:il est (?:important|essentiel|crucial|primordial) de (?:noter|souligner|mentionner|rappeler) que|il convient de (?:noter|souligner|préciser) que|il est à noter que|force est de constater que|il faut (?:noter|souligner) que)\s*/giu, ''],
      [/\bdans le monde (?:d['’]aujourd['’]hui|moderne)/giu, "aujourd'hui"],
      [/\b(?:à l['’]ère du numérique|dans le paysage (?:numérique )?actuel)/giu, "aujourd'hui"],
      [/\b(?:en conclusion|pour conclure|en somme|en résumé|pour résumer),?/giu, 'au final,'],
      [/\b(?:de plus|en outre),/giu, 'en plus,'],
      [/\bpar ailleurs,/giu, "d'ailleurs,"],
      [/\bjoue(nt)? un rôle (?:crucial|essentiel|clé|central|majeur|fondamental) (dans|pour)\b/giu, (m, pl, prep) => (pl ? 'comptent' : 'compte') + ' beaucoup ' + prep],
      [/\bcrucial(e|es|aux)?\b/giu, (m, s) => ({ undefined: 'important', e: 'importante', es: 'importantes', aux: 'importants' })[s]],
      [/\bmet(tent)? en lumière\b/giu, (m, pl) => (pl ? 'montrent' : 'montre')],
      [/\bmettre en lumière\b/giu, 'montrer'],
      [/\btirer parti de\b/giu, 'profiter de'],
      [/\bun (?:large|vaste) éventail de\b/giu, 'beaucoup de'],
      [/\brobustes?\b/giu, (m) => (/s$/i.test(m) ? 'solides' : 'solide')],
      [/\bdans un monde (?:en constante évolution|en perpétuel changement|de plus en plus connecté)/giu, "aujourd'hui"],
      [/\b(?:sans aucun doute|il va sans dire que),?\s*/giu, ''],
      [/\bil est (?:essentiel|primordial|indispensable) de (?=\p{L})/giu, 'il faut '],
      [/\bun enjeu (?:majeur|crucial|central)\b/giu, 'un vrai sujet'],
      [/\bplonger au cœur de\b/giu, 'regarder de près'],
      [/\bà la croisée de\b/giu, 'entre'],
      [/\bune véritable révolution\b/giu, 'un gros changement'],
      [/\b(?:afin de|dans le but de)\b/giu, 'pour'],
      [/\bétant donné que\b/giu, 'comme'],
      [/\ben raison du fait que\b/giu, 'parce que'],
      [/\bà l['’]heure actuelle\b/giu, "aujourd'hui"],
    ],
    en: [
      [/\b(?:it is important to note that|it['’]s important to note that|it['’]s worth noting that|it is worth noting that|it should be noted that)\s*/giu, ''],
      [/\bin today['’]s (?:fast-paced|digital|modern) (?:world|age|landscape)/giu, 'today'],
      [/\bin the (?:ever-evolving )?(?:landscape|realm) of\b/giu, 'in'],
      [/\b(?:delve|dive)s? into\b/giu, (m) => (/s /i.test(m) ? 'looks at' : 'look at')],
      [/\b(?:delving|diving) into\b/giu, 'looking at'],
      [/\bin conclusion,|\bto sum up,|\bin summary,/giu, 'in the end,'],
      [/\b(?:furthermore|moreover|additionally),/giu, 'also,'],
      [/\bplays? an? (?:crucial|vital|pivotal|key|significant) role in\b/giu, (m) => (/^plays/i.test(m) ? 'matters a lot in' : 'matter a lot in')],
      [/\bleverag(e|es|ed|ing)\b/giu, (m, f) => ({ e: 'use', es: 'uses', ed: 'used', ing: 'using' })[f.toLowerCase()]],
      [/\butiliz(e|es|ed|ing)\b/giu, (m, f) => ({ e: 'use', es: 'uses', ed: 'used', ing: 'using' })[f.toLowerCase()]],
      [/\bseamless(ly)?\b/giu, (m, ly) => (ly ? 'smoothly' : 'smooth')],
      [/\brobust\b/giu, 'solid'],
      [/\bpivotal\b/giu, 'key'],
      [/\bcrucial\b/giu, 'important'],
      [/\btapestry\b/giu, 'mix'],
      [/\ba testament to\b/giu, 'proof of'],
      [/\bunderscores?\b/giu, (m) => (/s$/i.test(m) ? 'shows' : 'show')],
      [/\ba wide (?:range|array) of\b/giu, 'many'],
      [/\bgame-changer\b/giu, 'big change'],
      [/\bunlock(?:s|ing)? the potential of\b/giu, 'make the most of'],
      [/\bit(?:['’]s| is) (?:crucial|essential|vital) to\b/giu, 'you need to'],
      [/\bnavigat(?:e|es|ing) the (?:complex )?(?:landscape|world) of\b/giu, 'deal with'],
      [/\bembark(?:s|ed|ing)? on a journey\b/giu, 'start'],
      [/\bever-evolving\b/giu, 'changing'],
      [/\bcutting-edge\b/giu, 'new'],
      [/\bgroundbreaking\b/giu, 'new'],
      [/\bholistic\b/giu, 'full'],
      [/\bmeticulous(ly)?\b/giu, (m, ly) => (ly ? 'carefully' : 'careful')],
      [/\bintricate\b/giu, 'complex'],
      [/\bvibrant\b/giu, 'lively'],
      [/\bbustling\b/giu, 'busy'],
    ],
  };

  const CONTRACTIONS = [
    [/\b(do|does|did|is|are|was|were|has|have|had|would|should|could|must) not(?=\s+[\p{L}\d])/giu, (m, v) => v + "n't"],
    [/\bwill not(?=\s+[\p{L}\d])/giu, "won't"],
    [/\bcannot(?=\s+[\p{L}\d])/giu, "can't"],
    [/\b(you|we|they) are(?=\s+[\p{L}\d])/giu, (m, p) => p + "'re"],
    [/\bI am(?=\s+[\p{L}\d])/gu, "I'm"],
    [/\b(that|there|it|here) is(?=\s+[\p{L}\d])/giu, (m, p) => p + "'s"],
    [/\blet us(?=\s+[\p{L}\d])/giu, "let's"],
  ];

  function matchCase(orig, repl) {
    if (!repl) return repl;
    const c = orig[0];
    return c !== c.toLowerCase() && c === c.toUpperCase() ? repl[0].toUpperCase() + repl.slice(1) : repl;
  }

  function detectLang(text) {
    const words = text.toLowerCase().match(/\p{L}+/gu) || [];
    const fr = new Set(['le', 'la', 'les', 'des', 'est', 'une', 'et', 'que', 'pour', 'dans', 'qui', 'pas', 'sur', 'avec']);
    const en = new Set(['the', 'and', 'is', 'of', 'to', 'in', 'that', 'for', 'with', 'are', 'this', 'it']);
    let f = 0;
    let e = 0;
    for (const w of words) {
      if (fr.has(w)) f++;
      if (en.has(w)) e++;
    }
    return f > e ? 'fr' : 'en';
  }

  function stats(text) {
    const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    const lens = sentences.map((s) => (s.match(/\p{L}+/gu) || []).length).filter((n) => n > 0);
    if (!lens.length) return { sentences: 0, mean: 0, variation: 0 };
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
    return { sentences: lens.length, mean: Math.round(mean * 10) / 10, variation: mean ? Math.round((Math.sqrt(variance) / mean) * 100) / 100 : 0 };
  }

  const MAX_CHARS = 200000;

  function process(input, options) {
    if (typeof input !== 'string') throw new TypeError('le texte doit etre une chaine');
    if (input.length > MAX_CHARS) throw new RangeError('texte trop long');
    const o = Object.assign({}, DEFAULTS, options);
    const lang = o.lang === 'auto' ? detectLang(input) : o.lang;
    const counts = {};
    const removedLines = [];
    const bump = (k, n) => { if (n) counts[k] = (counts[k] || 0) + n; };

    const sub = (text, re, to, key) => text.replace(re, (...a) => {
      bump(key, 1);
      return typeof to === 'function' ? to(...a) : to.replace(/\$(\d)/g, (_, n) => a[Number(n)] || '');
    });

    let text = input.replace(/\r\n?/g, '\n');

    if (o.citations) {
      text = sub(text, /[^]*/gu, '', 'citations');
      text = sub(text, /[-]/gu, '', 'citations');
      text = sub(text, /:contentReference\[oaicite:\d+\]\{[^}]*\}/g, '', 'citations');
      text = sub(text, /【[^】]*】/gu, '', 'citations');
      text = sub(text, /\?utm_source=(?:chatgpt\.com|openai|claude\.ai|claude|copilot|perplexity|gemini)&/gi, '?', 'citations');
      text = sub(text, /[?&]utm_source=(?:chatgpt\.com|openai|claude\.ai|claude|copilot|perplexity|gemini)/gi, '', 'citations');
    }

    if (o.invisible) {
      text = sub(text, /[\u200B\u200C\u200D\u2060\uFEFF\u00AD\u180E\u2061-\u2064\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/gu, '', 'invisible');
    }

    if (o.boilerplate) {
      const out = [];
      for (const line of text.split('\n')) {
        let l = line;
        const inter = INTERJECTION[lang];
        if (inter && inter.test(l)) {
          l = l.replace(inter, '');
          bump('boilerplate', 1);
        }
        const short = l.trim().length <= 200;
        const isLead = LEAD[lang] && LEAD[lang].test(l) && /:\s*$/.test(l) && short;
        const isCloser = CLOSER[lang] && CLOSER[lang].test(l) && short;
        if (isLead || isCloser) {
          removedLines.push(line.trim());
          bump('boilerplate', 1);
          continue;
        }
        if (l !== line && !l.trim()) continue;
        out.push(l);
      }
      text = out.join('\n');
    }

    if (o.markdown) {
      text = sub(text, /^\s{0,3}#{1,6}\s+/gm, '', 'markdown');
      text = sub(text, /\*\*(.+?)\*\*/gs, '$1', 'markdown');
      text = sub(text, /__(.+?)__/gs, '$1', 'markdown');
      text = sub(text, /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '', 'markdown');
    }

    if (o.dashes) {
      text = sub(text, /(\S)[ \t]*\u2014[ \t]*(?=\S)/gu, '$1, ', 'dashes');
      text = sub(text, /(\S) \u2013 (?=\S)/gu, '$1, ', 'dashes');
    }

    if (o.emoji) {
      text = sub(text, /[\p{Extended_Pictographic}\uFE0F]/gu, '', 'emoji');
    }

    if (o.humanize) {
      const rules = (HUMANIZE[lang] || []).slice();
      if (lang === 'en' && o.contractions) rules.push(...CONTRACTIONS);
      for (const [re, to] of rules) {
        text = text.replace(re, (m, ...a) => {
          bump('humanize', 1);
          const r = typeof to === 'function' ? to(m, ...a) : to;
          return r === '' ? MARK : matchCase(m, r);
        });
      }
      text = text.replace(new RegExp('(^|[.!?:]\\s+|\\n)' + MARK + '(\\p{L})', 'gu'), (m, a, b) => a + b.toUpperCase());
      text = text.split(MARK).join('');
    }

    text = text
      .replace(/[ \t]+$/gm, '')
      .replace(/ {2,}/g, ' ')
      .replace(/ +([,.;!?])(?=\s|$)/g, lang === 'fr' ? ' $1' : '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { text, lang, counts, removedLines, stats: stats(text) };
  }

  // Splits the original text into segments, flagging the passages the cleaner would touch.
  function highlight(input) {
    if (typeof input !== 'string') throw new TypeError('le texte doit etre une chaine');
    if (input.length > MAX_CHARS) throw new RangeError('texte trop long');
    const lang = detectLang(input);
    const ranges = [];
    const scan = (re, why, invisible) => {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = g.exec(input))) {
        if (!m[0].length) { g.lastIndex++; continue; }
        const trimmed = m[0].replace(/\s+$/, '');
        if (trimmed.length) ranges.push([m.index, m.index + trimmed.length, why, !!invisible]);
      }
    };

    let offset = 0;
    for (const line of input.split('\n')) {
      const inter = INTERJECTION[lang];
      const lead = inter ? inter.exec(line) : null;
      if (lead && lead[0].trim()) ranges.push([offset + lead[0].length - lead[0].trimStart().length, offset + lead[0].trimEnd().length, "phrase d'assistant", false]);
      const rest = lead ? line.slice(lead[0].length) : line;
      const short = rest.trim().length <= 200;
      const isLead = LEAD[lang] && LEAD[lang].test(rest) && /:\s*$/.test(rest) && short;
      const isCloser = CLOSER[lang] && CLOSER[lang].test(rest) && short;
      if ((isLead || isCloser) && line.trim()) ranges.push([offset + (line.length - line.trimStart().length), offset + line.trimEnd().length, "phrase d'assistant", false]);
      offset += line.length + 1;
    }

    for (const [re] of HUMANIZE[lang] || []) scan(re, 'tic de style courant', false);
    scan(/\u2014/u, 'tiret long', false);
    scan(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD\u180E\u2061-\u2064\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/u, 'caractere invisible', true);
    scan(/\uE200[^\uE201]*\uE201|:contentReference\[oaicite:\d+\]\{[^}]*\}|\u3010[^\u3011]*\u3011/u, 'residu de citation', false);
    scan(/[?&]utm_source=(?:chatgpt\.com|openai|claude\.ai|claude|copilot|perplexity|gemini)/i, 'lien suivi par une IA', false);

    ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const merged = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] < last[1]) { if (r[1] > last[1]) last[1] = r[1]; } else merged.push(r.slice());
    }

    const out = [];
    let pos = 0;
    for (const [s, e, why, invisible] of merged) {
      if (s > pos) out.push({ t: input.slice(pos, s) });
      out.push({ t: invisible ? '[invisible]' : input.slice(s, e), why });
      pos = e;
    }
    if (pos < input.length) out.push({ t: input.slice(pos) });
    return out;
  }

  // Rough style estimate. Humans also write like this, so the result is only an indication.
  function detect(input) {
    const words = (input.match(/\p{L}+/gu) || []).length;
    if (words < 40) return { level: 'insufficient', words, signals: 0, per100: 0, variation: 0 };
    const r = process(input, { boilerplate: true, citations: true, invisible: true, markdown: false, dashes: true, emoji: false, humanize: true, contractions: false });
    const c = r.counts;
    const signals = (c.boilerplate || 0) + (c.citations || 0) + (c.invisible || 0) + (c.dashes || 0) + (c.humanize || 0);
    const st = stats(input);
    const per100 = Math.round((signals / words) * 1000) / 10;
    const regular = st.sentences >= 5 && st.variation < 0.3;
    const score = per100 + (regular ? 1 : 0);
    const level = score < 0.8 ? 'low' : score < 2 ? 'medium' : 'high';
    return { level, words, signals, per100, variation: st.variation, regular };
  }

  const api = { process, detect, highlight, detectLang, stats, DEFAULTS, MAX_CHARS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SansTraceText = api;
})(typeof self !== 'undefined' ? self : this);

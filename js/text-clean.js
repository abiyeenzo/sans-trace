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

  function process(input, options) {
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
      text = sub(text, /[​‌‍⁠﻿­᠎⁡-⁤‪-‮⁦-⁩]|[\u{E0000}-\u{E007F}]/gu, '', 'invisible');
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
      text = sub(text, /(\S)[ \t]*—[ \t]*(?=\S)/gu, '$1, ', 'dashes');
      text = sub(text, /(\S) – (?=\S)/gu, '$1, ', 'dashes');
    }

    if (o.emoji) {
      text = sub(text, /[\p{Extended_Pictographic}️]/gu, '', 'emoji');
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

  const api = { process, detectLang, stats, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SansTraceText = api;
})(typeof self !== 'undefined' ? self : this);

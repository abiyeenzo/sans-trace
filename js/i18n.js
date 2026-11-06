(function (root) {
  'use strict';

  const FR = {
    'page.title': 'Sans Trace : nettoyer et humaniser textes et images',
    'page.desc': "Retire les résidus d'IA des textes (formules toutes faites, tirets, caractères invisibles) et les métadonnées des images (EXIF, C2PA, prompts). Tout se passe dans ton navigateur.",
    'tab.text': 'Texte',
    'tab.image': 'Images',
    'tab.doc': 'Documents',
    'text.h1': 'Un texte qui sonne comme toi',
    'text.lead': "Colle un texte généré par une IA. Sans Trace retire les formules toutes faites, les tirets longs, les caractères invisibles et les restes de mise en forme, puis remplace les tics de style les plus courants.",
    'text.in': "Texte d'origine",
    'text.in.ph': 'Colle ton texte ici',
    'text.out': 'Résultat',
    'opts.legend': 'Options',
    'o.boilerplate': 'Phrases d\'assistant ("Voici…", "J\'espère que cela aide")',
    'o.citations': 'Résidus de citations et liens suivis',
    'o.invisible': 'Caractères invisibles',
    'o.markdown': 'Gras, titres et séparateurs Markdown',
    'o.dashes': 'Tirets longs',
    'o.emoji': 'Emojis',
    'o.humanize': 'Remplacer les tics de style',
    'o.contractions': 'Contractions (anglais)',
    'o.lang': 'Langue du texte',
    'o.lang.auto': 'Détection auto',
    'copy': 'Copier le résultat',
    'copied': 'Copié',
    'copied.select': 'Sélectionné, copie avec Ctrl+C',
    'lang.fr': 'français',
    'lang.en': 'anglais',
    'report.title': 'Ce qui a changé ({lang})',
    'report.none': 'Aucune trace détectée.',
    'report.line': 'Ligne retirée : {line}',
    'report.regular': 'Les phrases ont une longueur très régulière (variation {v}). Un mélange de phrases courtes et longues, écrit à la main, rend le texte plus naturel.',
    'count.boilerplate': "{n} phrases d'assistant retirées",
    'count.citations': '{n} résidus de citation retirés',
    'count.invisible': '{n} caractères invisibles retirés',
    'count.markdown': '{n} éléments Markdown retirés',
    'count.dashes': '{n} tirets longs remplacés',
    'count.emoji': '{n} emojis retirés',
    'count.humanize': '{n} tics de style remplacés',
    'detect.short': "Indice de style IA : texte trop court pour estimer (moins de 40 mots).",
    'detect.result': "Indice de style IA du texte d'origine : {level}. {signals} tics repérés pour {words} mots. C'est une estimation : un humain écrit parfois ainsi, et une IA peut écrire autrement.",
    'level.low': 'faible',
    'level.medium': 'moyen',
    'level.high': 'élevé',
    'toolong': 'Texte trop long (limite : {max} caractères).',
    'marked.h': 'Passages repérés dans ton texte',
    'marked.p': "Survole un passage surligné pour voir pourquoi il est repéré. Un humain écrit parfois ainsi : c'est un indice, pas une preuve.",
    'fb.title': "Aide-nous à améliorer l'outil. Seul ton choix est envoyé, jamais ton texte.",
    'fb.l1': "Ce texte d'origine est",
    'fb.ai': 'écrit par une IA',
    'fb.human': 'écrit par moi',
    'fb.mixed': 'mélangé',
    'fb.unknown': 'je ne sais pas',
    'fb.l2': 'Le résultat sonne naturel ?',
    'fb.yes': 'oui',
    'fb.no': 'non',
    'fb.skip': 'sans avis',
    'fb.send': 'Envoyer mon retour',
    'fb.thanks': 'Merci, retour envoyé.',
    'fb.fail': 'Envoi impossible pour le moment.',
    'img.h1': 'Des images sans métadonnées',
    'img.lead': 'Retire les EXIF (GPS compris), le XMP, les Content Credentials C2PA et les prompts écrits dans les PNG. Les pixels ne sont pas modifiés : pas de perte de qualité. JPEG, PNG et WebP.',
    'img.drop': 'Dépose des images ici ou',
    'drop.choose': 'choisis des fichiers',
    'img.note': "Limites : une image générée peut aussi porter un filigrane invisible dans ses pixels. Sans Trace ne cherche pas à le retirer. Les formats autres que JPEG, PNG et WebP sont convertis en PNG.",
    'doc.h1': 'Des documents sans signature',
    'doc.lead': "Retire l'auteur, le logiciel, les dates et les propriétés personnalisées des PDF, DOCX, XLSX et PPTX. Le contenu du document n'est pas modifié.",
    'doc.drop': 'Dépose des documents ici ou',
    'doc.note': "Limites : le texte, les images intégrées, les commentaires et l'historique de révisions restent tels quels. Les PDF chiffrés ne sont pas traités, et un champ stocké dans un flux compressé est signalé sans être modifié.",
    'footer.text': 'Textes et images traités dans ton navigateur. Par Abiye Enzo, code ouvert non commercial.',
    'f.stats': 'Statistiques',
    'f.privacy': 'Confidentialité',
    'f.legal': 'Mentions légales',
    'f.terms': 'Conditions',
    'f.source': 'Code source',
    'f.contribute': 'Contribuer',
    'file.none': 'Aucune métadonnée trouvée',
    'file.ai': 'Traces de provenance IA trouvées (elles ont été retirées).',
    'file.noai.img': "Aucune trace de provenance IA dans les métadonnées. Cela ne prouve pas que l'image est réelle.",
    'file.noai.doc': 'Aucune trace de provenance IA dans les métadonnées. Cela ne prouve pas que le contenu est écrit à la main.',
    'file.to': '{a} vers {b}',
    'file.download': 'Télécharger',
    'file.big': 'Fichier trop volumineux (limite : 40 Mo).',
    'file.format': 'Format non pris en charge.',
    'file.read': 'Impossible de lire ce fichier.',
    'file.png': 'Métadonnées retirées par conversion en PNG',
    'unit.b': 'o',
    'unit.kb': 'Ko',
    'unit.mb': 'Mo',
  };

  const EN = {
    'page.title': 'Sans Trace: remove AI traces from text, images and documents',
    'page.desc': 'Removes AI leftovers from text (stock phrases, dashes, invisible characters) and metadata from images and documents (EXIF, C2PA, prompts). Everything runs in your browser.',
    'tab.text': 'Text',
    'tab.image': 'Images',
    'tab.doc': 'Documents',
    'text.h1': 'Text that sounds like you',
    'text.lead': 'Paste text written by an AI. Sans Trace removes stock phrases, long dashes, invisible characters and leftover formatting, then replaces the most common style tics.',
    'text.in': 'Original text',
    'text.in.ph': 'Paste your text here',
    'text.out': 'Result',
    'opts.legend': 'Options',
    'o.boilerplate': 'Assistant phrases ("Here is...", "I hope this helps")',
    'o.citations': 'Citation leftovers and tracking links',
    'o.invisible': 'Invisible characters',
    'o.markdown': 'Markdown bold, headings and separators',
    'o.dashes': 'Long dashes',
    'o.emoji': 'Emojis',
    'o.humanize': 'Replace style tics',
    'o.contractions': 'Contractions (English)',
    'o.lang': 'Text language',
    'o.lang.auto': 'Auto-detect',
    'copy': 'Copy result',
    'copied': 'Copied',
    'copied.select': 'Selected, copy with Ctrl+C',
    'lang.fr': 'French',
    'lang.en': 'English',
    'report.title': 'What changed ({lang})',
    'report.none': 'No trace detected.',
    'report.line': 'Removed line: {line}',
    'report.regular': 'Sentence lengths are very even (variation {v}). A hand-written mix of short and long sentences makes the text feel more natural.',
    'count.boilerplate': '{n} assistant phrases removed',
    'count.citations': '{n} citation leftovers removed',
    'count.invisible': '{n} invisible characters removed',
    'count.markdown': '{n} Markdown elements removed',
    'count.dashes': '{n} long dashes replaced',
    'count.emoji': '{n} emojis removed',
    'count.humanize': '{n} style tics replaced',
    'detect.short': 'AI style indicator: text too short to estimate (under 40 words).',
    'detect.result': 'AI style indicator for the original text: {level}. {signals} tics spotted in {words} words. This is an estimate: humans sometimes write this way, and an AI can write differently.',
    'level.low': 'low',
    'level.medium': 'medium',
    'level.high': 'high',
    'toolong': 'Text too long (limit: {max} characters).',
    'marked.h': 'Passages spotted in your text',
    'marked.p': 'Hover a highlighted passage to see why it was flagged. Humans sometimes write this way: it is a hint, not proof.',
    'fb.title': 'Help us improve the tool. Only your choice is sent, never your text.',
    'fb.l1': 'The original text is',
    'fb.ai': 'written by an AI',
    'fb.human': 'written by me',
    'fb.mixed': 'a mix',
    'fb.unknown': "I don't know",
    'fb.l2': 'Does the result sound natural?',
    'fb.yes': 'yes',
    'fb.no': 'no',
    'fb.skip': 'no opinion',
    'fb.send': 'Send my feedback',
    'fb.thanks': 'Thanks, feedback sent.',
    'fb.fail': 'Unable to send right now.',
    'img.h1': 'Images without metadata',
    'img.lead': 'Removes EXIF (GPS included), XMP, C2PA Content Credentials and prompts written into PNGs. Pixels are not modified, so there is no quality loss. JPEG, PNG and WebP.',
    'img.drop': 'Drop images here or',
    'drop.choose': 'choose files',
    'img.note': 'Limits: a generated image can also carry an invisible watermark in its pixels. Sans Trace does not try to remove it. Formats other than JPEG, PNG and WebP are converted to PNG.',
    'doc.h1': 'Documents without a signature',
    'doc.lead': 'Removes the author, software, dates and custom properties from PDF, DOCX, XLSX and PPTX files. The document content is not modified.',
    'doc.drop': 'Drop documents here or',
    'doc.note': 'Limits: text, embedded images, comments and revision history are left as they are. Encrypted PDFs are not processed, and a field stored in a compressed stream is reported but not modified.',
    'footer.text': 'Text and images are processed in your browser. By Abiye Enzo, open non-commercial code.',
    'f.stats': 'Statistics',
    'f.privacy': 'Privacy',
    'f.legal': 'Legal notice',
    'f.terms': 'Terms',
    'f.source': 'Source code',
    'f.contribute': 'Contribute',
    'file.none': 'No metadata found',
    'file.ai': 'AI provenance traces found (they have been removed).',
    'file.noai.img': 'No AI provenance trace in the metadata. This does not prove the image is real.',
    'file.noai.doc': 'No AI provenance trace in the metadata. This does not prove the content was written by hand.',
    'file.to': '{a} to {b}',
    'file.download': 'Download',
    'file.big': 'File too large (limit: 40 MB).',
    'file.format': 'Unsupported format.',
    'file.read': 'Unable to read this file.',
    'file.png': 'Metadata removed by converting to PNG',
    'unit.b': 'B',
    'unit.kb': 'KB',
    'unit.mb': 'MB',
  };

  // French strings emitted by the cleaning modules, translated at display time.
  const EN_FROM_FR = {
    'EXIF avec position GPS': 'EXIF with GPS location',
    'EXIF (appareil, date, logiciel)': 'EXIF (camera, date, software)',
    'Commentaire JPEG': 'JPEG comment',
    "Orientation de l'image conservée (seul son indicateur est gardé)": 'Image orientation kept (only its flag is preserved)',
    'Les pixels ne sont pas modifiés.': 'Pixels are not modified.',
    'Auteur': 'Author',
    'Dernier auteur': 'Last modified by',
    'Titre': 'Title',
    'Sujet': 'Subject',
    'Mots-clés': 'Keywords',
    'Catégorie': 'Category',
    'Date de création': 'Creation date',
    'Date de modification': 'Modification date',
    'Logiciel': 'Software',
    'Logiciel (création)': 'Software (creator)',
    'Logiciel (export)': 'Software (producer)',
    'Société': 'Company',
    'Responsable': 'Manager',
    'Modèle': 'Template',
    'Propriétés personnalisées': 'Custom properties',
    'Métadonnées XMP': 'XMP metadata',
    'Miniature du document conservée (elle montre la première page).': 'Document thumbnail kept (it shows the first page).',
    'Commentaires du document conservés.': 'Document comments kept.',
    'Informations du document dans un flux compressé : non nettoyées.': 'Document info in a compressed stream: not cleaned.',
    'Certains champs sont stockés ailleurs dans le fichier : non nettoyés.': 'Some fields are stored elsewhere in the file: not cleaned.',
    'Métadonnées XMP compressées : non nettoyées.': 'Compressed XMP metadata: not cleaned.',
    'tic de style courant': 'common style tic',
    'tiret long': 'long dash',
    'caractere invisible': 'invisible character',
    'residu de citation': 'citation leftover',
    'lien suivi par une IA': 'AI tracking link',
  };

  const DICTS = { fr: FR, en: EN };
  let lang = 'fr';

  function t(key, vars) {
    let s = (DICTS[lang] && DICTS[lang][key]) || FR[key] || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
    return s;
  }

  function tr(text) {
    if (lang !== 'en') return text;
    if (EN_FROM_FR[text]) return EN_FROM_FR[text];
    const m = /^Segment APP(\d+)$/.exec(text);
    return m ? 'APP' + m[1] + ' segment' : text;
  }

  function detect(nav) {
    const l = String((nav && (nav.language || (nav.languages || [])[0])) || '').toLowerCase();
    return l.startsWith('fr') || !l ? 'fr' : 'en';
  }

  function apply(doc) {
    doc.documentElement.lang = lang;
    doc.title = t('page.title');
    const meta = doc.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('page.desc'));
    doc.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    doc.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    doc.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }

  function setLang(next, doc) {
    if (!DICTS[next]) return;
    lang = next;
    try { localStorage.setItem('st-lang', next); } catch (_) { /* storage can be blocked */ }
    if (doc) {
      apply(doc);
      doc.dispatchEvent(new Event('sans-trace:lang'));
    }
  }

  function init(doc) {
    let saved = null;
    try { saved = localStorage.getItem('st-lang'); } catch (_) { /* storage can be blocked */ }
    lang = DICTS[saved] ? saved : detect(typeof navigator !== 'undefined' ? navigator : null);
    apply(doc);
    doc.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang, doc)));
  }

  const api = { t, tr, init, setLang, detect, dicts: DICTS, get lang() { return lang; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SansTraceI18n = api;
})(typeof window !== 'undefined' ? window : globalThis);

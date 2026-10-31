(function (root) {
  'use strict';

  const MAX_ENTRIES = 5000;
  const MAX_PART = 1 << 20;
  const AI_DOC = /chatgpt|openai|\bgpt-?\d|claude|anthropic|gemini|copilot|midjourney|dall-?e|perplexity|mistral|c2pa|contentcredentials/i;

  const le16 = (b, i) => b[i] | (b[i + 1] << 8);
  const le32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
  const ascii = (b, s, e) => String.fromCharCode.apply(null, b.subarray(s, Math.min(e, b.length)));

  let crcTable = null;
  function crc32(b) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function concat(parts) {
    const n = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  // ---- ZIP (used by DOCX, XLSX, PPTX) ----

  function readZip(b) {
    if (b.length < 22) throw new RangeError('zip trop court');
    const min = Math.max(0, b.length - 22 - 65535);
    let e = -1;
    for (let i = b.length - 22; i >= min; i--) {
      if (le32(b, i) === 0x06054b50) { e = i; break; }
    }
    if (e < 0) throw new RangeError('fin de zip introuvable');
    const n = le16(b, e + 10);
    const cdSize = le32(b, e + 12);
    const cdOff = le32(b, e + 16);
    if (le16(b, e + 4) || le16(b, e + 6)) throw new RangeError('zip multi-disques');
    if (n === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) throw new RangeError('zip64 non pris en charge');
    if (n > MAX_ENTRIES || cdOff + cdSize > e) throw new RangeError('zip invalide');

    const entries = [];
    let p = cdOff;
    for (let k = 0; k < n; k++) {
      if (p + 46 > cdOff + cdSize || le32(b, p) !== 0x02014b50) throw new RangeError('zip invalide');
      const flags = le16(b, p + 8);
      const nlen = le16(b, p + 28);
      const elen = le16(b, p + 30);
      const clen = le16(b, p + 32);
      const lho = le32(b, p + 42);
      if (p + 46 + nlen + elen + clen > cdOff + cdSize) throw new RangeError('zip invalide');
      if (flags & 1) throw new RangeError('zip chiffre');
      if (lho + 30 > cdOff || le32(b, lho) !== 0x04034b50) throw new RangeError('zip invalide');
      const csize = le32(b, p + 20);
      const dataStart = lho + 30 + le16(b, lho + 26) + le16(b, lho + 28);
      if (csize === 0xffffffff || dataStart + csize > cdOff) throw new RangeError('zip invalide');
      entries.push({
        name: new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen)),
        nameBytes: b.subarray(p + 46, p + 46 + nlen),
        flags: flags & 0x800,
        method: le16(b, p + 10),
        time: le16(b, p + 12),
        date: le16(b, p + 14),
        crc: le32(b, p + 16),
        csize,
        usize: le32(b, p + 24),
        data: b.subarray(dataStart, dataStart + csize),
      });
      p += 46 + nlen + elen + clen;
    }
    return entries;
  }

  function u16(v) { return [v & 255, (v >> 8) & 255]; }
  function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }

  // Local headers and central directory are rewritten; extra fields are dropped.
  function writeZip(entries) {
    const parts = [];
    const central = [];
    let off = 0;
    for (const en of entries) {
      const head = Uint8Array.from([
        0x50, 0x4b, 3, 4, ...u16(20), ...u16(en.flags), ...u16(en.method), ...u16(en.time), ...u16(en.date),
        ...u32(en.crc), ...u32(en.data.length), ...u32(en.usize), ...u16(en.nameBytes.length), 0, 0,
      ]);
      parts.push(head, en.nameBytes, en.data);
      central.push(Uint8Array.from([
        0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(en.flags), ...u16(en.method), ...u16(en.time), ...u16(en.date),
        ...u32(en.crc), ...u32(en.data.length), ...u32(en.usize), ...u16(en.nameBytes.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ...u32(off),
      ]), en.nameBytes);
      off += head.length + en.nameBytes.length + en.data.length;
    }
    const cd = concat(central);
    const end = Uint8Array.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(entries.length), ...u16(entries.length), ...u32(cd.length), ...u32(off), 0, 0]);
    return concat([...parts, cd, end]);
  }

  async function inflateRaw(data, cap) {
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter();
    w.write(data).catch(() => {});
    w.close().catch(() => {});
    const r = ds.readable.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      total += value.length;
      if (total > cap) { r.cancel().catch(() => {}); throw new RangeError('partie trop volumineuse'); }
      chunks.push(value);
    }
    return concat(chunks);
  }

  async function partText(en) {
    if (en.usize > MAX_PART) throw new RangeError('partie trop volumineuse');
    let raw;
    if (en.method === 0) raw = en.data;
    else if (en.method === 8) raw = await inflateRaw(en.data, MAX_PART);
    else return '';
    return new TextDecoder().decode(raw);
  }

  const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const EMPTY = {
    'docProps/core.xml': XML_HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>',
    'docProps/app.xml': XML_HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>',
    'docProps/custom.xml': XML_HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>',
  };

  const CORE_FIELDS = {
    'dc:creator': 'Auteur',
    'cp:lastModifiedBy': 'Dernier auteur',
    'dc:title': 'Titre',
    'dc:subject': 'Sujet',
    'cp:keywords': 'Mots-clés',
    'dc:description': 'Description',
    'cp:category': 'Catégorie',
    'dcterms:created': 'Date de création',
    'dcterms:modified': 'Date de modification',
  };
  const APP_FIELDS = { Application: 'Logiciel', Company: 'Société', Manager: 'Responsable', Template: 'Modèle' };

  const unescapeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const clip = (s) => (s.length > 60 ? s.slice(0, 57) + '...' : s);

  function xmlFields(xml, table) {
    const out = [];
    for (const [tag, label] of Object.entries(table)) {
      const m = new RegExp('<' + tag + '(?:\\s[^>]*)?>([^<]*)</' + tag + '>').exec(xml);
      const value = m ? unescapeXml(m[1]).trim() : '';
      if (value) out.push({ kind: tag, label, detail: clip(value), ai: AI_DOC.test(value) });
    }
    return out;
  }

  async function ooxml(b, entries) {
    const findings = [];
    const notes = [];
    for (const en of entries) {
      const bytes = en.usize;
      if (en.name === 'docProps/core.xml') {
        findings.push(...xmlFields(await partText(en), CORE_FIELDS));
      } else if (en.name === 'docProps/app.xml') {
        findings.push(...xmlFields(await partText(en), APP_FIELDS));
      } else if (en.name === 'docProps/custom.xml') {
        const n = (await partText(en)).split('<property ').length - 1;
        if (n) findings.push({ kind: 'custom', label: 'Propriétés personnalisées', detail: String(n), bytes });
      } else if (/^docProps\/thumbnail\./.test(en.name)) {
        notes.push('Miniature du document conservée (elle montre la première page).');
      } else if (/^(word|xl|ppt)\/comments/i.test(en.name) || /^ppt\/comments\//i.test(en.name)) {
        notes.push('Commentaires du document conservés.');
      }
    }
    const out = entries.map((en) => {
      const xml = EMPTY[en.name];
      if (!xml) return en;
      const data = new TextEncoder().encode(xml);
      return { ...en, method: 0, crc: crc32(data), data, usize: data.length };
    });
    return { type: 'ooxml', findings, notes: [...new Set(notes)], out: writeZip(out) };
  }

  // ---- PDF ----
  // Values are blanked in place so every byte offset (xref table) stays valid.

  const INFO_KEYS = { Title: 'Titre', Author: 'Auteur', Subject: 'Sujet', Keywords: 'Mots-clés', Creator: 'Logiciel (création)', Producer: 'Logiciel (export)', CreationDate: 'Date de création', ModDate: 'Date de modification' };
  const isDelim = (c) => c === undefined || /[\s/<>()[\]{}%]/.test(c);

  function readLiteral(text, b, at) {
    let depth = 0;
    const bytes = [];
    for (let i = at; i < text.length && i < at + 8192; i++) {
      const c = text[i];
      if (c === '\\') {
        const n = text[i + 1];
        i += 1;
        if (n === 'n') bytes.push(10);
        else if (n === 'r') bytes.push(13);
        else if (n === 't') bytes.push(9);
        else if (n >= '0' && n <= '7') {
          let oct = n;
          while (oct.length < 3 && text[i + 1] >= '0' && text[i + 1] <= '7') { oct += text[i + 1]; i += 1; }
          bytes.push(parseInt(oct, 8) & 255);
        } else if (n === '\n' || n === '\r') { /* line continuation */ } else bytes.push(b[i]);
      } else if (c === '(') {
        depth += 1;
        if (depth > 1) bytes.push(40);
      } else if (c === ')') {
        depth -= 1;
        if (depth === 0) return { end: i, bytes };
        bytes.push(41);
      } else bytes.push(b[i]);
    }
    return null;
  }

  function decodePdfString(bytes) {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      let s = '';
      for (let i = 2; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
      return s;
    }
    return bytes.map((c) => String.fromCharCode(c)).join('');
  }

  function blank(out, from, to, open, close) {
    out[from] = open;
    out[from + 1] = close;
    for (let i = from + 2; i <= to; i++) out[i] = 0x20;
  }

  function pdf(b) {
    const text = new TextDecoder('latin1').decode(b);
    if (text.length !== b.length) throw new RangeError('lecture impossible');
    const findings = [];
    const notes = [];
    if (/\/Encrypt\b/.test(text)) {
      return { type: 'pdf', findings, notes: ['PDF chiffré : laissé tel quel.'], out: b };
    }
    const out = b.slice();

    const infoNums = new Set();
    for (const m of text.matchAll(/\/Info\s+(\d{1,10})\s+\d{1,5}\s+R/g)) infoNums.add(m[1]);
    let infoFound = false;
    let indirect = false;
    for (const num of infoNums) {
      const re = new RegExp('(?<![\\d.])' + num + '\\s+\\d{1,5}\\s+obj\\b', 'g');
      for (const m of text.matchAll(re)) {
        const start = m.index + m[0].length;
        const end = text.indexOf('endobj', start);
        if (end < 0 || end - start > 65536) continue;
        infoFound = true;
        for (const [key, label] of Object.entries(INFO_KEYS)) {
          const k = text.indexOf('/' + key, start);
          if (k < 0 || k >= end || !isDelim(text[k + key.length + 1])) continue;
          let p = k + key.length + 1;
          while (p < end && /\s/.test(text[p])) p++;
          let value = null;
          if (text[p] === '(') {
            const lit = readLiteral(text, b, p);
            if (lit) { value = decodePdfString(lit.bytes); blank(out, p, lit.end, 0x28, 0x29); }
          } else if (text[p] === '<' && text[p + 1] !== '<') {
            const close = text.indexOf('>', p);
            if (close > p && close - p < 8192) {
              const hex = text.slice(p + 1, close).replace(/\s/g, '');
              const bytes = [];
              for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2).padEnd(2, '0'), 16) || 0);
              value = decodePdfString(bytes);
              blank(out, p, close, 0x3c, 0x3e);
            }
          } else if (/^\d+\s+\d+\s+R/.test(text.slice(p, p + 24))) {
            indirect = true;
          }
          if (value && value.trim()) findings.push({ kind: key, label, detail: clip(value.trim()), ai: AI_DOC.test(value) });
        }
      }
    }
    if (infoNums.size && !infoFound) notes.push('Informations du document dans un flux compressé : non nettoyées.');
    if (indirect) notes.push('Certains champs sont stockés ailleurs dans le fichier : non nettoyés.');

    // XMP metadata streams
    const MIN = '<?xpacket begin="ï»¿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>';
    const TAIL = '<?xpacket end="w"?>';
    let compressedXmp = false;
    for (const m of text.matchAll(/\/Type\s*\/Metadata/g)) {
      const s = text.indexOf('stream', m.index);
      if (s < 0 || s - m.index > 600) continue;
      const dict = text.slice(m.index, s);
      if (!dict.includes('/XML')) continue;
      if (/\/Filter\b/.test(dict)) { compressedXmp = true; continue; }
      let a = s + 6;
      if (text[a] === '\r') a++;
      if (text[a] === '\n') a++;
      let z = text.indexOf('endstream', a);
      if (z < 0) continue;
      while (z > a && (text[z - 1] === '\n' || text[z - 1] === '\r')) z--;
      const body = text.slice(a, z);
      if (!/xmpmeta|xpacket/.test(body)) continue;
      findings.push({ kind: 'xmp', label: 'Métadonnées XMP', bytes: z - a, ai: AI_DOC.test(body) });
      const repl = z - a >= MIN.length + TAIL.length ? MIN + ' '.repeat(z - a - MIN.length - TAIL.length) + TAIL : ' '.repeat(z - a);
      for (let i = 0; i < repl.length; i++) out[a + i] = repl.charCodeAt(i) & 255;
    }
    if (compressedXmp) notes.push('Métadonnées XMP compressées : non nettoyées.');
    return { type: 'pdf', findings, notes, out };
  }

  // ---- entry points ----

  function detectType(b) {
    if (b.length > 8 && ascii(b, 0, 1024).includes('%PDF-')) return 'pdf';
    if (b.length > 22 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) return 'zip';
    return null;
  }

  // Returns { type, findings, notes, out }, or { type: null } for an unsupported file.
  async function clean(bytes) {
    const t = detectType(bytes);
    if (t === 'pdf') return pdf(bytes);
    if (t === 'zip') {
      const entries = readZip(bytes);
      if (!entries.some((e) => e.name === '[Content_Types].xml')) return { type: null, findings: [], notes: [], out: bytes };
      return ooxml(bytes, entries);
    }
    return { type: null, findings: [], notes: [], out: bytes };
  }

  const api = { clean, detectType, readZip, crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SansTraceDoc = api;
})(typeof self !== 'undefined' ? self : this);

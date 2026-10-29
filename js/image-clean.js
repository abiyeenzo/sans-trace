(function (root) {
  'use strict';

  const u16 = (b, i) => (b[i] << 8) | b[i + 1];
  const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const le32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
  const ascii = (b, s, e) => String.fromCharCode.apply(null, b.subarray(s, Math.min(e, b.length)));

  const AI_HINTS = /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|midjourney|dall-?e|firefly|stable.?diffusion|comfyui|sdxl|openai|gemini|imagen|c2pa|contentcredentials/i;

  function detectType(b) {
    if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
    if (b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return 'png';
    if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp';
    return null;
  }

  function exifInfo(b, start, end) {
    // start points at the TIFF header (after "Exif\0\0")
    const le = ascii(b, start, start + 2) === 'II';
    const r16 = (i) => (le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
    const r32 = (i) => (le ? le32(b, i) : u32(b, i));
    const info = { orientation: 1, gps: false };
    try {
      const ifd = start + r32(start + 4);
      const n = r16(ifd);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 12 > end) break;
        const tag = r16(e);
        if (tag === 0x0112) info.orientation = r16(e + 8);
        if (tag === 0x8825) info.gps = true;
      }
    } catch (_) { /* malformed exif, ignore */ }
    return info;
  }

  function orientationExif(o) {
    const t = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, o & 255, 0, 0, 0, 0, 0, 0, 0];
    const len = t.length + 2;
    return Uint8Array.from([0xff, 0xe1, len >> 8, len & 255, ...t]);
  }

  // Each handler walks the container once and returns { findings, out }.
  function jpeg(b, keepOrientation) {
    const findings = [];
    const parts = [b.subarray(0, 2)];
    let i = 2;
    let orientation = 1;
    while (i + 4 <= b.length && b[i] === 0xff) {
      const m = b[i + 1];
      if (m === 0xda) break;
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xd8) { parts.push(b.subarray(i, i + 2)); i += 2; continue; }
      const len = u16(b, i + 2);
      const seg = b.subarray(i, i + 2 + len);
      const body = ascii(b, i + 4, i + 4 + Math.min(len - 2, 4096));
      let drop = false;
      if (m === 0xe1 && body.startsWith('Exif')) {
        const info = exifInfo(b, i + 10, i + 2 + len);
        orientation = info.orientation;
        findings.push({ kind: 'exif', label: info.gps ? 'EXIF avec position GPS' : 'EXIF (appareil, date, logiciel)' });
        drop = true;
      } else if (m === 0xe1 && body.includes('xmp')) {
        findings.push({ kind: 'xmp', label: 'XMP', ai: AI_HINTS.test(body) });
        drop = true;
      } else if (m === 0xeb) {
        findings.push({ kind: 'c2pa', label: 'Content Credentials (C2PA)', ai: true });
        drop = true;
      } else if (m === 0xfe) {
        findings.push({ kind: 'comment', label: 'Commentaire JPEG', ai: AI_HINTS.test(body) });
        drop = true;
      } else if (m === 0xed) {
        findings.push({ kind: 'iptc', label: 'Photoshop / IPTC' });
        drop = true;
      } else if ((m >= 0xe3 && m <= 0xea) || m === 0xec) {
        findings.push({ kind: 'app', label: 'Segment APP' + (m - 0xe0) });
        drop = true;
      }
      if (!drop) parts.push(seg);
      i += 2 + len;
    }
    if (keepOrientation && orientation > 1 && orientation <= 8) parts.splice(1, 0, orientationExif(orientation));
    parts.push(b.subarray(i));
    return { findings, out: concat(parts) };
  }

  function png(b) {
    const findings = [];
    const parts = [b.subarray(0, 8)];
    let i = 8;
    const DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'caBX', 'tIME']);
    while (i + 12 <= b.length) {
      const len = u32(b, i);
      const type = ascii(b, i + 4, i + 8);
      const end = i + 12 + len;
      if (DROP.has(type)) {
        let label = 'Bloc PNG ' + type;
        let ai = false;
        if (type === 'caBX') { label = 'Content Credentials (C2PA)'; ai = true; }
        else if (type === 'eXIf') label = 'EXIF';
        else if (type === 'tIME') label = 'Date de modification';
        else {
          const data = b.subarray(i + 8, i + 8 + len);
          const nul = data.indexOf(0);
          const key = ascii(data, 0, nul < 0 ? 0 : nul);
          label = 'Texte PNG (' + key + ')';
          ai = /^(parameters|prompt|workflow|Software|Comment|Description)$/i.test(key) || AI_HINTS.test(ascii(data, 0, 2048));
        }
        findings.push({ kind: type, label, ai });
      } else {
        parts.push(b.subarray(i, end));
      }
      i = end;
      if (type === 'IEND') break;
    }
    return { findings, out: concat(parts) };
  }

  function webp(b) {
    const findings = [];
    const parts = [];
    let i = 12;
    while (i + 8 <= b.length) {
      const cc = ascii(b, i, i + 4);
      const size = le32(b, i + 4);
      const end = i + 8 + size + (size & 1);
      let chunk = b.subarray(i, Math.min(end, b.length));
      if (cc === 'EXIF') findings.push({ kind: 'exif', label: 'EXIF' });
      else if (cc === 'XMP ') findings.push({ kind: 'xmp', label: 'XMP', ai: AI_HINTS.test(ascii(b, i + 8, i + 8 + Math.min(size, 4096))) });
      else if (cc === 'C2PA') findings.push({ kind: 'c2pa', label: 'Content Credentials (C2PA)', ai: true });
      else {
        if (cc === 'VP8X') { chunk = chunk.slice(); chunk[8] &= ~0x0c; }
        parts.push(chunk);
      }
      i = end;
    }
    const body = concat(parts);
    const head = new Uint8Array(12);
    head.set(b.subarray(0, 12));
    const total = body.length + 4;
    head[4] = total & 255; head[5] = (total >> 8) & 255; head[6] = (total >> 16) & 255; head[7] = (total >> 24) & 255;
    return { findings, out: concat([head, body]) };
  }

  function concat(parts) {
    const n = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  // Returns { type, findings, out } or { type: null } when the format needs a canvas re-encode.
  function clean(bytes, opts) {
    const keepOrientation = !opts || opts.keepOrientation !== false;
    const type = detectType(bytes);
    if (type === 'jpeg') return Object.assign({ type }, jpeg(bytes, keepOrientation));
    if (type === 'png') return Object.assign({ type }, png(bytes));
    if (type === 'webp') return Object.assign({ type }, webp(bytes));
    return { type: null, findings: [], out: bytes };
  }

  const api = { clean, detectType };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SansTraceImage = api;
})(typeof self !== 'undefined' ? self : this);

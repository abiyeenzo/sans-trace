const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const D = require('../js/doc-clean.js');
const I = require('../js/image-clean.js');

// Minimal ZIP writer for fixtures: [name, text, 'store' | 'deflate'].
function zip(files) {
  const parts = [];
  const central = [];
  let off = 0;
  const w16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
  const w32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
  for (const [name, text, mode] of files) {
    const raw = Buffer.from(text);
    const data = mode === 'deflate' ? zlib.deflateRawSync(raw) : raw;
    const nm = Buffer.from(name);
    const common = [w16(20), w16(0), w16(mode === 'deflate' ? 8 : 0), w16(0), w16(0x21), w32(zlib.crc32(raw)), w32(data.length), w32(raw.length), w16(nm.length), w16(0)];
    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), ...common, nm, data]);
    central.push(Buffer.concat([Buffer.from([0x50, 0x4b, 1, 2]), w16(20), ...common, w16(0), w16(0), w16(0), w32(0), w32(off), nm]));
    parts.push(local);
    off += local.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.concat([Buffer.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0]), w16(files.length), w16(files.length), w32(cd.length), w32(off), w16(0)]);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}

const CORE = '<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dc="y" xmlns:dcterms="z"><dc:creator>Jean Dupont</dc:creator><cp:lastModifiedBy>ChatGPT</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-01-02T03:04:05Z</dcterms:created><dc:title>Note</dc:title></cp:coreProperties>';
const APP = '<?xml version="1.0"?><Properties xmlns="x"><Application>Microsoft Office Word</Application><Company>ACME &amp; Co</Company></Properties>';
const CUSTOM = '<?xml version="1.0"?><Properties xmlns="x"><property fmtid="a" pid="2" name="Projet"><vt:lpwstr>Secret</vt:lpwstr></property></Properties>';
const docx = () => zip([
  ['[Content_Types].xml', '<Types/>', 'store'],
  ['word/document.xml', '<w:document>' + 'bonjour '.repeat(200) + '</w:document>', 'deflate'],
  ['docProps/core.xml', CORE, 'deflate'],
  ['docProps/app.xml', APP, 'store'],
  ['docProps/custom.xml', CUSTOM, 'deflate'],
]);

const inflate = (en) => (en.method === 8 ? zlib.inflateRawSync(en.data) : Buffer.from(en.data));

test('docx : auteur, logiciel, dates et proprietes retires, contenu intact', async () => {
  const r = await D.clean(docx());
  assert.strictEqual(r.type, 'ooxml');
  const labels = r.findings.map((f) => f.label + '=' + (f.detail || ''));
  assert.ok(labels.includes('Auteur=Jean Dupont'));
  assert.ok(labels.includes('Société=ACME & Co'));
  assert.ok(labels.includes('Propriétés personnalisées=1'));
  assert.ok(r.findings.find((f) => f.label === 'Dernier auteur').ai);
  const entries = D.readZip(r.out);
  assert.deepStrictEqual(entries.map((e) => e.name), ['[Content_Types].xml', 'word/document.xml', 'docProps/core.xml', 'docProps/app.xml', 'docProps/custom.xml']);
  for (const en of entries) {
    const data = inflate(en);
    assert.strictEqual(zlib.crc32(data), en.crc, en.name);
    assert.strictEqual(data.length, en.usize, en.name);
  }
  const text = (n) => inflate(entries.find((e) => e.name === n)).toString();
  assert.ok(text('word/document.xml').startsWith('<w:document>bonjour'));
  const all = Buffer.from(r.out).toString('latin1');
  for (const secret of ['Jean Dupont', 'ChatGPT', 'ACME', 'Secret', 'Microsoft']) assert.ok(!all.includes(secret), secret);
});

test('docx : sans metadonnees, aucun constat', async () => {
  const bare = zip([['[Content_Types].xml', '<Types/>', 'store'], ['word/document.xml', '<w/>', 'store']]);
  const r = await D.clean(bare);
  assert.strictEqual(r.type, 'ooxml');
  assert.deepStrictEqual(r.findings, []);
});

test('docx : miniature et commentaires signales comme conserves', async () => {
  const z = zip([['[Content_Types].xml', '<Types/>', 'store'], ['docProps/thumbnail.jpeg', 'x', 'store'], ['word/comments.xml', '<c/>', 'store']]);
  const r = await D.clean(z);
  assert.strictEqual(r.notes.length, 2);
});

test('zip : refuse les archives invalides ou piegees', async () => {
  await assert.rejects(() => D.clean(Uint8Array.from([0x50, 0x4b, 3, 4, ...new Array(40).fill(0)])), RangeError);
  const good = docx();
  const cut = good.slice(0, good.length - 10);
  await assert.rejects(() => D.clean(cut), RangeError);
  const big = zip([['[Content_Types].xml', '<Types/>', 'store'], ['docProps/core.xml', '<a>' + 'x'.repeat(3 << 20) + '</a>', 'deflate']]);
  await assert.rejects(() => D.clean(big), RangeError);
});

test('fichier inconnu : type null, octets inchanges', async () => {
  const txt = new Uint8Array(Buffer.from('hello world, ceci est un texte'));
  const r = await D.clean(txt);
  assert.strictEqual(r.type, null);
  assert.strictEqual(r.out, txt);
  const plainZip = zip([['a.txt', 'x', 'store']]);
  assert.strictEqual((await D.clean(plainZip)).type, null);
});

const XMP = '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description xmp:CreatorTool="Claude"/></rdf:RDF></x:xmpmeta>' + ' '.repeat(300) + '<?xpacket end="w"?>';
function pdfFile(extra) {
  const xmp = Buffer.from(XMP, 'latin1');
  return Buffer.concat([
    Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Metadata 4 0 R >>\nendobj\n'),
    Buffer.from('3 0 obj\n<< /Title (Rapport \\(final\\)) /Author <FEFF004A00650061006E> /Producer (ChatGPT) /CreationDate (D:20260101000000Z) /Custom (x) >>\nendobj\n'),
    Buffer.from('4 0 obj\n<< /Type /Metadata /Subtype /XML /Length ' + xmp.length + ' >>\nstream\n'), xmp, Buffer.from('\nendstream\nendobj\n'),
    Buffer.from('trailer\n<< /Root 1 0 R /Info 3 0 R ' + (extra || '') + '>>\n%%EOF\n'),
  ]);
}

test('pdf : Info et XMP vides sans changer la taille', async () => {
  const src = new Uint8Array(pdfFile());
  const r = await D.clean(src);
  assert.strictEqual(r.type, 'pdf');
  assert.strictEqual(r.out.length, src.length);
  const by = Object.fromEntries(r.findings.map((f) => [f.label, f]));
  assert.strictEqual(by['Titre'].detail, 'Rapport (final)');
  assert.strictEqual(by['Auteur'].detail, 'Jean');
  assert.ok(by['Logiciel (export)'].ai);
  assert.ok(by['Métadonnées XMP'].ai);
  const out = Buffer.from(r.out).toString('latin1');
  for (const secret of ['Rapport', 'Jean', 'ChatGPT', 'D:2026', 'Claude']) assert.ok(!out.includes(secret), secret);
  assert.ok(out.includes('/Title ()'));
  assert.ok(out.includes('/Custom (x)'));
  assert.ok(out.includes('<x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>'));
  assert.ok(out.includes('/Type /Catalog'));
  assert.ok(out.includes('endstream'));
});

test('pdf : chiffre = inchange, Info en flux compresse = signale', async () => {
  const enc = new Uint8Array(pdfFile('/Encrypt 9 0 R '));
  const r = await D.clean(enc);
  assert.strictEqual(r.out, enc);
  assert.ok(r.notes[0].includes('chiffré'));
  const noObj = new Uint8Array(Buffer.from('%PDF-1.7\ntrailer\n<< /Root 1 0 R /Info 7 0 R >>\n%%EOF\n'));
  const r2 = await D.clean(noObj);
  assert.ok(r2.notes[0].includes('compressé'));
});

test('image : tailles, GPS sensible et orientation dans le rapport', () => {
  const tiff = [0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 2, 0, 0x12, 1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0x25, 0x88, 4, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = body.length + 2;
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...body, 0xff, 0xda, 0, 2, 9, 9, 0xff, 0xd9]);
  const r = I.clean(jpeg);
  assert.strictEqual(r.findings[0].sensitive, true);
  assert.strictEqual(r.findings[0].bytes, len + 2);
  assert.ok(r.notes[0].includes('Orientation'));
  assert.deepStrictEqual(I.clean(jpeg, { keepOrientation: false }).notes, []);
});

const test = require('node:test');
const assert = require('node:assert');
const T = require('../js/text-clean.js');
const I = require('../js/image-clean.js');

test('retire phrases d assistant et tirets longs (fr)', () => {
  const r = T.process("Bien sûr ! Voici une version améliorée :\n\nLe projet avance \u2014 et vite. Il est important de noter que le budget tient.\n\nJ'espère que cela t'aide.");
  assert.ok(!r.text.includes('Voici'));
  assert.ok(!r.text.includes('\u2014'));
  assert.ok(!r.text.includes("J'espère"));
  assert.ok(r.text.includes('Le budget tient'));
});

test('markdown, invisibles et citations', () => {
  const r = T.process('## Titre\n**Gras** texte\u200B ici :contentReference[oaicite:0]{index=0} https://x.com/a?utm_source=chatgpt.com');
  assert.strictEqual(r.text, 'Titre\nGras texte ici https://x.com/a');
});

test('humanisation anglaise et contractions', () => {
  const r = T.process('Furthermore, we do not leverage this. It is important to note that it is a robust tool.');
  assert.ok(r.text.startsWith('Also, we don\'t use this.'));
  assert.ok(r.text.includes('Its a solid tool') === false);
  assert.ok(r.text.includes('solid tool'));
  assert.ok(!/important to note/.test(r.text));
});

test('ne touche pas au texte propre', () => {
  const s = 'Il pleut ce matin. On reste à la maison.';
  assert.strictEqual(T.process(s).text, s);
});

function jpegWithMeta() {
  const exif = [0xff, 0xe1, 0, 0x16, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const c2pa = [0xff, 0xeb, 0, 6, 0x6a, 0x75, 0x6d, 0x62];
  const dqt = [0xff, 0xdb, 0, 4, 1, 2];
  return Uint8Array.from([0xff, 0xd8, ...exif, ...c2pa, ...dqt, 0xff, 0xda, 0, 2, 9, 9, 0xff, 0xd9]);
}

test('jpeg : EXIF et C2PA retirés, le reste intact', () => {
  const r = I.clean(jpegWithMeta());
  assert.strictEqual(r.type, 'jpeg');
  assert.ok(r.findings.some((f) => f.kind === 'c2pa'));
  assert.ok(r.findings.some((f) => f.kind === 'exif'));
  assert.deepStrictEqual(Array.from(r.out), [0xff, 0xd8, 0xff, 0xdb, 0, 4, 1, 2, 0xff, 0xda, 0, 2, 9, 9, 0xff, 0xd9]);
});

function pngChunk(type, data) {
  const b = Buffer.alloc(12 + data.length);
  b.writeUInt32BE(data.length, 0);
  b.write(type, 4, 'ascii');
  Buffer.from(data).copy(b, 8);
  return b;
}

test('png : bloc parameters (prompt) retiré', () => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = Buffer.concat([sig, pngChunk('IHDR', Buffer.alloc(13)), pngChunk('tEXt', Buffer.from('parameters\0a cat')), pngChunk('IDAT', [1, 2]), pngChunk('IEND', [])]);
  const r = I.clean(new Uint8Array(png));
  assert.strictEqual(r.type, 'png');
  assert.ok(r.findings[0].ai);
  assert.strictEqual(r.out.length, png.length - 12 - 16);
});

test('webp : EXIF retiré et taille RIFF recalculée', () => {
  const chunk = (cc, data) => { const b = Buffer.alloc(8 + data.length); b.write(cc, 0, 'ascii'); b.writeUInt32LE(data.length, 4); Buffer.from(data).copy(b, 8); return b; };
  const body = Buffer.concat([Buffer.from('WEBP'), chunk('VP8X', Buffer.from([0x08, 0, 0, 0, 0, 0, 0, 0, 0, 0])), chunk('VP8 ', [1, 2, 3, 4]), chunk('EXIF', [9, 9, 9, 9])]);
  const head = Buffer.alloc(8); head.write('RIFF', 0, 'ascii'); head.writeUInt32LE(body.length, 4);
  const r = I.clean(new Uint8Array(Buffer.concat([head, body])));
  assert.strictEqual(r.type, 'webp');
  assert.ok(r.findings.some((f) => f.kind === 'exif'));
  assert.strictEqual(Buffer.from(r.out).readUInt32LE(4), r.out.length - 8);
  assert.strictEqual(r.out[20], 0);
});

test('detect : texte tres charge en tics = niveau eleve, texte simple = faible', () => {
  const ai = "It is important to note that we leverage robust tools. Furthermore, we delve into the tapestry of seamless solutions. Moreover, this plays a crucial role in today's fast-paced world. Additionally, we utilize pivotal methods to underscore the testament to quality. In conclusion, it is worth noting that these tools are robust and seamless for everyone who wants to leverage them every day.";
  assert.strictEqual(T.detect(ai).level, 'high');
  const human = "Hier j'ai rate le bus. Du coup marche jusqu'au bureau sous la pluie, trempe, de mauvaise humeur. Au moins le cafe etait chaud. Ma collegue m'a pret un pull sec, ce qui m'a sauve la journee. Le soir, on a mange des beignets devant le match en riant de tout et de rien jusqu'a minuit passe.";
  assert.strictEqual(T.detect(human).level, 'low');
  assert.strictEqual(T.detect('trop court').level, 'insufficient');
});

test('refuse un texte demesure', () => {
  assert.throws(() => T.process('a'.repeat(T.MAX_CHARS + 1)), RangeError);
});

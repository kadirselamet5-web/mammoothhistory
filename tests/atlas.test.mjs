// Unit checks for the atlas's pure functions, run against the built page.
//   node --test tests/
// The page exposes its filtering, parsing and state helpers when __ATLAS_TEST__ is set, so the
// tests exercise the exact script that ships in index.html with the exact embedded payload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(process.env.ATLAS_HTML ? path.resolve(process.env.ATLAS_HTML) : path.join(here, '..', 'index.html'), 'utf8');
const payload = JSON.parse(html.match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const app = scripts.find(s => s.includes('Mammoth History Lab specimen atlas'));
assert.ok(app, 'app script found in index.html');

globalThis.__ATLAS_TEST__ = true;
globalThis.__ATLAS_DATA__ = payload;
globalThis.document = { getElementById: () => ({ textContent: '' }) };
new Function(app)();
const A = globalThis.__ATLAS_API__;
assert.ok(A, 'test API exported');

const ageOf = text => A.parseAge({ age: [text, 'val'] });

test('payload matches the workbook summary', () => {
  assert.equal(payload.recs.length, payload.metadata.source_rows);
  assert.equal(payload.recs.length, payload.stats.total);
  assert.equal(new Set(payload.recs.map(r => r.id)).size, payload.recs.length, 'record ids are unique');
  assert.equal(payload.recs.filter(A.hasCoords).length, payload.stats.mapped);
  assert.deepEqual(Object.keys(A.TAXA), Object.keys(payload.species));
  assert.equal(A.TAXON_COUNT, Object.keys(payload.species).length);
  for (const r of payload.recs) {
    assert.ok(A.TAXA[r.species], `taxon known: ${r.species}`);
    assert.ok(A.PROVENANCE[r.coordinate_key || 'unlabelled'], `provenance known: ${r.coordinate_key}`);
    for (const f of r.facets) assert.ok(A.MATERIALS[f], `material tag known: ${f}`);
    assert.equal(r.source_values.Specimen_id, r.source_id);
  }
});

test('every record has a chronology year inside the timeline', () => {
  for (const r of payload.recs) {
    const y = A.recordYear(r);
    assert.ok(y >= A.MIN && y <= A.MAX, `${r.id}: ${y}`);
  }
  assert.equal(A.MIN, payload.timeline.min);
  assert.equal(A.MAX, payload.timeline.max);
});

test('age notation: thousands groups separated by space, comma or period', () => {
  assert.deepEqual(ageOf('29 500  ± 500 yBP ').values, [29500]);
  assert.deepEqual(ageOf('34, 450-35,800 cal. BP.').values, [34450, 35800]);
  assert.deepEqual(ageOf('31.700 ± 1.300').values, [31700]);
  assert.equal(ageOf('31.700 ± 1.300').lo, 30400);
  assert.equal(ageOf('31.700 ± 1.300').hi, 33000);
  assert.equal(ageOf('31.700 ± 1.300').key, 'b2');
});

test('age notation: missing, uncertain and ambiguous values', () => {
  for (const t of ['not_available', 'not_applicable', 'n/a', 'undated', 'unknown', '?', '']) {
    assert.equal(ageOf(t).kind, 'missing', t);
  }
  assert.equal(A.parseAge({ age: ['not_available', 'na'] }).kind, 'missing');
  assert.equal(A.parseAge({ age: ['?', 'q'] }).kind, 'missing');
  assert.equal(ageOf('>50 0000 years').kind, 'unparsed');
  assert.equal(ageOf('older than 53, 170').kind, 'lower');
  assert.equal(ageOf('older than 53, 170').hi, Infinity);
  const multi = ageOf('61 000+ years / 28, 690± 130 yr BP');
  assert.equal(multi.kind, 'multiple');
  assert.equal(multi.intervals.length, 2);
  assert.ok(A.ageOverlaps(multi, 28000, 29000));
  assert.ok(!A.ageOverlaps(multi, 30000, 40000), 'gap between alternative values is not an age range');
  assert.ok(A.ageOverlaps(multi, 70000, 80000), 'lower limit extends upwards');
  assert.equal(ageOf('8030 +/- 70 yr BP - 9497 +/- 92 yr BP').kind, 'range');
  assert.equal(ageOf('4630 ± 35 BP').key, 'b0');
  assert.equal(ageOf('22,500 cal. BP').basis, 'Calibrated BP');
  assert.equal(ageOf('41910 BP').basis, 'BP; calibration not stated');
  assert.equal(ageOf('12000 years').basis, 'Age basis not stated');
});

test('no workbook age with digits is left unparsed except ambiguous grouping', () => {
  for (const r of payload.recs) {
    const d = A.DERIVED.get(r.id).age;
    if (d.kind === 'unparsed') assert.match(d.raw, /\d[,\s]+\d{4,}/, `${r.id}: ${d.raw}`);
    if (r.age[1] !== 'val') assert.equal(d.kind, 'missing', `${r.id}`);
  }
});

test('filters: taxa, provenance, materials, mapping and years', () => {
  const all = payload.recs.filter(r => A.matches(r, A.defaults()));
  assert.equal(all.length, payload.recs.length);
  const s1 = A.defaults(); s1.taxa = new Set(['Mammoth']);
  assert.equal(payload.recs.filter(r => A.matches(r, s1)).length, payload.stats.species.Mammoth);
  const s2 = A.defaults(); s2.provenance = new Set(['source_stated']);
  assert.equal(payload.recs.filter(r => A.matches(r, s2)).length, payload.metadata.provenance_counts['source-stated']);
  const s3 = A.defaults(); s3.mapped = 'unmapped';
  assert.equal(payload.recs.filter(r => A.matches(r, s3)).length, payload.stats.total - payload.stats.mapped);
  const s4 = A.defaults(); s4.materials = new Set(['keratin']);
  assert.ok(payload.recs.filter(r => A.matches(r, s4)).every(r => r.facets.includes('keratin')));
  const s5 = A.defaults(); s5.mode = 'between'; s5.start = 1900; s5.end = 1909;
  assert.ok(payload.recs.filter(r => A.matches(r, s5)).every(r => A.recordYear(r) >= 1900 && A.recordYear(r) <= 1909));
  const s6 = A.defaults(); s6.query = '#84';
  assert.deepEqual(payload.recs.filter(r => A.matches(r, s6)).map(r => r.source_id), [84]);
  const s7 = A.defaults(); s7.query = 'regional placeholder';
  assert.equal(payload.recs.filter(r => A.matches(r, s7)).length, payload.metadata.provenance_counts.regional_placeholder, 'provenance labels are searchable');
  const s8 = A.defaults(); s8.view = 'ages'; s8.ageMode = 'between'; s8.ageStart = 30000; s8.ageEnd = 33000;
  assert.ok(payload.recs.filter(r => A.matches(r, s8)).some(r => r.source_id === 149), 'Bilibino horse (31.700 ± 1.300) sits in the 30–33 ka interval');
});

test('URL state round-trips', () => {
  const s = A.defaults();
  s.taxa = new Set(['Horse', 'Bison']); s.provenance = new Set(['inferred']); s.materials = new Set(['hair']);
  s.query = 'Yana'; s.mapped = 'mapped'; s.age = 'dated'; s.mode = 'between'; s.start = 1800; s.end = 1950; s.view = 'table'; s.projection = 'globe';
  const back = A.parseState('#' + A.stateParams(s));
  assert.deepEqual([...back.taxa], ['Horse', 'Bison']);
  assert.deepEqual([...back.provenance], ['inferred']);
  assert.deepEqual([...back.materials], ['hair']);
  assert.equal(back.query, 'Yana'); assert.equal(back.mapped, 'mapped'); assert.equal(back.age, 'dated');
  assert.equal(back.mode, 'between'); assert.equal(back.start, 1800); assert.equal(back.end, 1950);
  assert.equal(back.view, 'table'); assert.equal(back.projection, 'globe');
  assert.equal(A.parseState('#record=84').selected, '84');
  assert.equal(A.parseState('#taxa=Dragon').taxa.size, 0, 'unknown taxa are dropped');
  assert.equal(A.parseState('#prov=nonsense').provenance.size, 0, 'unknown provenance keys are dropped');
  assert.equal(A.parseState('#to=1700&from=1900').start, 1700, 'inverted years are clamped');
});

test('projection keeps every mapped record inside the flat frame or marks it', () => {
  const g = { w: 1000, h: 470 };
  for (const r of payload.recs.filter(A.hasCoords)) {
    const p = A.projected(r.lat, r.lon, 'flat', g);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.equal(p.visible, r.lat >= 28 && r.lat <= 86);
  }
  const spread = A.spreadPoints([{ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 11, y: 10 }], 12, { w: 500, h: 500 });
  assert.equal(spread.length, 3);
  assert.equal(spread[0].offset, 0);
  assert.ok(spread[1].offset > 0 && spread[2].offset > 0, 'overlapping points are separated on screen');
  assert.equal(spread[1].anchorX, 10, 'anchors keep the coordinate');
});

test('display names fall back to the locality and ids stay stable', () => {
  const noName = payload.recs.find(r => r.common_name[1] !== 'val');
  assert.equal(A.name(noName), noName.location.replace(/_/g, ' ').replace(/\s+/g, ' ').trim());
  assert.equal(A.recordID(payload.recs[0]), String(payload.recs[0].source_id));
});

/* Variant A extras: hero plate, ledger figures, provenance and material bars, specimen plates.
   Reads the embedded payload; drives the atlas engine only through the URL hash. */
(() => {
'use strict';
const P = JSON.parse(document.getElementById('payload').textContent);
const RECS = P.recs, PALETTE = globalThis.__ATLAS_PALETTE__ || {};
const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = s => String(s ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const el = (tag, attrs = {}, text) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PROV_TEXT = {source_stated:'Source-stated',historical_map:'Historical map',inferred_historical_map:'Inferred / historical map',inferred:'Inferred',regional_placeholder:'Regional placeholder',unlocated:'Unlocated',unlabelled:'No provenance label'};
const PROV_STYLE = {source_stated:'solid',historical_map:'derived',inferred_historical_map:'derived',inferred:'derived',regional_placeholder:'placeholder',unlocated:'placeholder',unlabelled:'placeholder'};
const MATERIALS = {skin:'Skin & hide',hair:'Hair, fur & wool',flesh:'Flesh & muscle',organs:'Internal organs',trunk:'Trunk',keratin:'Hoofs, claws, nails & horn',carcass:'Whole / near-whole',softgeneric:'Soft tissue / mummified',connective:'Tendons & ligaments',unclassified:'No material tag assigned'};
const COMPLETE = [['Complete','Complete'],['Mostly_Complete','Mostly complete'],['Partial','Partial'],['Fragments_Only','Fragments only']];
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unlabelled';
const recordYear = r => r.year_found || r.year_collected || r.timeline_year || null;
const name = r => r.common_name && r.common_name[1] === 'val' ? clean(r.common_name[0]) : clean(r.location);
const provSymbol = (style, size = 14, color = '#6f5a4e') => {
  const svg = el('svg', {viewBox:'0 0 20 20', width:size, height:size, 'aria-hidden':'true', class:'prov-swatch'});
  if (style === 'placeholder') svg.append(el('circle', {cx:10, cy:10, r:5, fill:'none', stroke:color, 'stroke-width':1.8}));
  else { svg.append(el('circle', {cx:10, cy:10, r:4.2, fill:color})); if (style === 'derived') svg.append(el('circle', {cx:10, cy:10, r:7.6, fill:'none', stroke:color, 'stroke-width':1.2, 'stroke-dasharray':'2.4 1.7'})); }
  return svg.outerHTML;
};
// Drive the engine through its own URL-hash state. Merging keeps the user's other filters.
function setHash(changes, { reset = false } = {}) {
  const p = reset ? new URLSearchParams() : new URLSearchParams(location.hash.replace(/^#/, ''));
  for (const [k, v] of Object.entries(changes)) { if (v == null) p.delete(k); else p.set(k, v); }
  if (!p.has('view')) p.set('view', 'sites');
  const next = '#' + p.toString();
  if (location.hash === next) return; // no change to apply
  location.hash = next;
}
function scrollTo(id, focus = false) {
  const target = $(id); if (!target) return;
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  if (focus) target.focus({ preventScroll: true });
}

/* ---- Hero plate: the embedded coastline, drawn once as a backdrop ---- */
(function heroPlate() {
  const land = $('land'), path = $('heroLand'), grat = $('heroGrat'), svg = $('heroPlate');
  if (!land || !path) return;
  path.setAttribute('d', land.textContent);
  for (let lat = 30; lat <= 80; lat += 10) { const y = (86 - lat) / 58 * 486; grat.append(el('line', {x1:0, y1:y, x2:1440, y2:y})); }
  for (let lon = -180; lon <= 180; lon += 30) { const x = (lon + 180) / 360 * 1440; grat.append(el('line', {x1:x, y1:0, x2:x, y2:486})); }
  requestAnimationFrame(() => svg.classList.add('ready'));
})();

/* ---- Ledger figures that have no build placeholder ---- */
(function stats() {
  const counts = P.metadata.provenance_counts || {};
  document.querySelectorAll('[data-stat="source-stated"]').forEach(n => n.textContent = counts['source-stated'] ?? 0);
})();

/* ---- In-page navigation without touching the engine's hash state ---- */
document.querySelectorAll('[data-scroll]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); scrollTo(a.dataset.scroll, a.classList.contains('skip')); }));

/* ---- Chart tooltip ---- */
const tip = $('chartTip');
function showTip(host, event, html) {
  tip.innerHTML = html; tip.hidden = false;
  const rect = host.getBoundingClientRect(), w = tip.offsetWidth || 200, h = tip.offsetHeight || 60;
  let x = event.clientX - rect.left + 14, y = event.clientY - rect.top - h - 12;
  if (x + w > rect.width - 4) x = event.clientX - rect.left - w - 14;
  if (y < 0) y = event.clientY - rect.top + 16;
  tip.style.left = Math.max(0, x) + 'px'; tip.style.top = y + 'px';
  host.append(tip);
}
const hideTip = () => { tip.hidden = true; };

/* ---- Finds by decade ---- */
(function decadeChart() {
  const host = $('decadeChart'); if (!host) return;
  const years = RECS.map(recordYear).filter(Number.isFinite);
  const first = Math.floor(Math.min(...years) / 10) * 10, last = Math.floor(Math.max(...years) / 10) * 10;
  const bins = []; for (let d = first; d <= last; d += 10) bins.push({ d, n: years.filter(y => y >= d && y < d + 10).length });
  const max = Math.max(...bins.map(b => b.n)), step = max > 12 ? 5 : max > 6 ? 2 : 1, top = Math.ceil(max / step) * step;
  const ranked = [...bins].sort((a, b) => b.n - a.n).slice(0, 3).map(b => b.d);
  const hashFor = b => ({ view: 'sites', from: Math.max(P.timeline.min, b.d), to: Math.min(P.timeline.max, b.d + 9) });
  let drawnWidth = 0;
  // Drawn at the container's pixel width so type stays legible at phone width; redrawn on resize.
  function draw() {
  const W = Math.max(300, Math.round(host.clientWidth || 960)); if (W === drawnWidth) return; drawnWidth = W;
  const H = Math.round(Math.max(190, Math.min(260, W * .26))), m = { l: 34, r: 8, t: 26, b: 30 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const bw = pw / bins.length, gap = bw > 8 ? 2 : 1, every = bw >= 16 ? 50 : 100, x = i => m.l + i * bw, y = n => m.t + ph - n / top * ph;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Recorded finds per decade from ${first}s to ${last}s; the tallest decade has ${max} records.` });
  for (let n = 0; n <= top; n += step) {
    svg.append(el('line', { x1: m.l, x2: W - m.r, y1: y(n), y2: y(n), class: n === 0 ? 'axis' : 'grid' }));
    svg.append(el('text', { x: m.l - 8, y: y(n) + 4, 'text-anchor': 'end', class: 'tick' }, n));
  }
  bins.forEach((b, i) => { if (b.d % every === 0) svg.append(el('text', { x: x(i) + bw / 2, y: H - 8, 'text-anchor': 'middle', class: 'tick' }, b.d)); });
  bins.forEach((b, i) => {
    if (!b.n) return;
    const g = el('g', { tabindex: 0, role: 'button', 'aria-label': `${b.d}s: ${b.n} record${b.n === 1 ? '' : 's'}. Filter the atlas to this decade.` });
    const x0 = x(i) + gap / 2, x1 = x(i) + bw - gap / 2, y0 = y(b.n), y1 = y(0), r = Math.min(4, (x1 - x0) / 2, y1 - y0);
    g.append(el('path', { d: `M${x0},${y1}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x1 - r}Q${x1},${y0} ${x1},${y0 + r}V${y1}Z`, class: 'bar' }));
    if (ranked.includes(b.d)) svg.append(el('text', { x: (x0 + x1) / 2, y: y0 - 7, 'text-anchor': 'middle', class: 'label' }, b.n));
    const html = `<b>${b.d}s</b><br>${b.n} record${b.n === 1 ? '' : 's'} · select to filter the atlas`;
    g.addEventListener('pointerenter', e => showTip(host, e, html)); g.addEventListener('pointermove', e => showTip(host, e, html)); g.addEventListener('pointerleave', hideTip);
    const go = () => { hideTip(); setHash(hashFor(b)); scrollTo('workspace'); };
    g.addEventListener('click', go); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    svg.append(g);
  });
  host.replaceChildren(svg);
  }
  draw();
  let timer = null; window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(draw, 120); });
  const cumulative = year => years.filter(v => v <= year).length;
  const busiest = bins.find(b => b.d === ranked[0]);
  const caption = $('decadeCaption');
  if (caption) caption.innerHTML = `By 1800, <b>${cumulative(1800)}</b> finds were on record; by 1900, <b>${cumulative(1900)}</b>; by 1950, <b>${cumulative(1950)}</b>; by 2000, <b>${cumulative(2000)}</b>; by ${P.timeline.max}, <b>${cumulative(P.timeline.max)}</b>. The busiest decade in the workbook is the ${busiest.d}s with ${busiest.n} records.`;
})();

/* ---- Horizontal bar lists ---- */
function barList(host, rows, { clickable = true, symbol = null } = {}) {
  if (!host) return;
  const max = Math.max(...rows.map(r => r.n), 1);
  host.replaceChildren(...rows.map(r => {
    const li = document.createElement('li');
    const row = document.createElement(clickable && r.go ? 'button' : 'div'); row.className = 'row'; if (row.tagName === 'BUTTON') { row.type = 'button'; row.setAttribute('aria-label', `${r.label}: ${r.n} record${r.n === 1 ? '' : 's'}. ${r.hint || 'Filter the atlas.'}`); }
    row.innerHTML = `<span class="name">${symbol ? symbol(r) : ''}<span>${esc(r.label)}</span></span><span class="track" aria-hidden="true"><span class="fill${r.alt ? ' alt' : ''}" style="width:${(r.n / max * 100).toFixed(1)}%"></span></span><span class="n">${r.n}</span>`;
    if (row.tagName === 'BUTTON') row.addEventListener('click', r.go);
    li.append(row); return li;
  }));
}
(function provenanceBars() {
  const counts = P.metadata.provenance_counts || {};
  const rows = Object.entries(counts).map(([label, n]) => { const key = slug(label); return { key, label: PROV_TEXT[key] || clean(label), n, style: PROV_STYLE[key] || 'placeholder', hint: 'Show only these records on the map.', go: () => { setHash({ view: 'sites', prov: key }); scrollTo('workspace'); } }; });
  barList($('provenanceBars'), rows, { symbol: r => provSymbol(r.style) });
})();
(function completenessBars() {
  const rows = COMPLETE.map(([key, label]) => ({ key, label, n: RECS.filter(r => (r.complete && r.complete[0]) === key).length }));
  barList($('completenessBars'), rows, { clickable: false });
})();
(function materialBars() {
  const counts = {}; for (const r of RECS) for (const f of r.facets || []) counts[f] = (counts[f] || 0) + 1;
  const rows = Object.entries(counts).filter(([k]) => k !== 'unclassified').sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, label: MATERIALS[key] || key, n, hint: 'Show records with this material tag.', go: () => { setHash({ view: 'sites', material: key }); scrollTo('workspace'); } }));
  barList($('materialBars'), rows);
})();

/* ---- Specimen plates: every record whose Complete? field reads Complete ---- */
(function plates() {
  const host = $('plateGrid'); if (!host) return;
  const rows = RECS.filter(r => r.grade === 4).sort((a, b) => (recordYear(a) || 0) - (recordYear(b) || 0) || a.source_row - b.source_row);
  const caption = $('platesCaption'); if (caption) caption.textContent = `${rows.length} records whose Complete? field reads Complete, in order of discovery. Select a plate to open the full record.`;
  host.replaceChildren(...rows.map(r => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'plate'; b.setAttribute('aria-label', `Open the record for ${name(r)}, ${r.species}, ${clean(r.location)}, ${recordYear(r) || 'year not recorded'}`);
    const provKey = r.coordinate_key || 'unlabelled', provLabel = PROV_TEXT[provKey] || clean(r.coordinate_label || 'No label'), year = recordYear(r), yearNote = year && !r.year_found ? ' (collection)' : '';
    const age = r.age && r.age[1] === 'val' ? esc(r.age[0]) : '<span class="missing">not recorded</span>';
    const coord = Number.isFinite(r.lat) && Number.isFinite(r.lon) ? `${r.lat}, ${r.lon}` : 'not recorded';
    b.innerHTML = `<div class="plate-head"><span>No. ${esc(r.source_id)}</span><span class="taxon"><i style="background:${esc(PALETTE[r.species] || '#999')}"></i>${esc(r.species)}</span></div>
      <div><h3>${esc(name(r))}</h3><p class="binomial">${esc(r.binomial || '')}</p></div>
      <dl><div><dt>Locality</dt><dd>${esc(clean(r.location))}</dd></div><div><dt>Found</dt><dd class="mono">${year ? year + yearNote : 'not recorded'}</dd></div><div><dt>Coordinate</dt><dd class="mono">${esc(coord)}</dd></div><div><dt>Position</dt><dd><span class="prov">${provSymbol(PROV_STYLE[provKey] || 'placeholder', 12)}${esc(provLabel)}</span></dd></div><div><dt>Age as recorded</dt><dd>${age}</dd></div></dl>`;
    b.addEventListener('click', () => { setHash({ view: 'sites', record: r.id }, { reset: true }); scrollTo('workspace'); });
    return b;
  }));
})();
})();

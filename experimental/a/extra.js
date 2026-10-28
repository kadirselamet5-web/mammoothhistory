/* Variant A extras: hero plate, ledger figures, provenance and material bars, specimen plates.
   Reads the embedded payload; drives the atlas engine only through the URL hash. */
(() => {
'use strict';
const P = JSON.parse(document.getElementById('payload').textContent);
const RECS = P.recs, TOTAL = RECS.length, PALETTE = globalThis.__ATLAS_PALETTE__ || {};
const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = s => String(s ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const el = (tag, attrs = {}, text) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PROV_TEXT = {source_stated:'Source-stated',historical_map:'Historical map',inferred_historical_map:'Inferred / historical map',inferred:'Inferred',regional_placeholder:'Regional placeholder',unlocated:'Unlocated',unlabelled:'No provenance label'};
const PROV_STYLE = {source_stated:'solid',historical_map:'derived',inferred_historical_map:'derived',inferred:'derived',regional_placeholder:'placeholder',unlocated:'placeholder',unlabelled:'placeholder'};
// Figure labels: the engine's material names, shortened where they would wrap in a half-width list.
const MATERIALS = {skin:'Skin & hide',hair:'Hair, fur & wool',flesh:'Flesh & muscle',organs:'Internal organs',trunk:'Trunk',keratin:'Hoofs, claws & horn',carcass:'Whole / near-whole',softgeneric:'Soft tissue',connective:'Tendons & ligaments'};
const COMPLETE = [['Complete','Complete'],['Mostly_Complete','Mostly complete'],['Partial','Partial'],['Fragments_Only','Fragments only']];
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unlabelled';
const recordYear = r => r.year_found || r.year_collected || r.timeline_year || null;
const name = r => r.common_name && r.common_name[1] === 'val' ? clean(r.common_name[0]) : clean(r.location);
const plural = n => n === 1 ? 'record' : 'records';
const pct = n => Math.round(n / TOTAL * 100) + '%';
const provSymbol = (style, size = 14, color = '#6f5a4e') => {
  const svg = el('svg', {viewBox:'0 0 20 20', width:size, height:size, 'aria-hidden':'true', class:'prov-swatch'});
  if (style === 'placeholder') svg.append(el('circle', {cx:10, cy:10, r:5, fill:'none', stroke:color, 'stroke-width':1.8}));
  else { svg.append(el('circle', {cx:10, cy:10, r:4.2, fill:color})); if (style === 'derived') svg.append(el('circle', {cx:10, cy:10, r:7.6, fill:'none', stroke:color, 'stroke-width':1.2, 'stroke-dasharray':'2.4 1.7'})); }
  return svg.outerHTML;
};

/* ---- Hash state. The engine owns the hash; these helpers only read it and write it back. ---- */
const readHash = () => new URLSearchParams(location.hash.replace(/^#/, ''));
function writeHash(p) { if (!p.has('view')) p.set('view', 'sites'); const next = '#' + p.toString(); if (location.hash !== next) location.hash = next; }
function setHash(changes, { reset = false } = {}) {
  const p = reset ? new URLSearchParams() : readHash();
  for (const [k, v] of Object.entries(changes)) { if (v == null) p.delete(k); else p.set(k, v); }
  writeHash(p);
}
const listIn = (p, key) => p.has(key) ? p.get(key).split(',').filter(Boolean) : null;
// Toggle one value inside a comma list, like the rail's multi-select. An absent key means no
// explicit selection; an empty list, or one naming every class, is written back as absent.
function toggleIn(key, value, total) {
  const p = readHash(); let list = listIn(p, key) || [];
  list = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  if (!list.length || (total && list.length >= total)) p.delete(key); else p.set(key, list.join(','));
  writeHash(p);
}
function scrollTo(id, focus = false) {
  const target = $(id); if (!target) return;
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  if (focus) target.focus({ preventScroll: true });
}
// In-page navigation scrolls without touching the engine's hash state.
document.addEventListener('click', e => { const a = e.target.closest('[data-scroll]'); if (!a) return; e.preventDefault(); scrollTo(a.dataset.scroll, a.classList.contains('skip')); });

/* ---- Skip the marker tab stops: jump from the map heading to the visible chronology panel ---- */
(function skipPoints() {
  const link = $('skipPoints'); if (!link) return;
  link.addEventListener('click', e => {
    e.preventDefault();
    const target = [$('discoveryChronology'), $('specimenChronology')].find(n => n && !n.hidden) || $('legend');
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
    target.focus({ preventScroll: true });
  });
})();

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

/* ---- Shared tooltip for the figures ---- */
const tip = $('chartTip');
function showTipAt(host, cx, cy, html) {
  tip.innerHTML = html; tip.hidden = false; host.append(tip);
  const rect = host.getBoundingClientRect(), w = tip.offsetWidth || 200, h = tip.offsetHeight || 60;
  let x = cx - rect.left + 14, y = cy - rect.top - h - 12;
  if (x + w > rect.width - 4) x = Math.max(0, cx - rect.left - w - 14);
  if (y < 0) y = cy - rect.top + 16;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
const hideTip = () => { tip.hidden = true; };
function tipEvents(node, host, html, anchor) {
  node.addEventListener('pointerenter', e => showTipAt(host, e.clientX, e.clientY, html()));
  node.addEventListener('pointermove', e => showTipAt(host, e.clientX, e.clientY, html()));
  node.addEventListener('pointerleave', hideTip);
  node.addEventListener('focus', () => { const r = (anchor || node).getBoundingClientRect(); showTipAt(host, r.left + r.width / 2, r.top, html()); });
  node.addEventListener('blur', hideTip);
}

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
      const g = el('g', { tabindex: 0, role: 'button', 'aria-label': `${b.d}s: ${b.n} ${plural(b.n)}. Filter the atlas to this decade.` });
      // The whole decade band, full plot height, is the hit target; the visible bar is at most 24px wide.
      const vis = Math.min(24, bw - gap), x0 = x(i) + (bw - vis) / 2, x1 = x0 + vis, y0 = y(b.n), y1 = y(0), r = Math.min(4, vis / 2, y1 - y0);
      g.append(el('rect', { x: x(i), y: m.t, width: bw, height: ph, class: 'hit' }));
      g.append(el('path', { d: `M${x0},${y1}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x1 - r}Q${x1},${y0} ${x1},${y0 + r}V${y1}Z`, class: 'bar' }));
      if (ranked.includes(b.d)) svg.append(el('text', { x: (x0 + x1) / 2, y: y0 - 7, 'text-anchor': 'middle', class: 'label' }, b.n));
      tipEvents(g, host, () => `<b>${b.d}s</b><br>${b.n} ${plural(b.n)} · ${pct(b.n)} of the ledger<br>Select to filter the atlas`);
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
  if (caption) caption.innerHTML = `By 1800, <b>${cumulative(1800)}</b> finds were on record; by 1900, <b>${cumulative(1900)}</b>; by 1950, <b>${cumulative(1950)}</b>; by 2000, <b>${cumulative(2000)}</b>; by ${P.timeline.max}, <b>${cumulative(P.timeline.max)}</b>. The busiest decade in the workbook is the ${busiest.d}s with ${busiest.n} records. Select a bar to filter the atlas to that decade.`;
})();

/* ---- Horizontal bar lists; the clickable ones toggle a key in the engine's hash lists ---- */
function barList(host, rows, { symbol = null } = {}) {
  if (!host) return;
  const max = Math.max(...rows.map(r => r.n), 1), figure = host.closest('.figure') || host;
  host.replaceChildren(...rows.map(r => {
    const li = document.createElement('li');
    const row = document.createElement(r.toggle ? 'button' : 'div'); row.className = 'row';
    if (r.toggle) {
      row.type = 'button'; row.dataset.key = r.toggle.key; row.dataset.value = r.toggle.value; row.setAttribute('aria-pressed', 'false');
      row.setAttribute('aria-label', `${r.label}: ${r.n} of ${TOTAL} ${plural(r.n)}. ${r.hint}`);
      row.addEventListener('click', () => toggleIn(r.toggle.key, r.toggle.value, r.toggle.total));
    }
    row.innerHTML = `<span class="name">${symbol ? symbol(r) : ''}<span>${esc(r.label)}</span></span><span class="track" aria-hidden="true"><span class="fill" style="width:${(r.n / max * 100).toFixed(1)}%"></span></span><span class="n">${r.n}</span>`;
    tipEvents(row, figure, () => `<b>${esc(r.label)}</b><br>${r.n} of ${TOTAL} ${plural(r.n)} · ${pct(r.n)}${r.toggle ? (row.classList.contains('active') ? '<br>On the map · select to remove' : '<br>Select to show on the map') : ''}`, row.querySelector('.track'));
    li.append(row); return li;
  }));
}
(function provenanceBars() {
  const counts = P.metadata.provenance_counts || {}, total = Object.keys(counts).length;
  const rows = Object.entries(counts).map(([label, n]) => { const key = slug(label); return { key, label: PROV_TEXT[key] || clean(label), n, style: PROV_STYLE[key] || 'placeholder', hint: 'Toggle this class on the map.', toggle: { key: 'prov', value: key, total } }; });
  barList($('provenanceBars'), rows, { symbol: r => provSymbol(r.style) });
})();
(function completenessBars() {
  const rows = COMPLETE.map(([key, label]) => ({ key, label, n: RECS.filter(r => (r.complete && r.complete[0]) === key).length }));
  barList($('completenessBars'), rows);
})();
(function materialBars() {
  const counts = {}; for (const r of RECS) for (const f of r.facets || []) counts[f] = (counts[f] || 0) + 1;
  const rows = Object.entries(counts).filter(([k]) => k !== 'unclassified').sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, label: MATERIALS[key] || key, n, hint: 'Toggle this material on the map.', toggle: { key: 'material', value: key } }));
  barList($('materialBars'), rows);
})();

/* ---- Active states and status lines follow the engine's state (hash) ---- */
const STATUS = [
  { id: 'provenanceStatus', key: 'prov', label: k => PROV_TEXT[k] || k, text: list => `Map shows ${list}.` },
  { id: 'materialStatus', key: 'material', label: k => MATERIALS[k] || k, text: list => `Map shows records with ${list}.` },
];
function syncActive() {
  const p = readHash();
  document.querySelectorAll('.bar-list .row[data-key]').forEach(row => {
    const on = (listIn(p, row.dataset.key) || []).includes(row.dataset.value);
    row.classList.toggle('active', on); row.setAttribute('aria-pressed', String(on));
  });
  for (const s of STATUS) {
    const node = $(s.id); if (!node) continue;
    const list = listIn(p, s.key) || [];
    if (!list.length) { node.hidden = true; node.textContent = ''; continue; }
    node.innerHTML = `${esc(s.text(list.map(s.label).join(', ')))} <a href="#workspace" data-scroll="workspace">Show the map</a>`; node.hidden = false;
  }
}
window.addEventListener('hashchange', syncActive);
// The engine rewrites the hash with replaceState (no hashchange), but it re-renders the chips and
// the result count on every change, so those nodes are the signal.
const observer = new MutationObserver(syncActive);
for (const id of ['activeFilters', 'resultCount']) { const n = $(id); if (n) observer.observe(n, { childList: true, subtree: true, characterData: true }); }
syncActive();

/* ---- Specimen plates: every record whose Complete? field reads Complete; four shown, the rest on request ---- */
(function plates() {
  const host = $('plateGrid'), toggle = $('platesToggle'); if (!host) return;
  const SHOWN = 4;
  const rows = RECS.filter(r => r.grade === 4).sort((a, b) => (recordYear(a) || 0) - (recordYear(b) || 0) || a.source_row - b.source_row);
  const caption = $('platesCaption'); if (caption) caption.textContent = `${rows.length} records whose Complete? field reads Complete, in order of discovery. Select a plate to open the full record.`;
  const cards = rows.map((r, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'plate'; b.setAttribute('aria-label', `Open the record for ${name(r)}, ${r.species}, ${clean(r.location)}, ${recordYear(r) || 'year not recorded'}`);
    const provKey = r.coordinate_key || 'unlabelled', provLabel = PROV_TEXT[provKey] || clean(r.coordinate_label || 'No label'), year = recordYear(r), yearNote = year && !r.year_found ? ' (collection)' : '';
    const age = r.age && r.age[1] === 'val' ? esc(r.age[0]) : '<span class="missing">not recorded</span>';
    const coord = Number.isFinite(r.lat) && Number.isFinite(r.lon) ? `${r.lat}, ${r.lon}` : 'not recorded';
    b.innerHTML = `<div class="plate-head"><span>No. ${esc(r.source_id)}</span><span class="taxon"><i style="background:${esc(PALETTE[r.species] || '#999')}"></i>${esc(r.species)}</span></div>
      <div><h3>${esc(name(r))}</h3><p class="binomial">${esc(r.binomial || '')}</p></div>
      <dl><div><dt>Locality</dt><dd>${esc(clean(r.location))}</dd></div><div><dt>Found</dt><dd class="mono">${year ? year + yearNote : 'not recorded'}</dd></div><div><dt>Coordinate</dt><dd class="mono">${esc(coord)}</dd></div><div><dt>Position</dt><dd><span class="prov">${provSymbol(PROV_STYLE[provKey] || 'placeholder', 12)}${esc(provLabel)}</span></dd></div><div><dt>Age as recorded</dt><dd>${age}</dd></div></dl>`;
    b.addEventListener('click', () => { setHash({ view: 'sites', record: r.id }, { reset: true }); scrollTo('workspace'); });
    if (i >= SHOWN) b.hidden = true;
    return b;
  });
  host.replaceChildren(...cards);
  if (!toggle) return;
  if (rows.length <= SHOWN) { toggle.hidden = true; return; }
  const label = open => open ? 'Show fewer' : `Show all ${rows.length} plates`;
  toggle.textContent = label(false);
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    cards.forEach((c, i) => { c.hidden = !open && i >= SHOWN; });
    toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = label(open);
    if (!open) $('plates').scrollIntoView({ behavior: 'auto', block: 'start' });
  });
})();
})();

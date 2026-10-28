/* Variant B extras: the catalogue summary charts, the accessions ledger and the in-page skip links.
   Everything reads the embedded payload and drives the engine through the URL hash, which the engine
   already treats as its state; in-page links never write the hash, so filters are not lost. */
(() => {
'use strict';
const payload = JSON.parse(document.getElementById('payload').textContent);
const RECS = payload.recs;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = s => String(s ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const PALETTE = globalThis.__ATLAS_PALETTE__ || {};
const MATERIALS = {skin:'Skin & hide',hair:'Hair, fur & wool',flesh:'Flesh & muscle',organs:'Internal organs',trunk:'Trunk',keratin:'Hoofs, claws, nails & horn',carcass:'Whole / near-whole',softgeneric:'Soft tissue / mummified',connective:'Tendons & ligaments',unclassified:'No material tag assigned'};
const MATERIAL_SHORT = {keratin:'Hoofs, claws, horn',softgeneric:'Soft tissue',unclassified:'No material tag'};
const PROV_TEXT = {source_stated:'Source-stated',historical_map:'Historical map',inferred_historical_map:'Inferred / historical map',inferred:'Inferred',regional_placeholder:'Regional placeholder',unlocated:'Unlocated',unlabelled:'No provenance label'};
const PROV_SHORT = {inferred_historical_map:'Inferred / hist. map'};
const PROV_STYLE = {source_stated:'solid',historical_map:'derived',inferred_historical_map:'derived',inferred:'derived',regional_placeholder:'placeholder',unlocated:'placeholder',unlabelled:'placeholder'};
const GRADE_TEXT = {4:'Complete',3:'Mostly complete',2:'Partial',1:'Fragments only',0:'Not recorded'};
const MAPPED_TEXT = {mapped:'Coordinates recorded',unmapped:'No coordinates recorded'};
const year = r => r.year_found || r.year_collected || r.timeline_year || null;
const name = r => (r.common_name && r.common_name[1] === 'val') ? clean(r.common_name[0]) : clean(r.location);
const recordID = r => String(r.source_id) + (r.duplicate_source_id ? ' · row ' + r.source_row : '');
const provKey = r => r.coordinate_key || 'unlabelled';
const isMapped = r => Number.isFinite(r.lat) && Number.isFinite(r.lon);
const count = (list, fn) => { const m = new Map(); for (const r of list) { const k = fn(r); if (k == null) continue; m.set(k, (m.get(k) || 0) + 1); } return m; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Drive the engine: merge into the current hash state (the engine re-parses it on hashchange).
function go(params, { merge = true, scrollTo = 'workspace' } = {}) {
  const p = new URLSearchParams(merge ? location.hash.replace(/^#/, '') : '');
  for (const [k, v] of Object.entries(params)) { if (v == null) p.delete(k); else p.set(k, v); }
  if (!p.get('view')) p.set('view', 'sites');
  if (!p.get('projection')) p.set('projection', 'flat');
  const next = '#' + p.toString();
  if (next === location.hash) { window.dispatchEvent(new HashChangeEvent('hashchange')); } else location.hash = next;
  const target = scrollTo && $(scrollTo);
  if (target) target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
}

// In-page links: move focus without touching the hash (the engine reads the hash as filter state).
function jumpTo(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
}
function skipLink(link, resolve) {
  if (!link) return;
  link.addEventListener('click', e => { e.preventDefault(); jumpTo(resolve()); });
}

function provSymbol(style, size = 13, color = '#6f5a4e') {
  if (style === 'placeholder') return `<svg class="prov-swatch" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true"><circle cx="10" cy="10" r="5" fill="none" stroke="${color}" stroke-width="1.8"/></svg>`;
  return `<svg class="prov-swatch" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true"><circle cx="10" cy="10" r="4.2" fill="${color}"/>${style === 'derived' ? `<circle cx="10" cy="10" r="7.6" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="2.4 1.7"/>` : ''}</svg>`;
}
function taxonSwatch(taxon, size = 13) {
  return `<svg class="taxon-symbol" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true"><circle cx="10" cy="10" r="6.2" fill="${esc(PALETTE[taxon] || '#b0a89f')}" stroke="#6e665f" stroke-width=".8"/></svg>`;
}

// One tooltip for every chart; shown on hover and keyboard focus, placed below the element unless
// there is no room, 8 px clear of it so it never covers the element's own label or value.
let tip = null;
function showTip(el, html) {
  if (!tip) { tip = document.createElement('div'); tip.className = 'viz-tip'; tip.setAttribute('role', 'tooltip'); document.body.append(tip); }
  tip.innerHTML = html; tip.hidden = false;
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
  if (y + h > innerHeight - 8) y = r.top - h - 8;
  x = Math.max(8, Math.min(innerWidth - w - 8, x));
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function hideTip() { if (tip) tip.hidden = true; }
function attachTip(container) {
  container.addEventListener('pointerenter', e => { const t = e.target.closest('[data-tip]'); if (t) showTip(t, t.dataset.tip); }, true);
  container.addEventListener('pointerleave', e => { if (e.target.closest && e.target.closest('[data-tip]')) hideTip(); }, true);
  container.addEventListener('focusin', e => { const t = e.target.closest('[data-tip]'); if (t) showTip(t, t.dataset.tip); });
  container.addEventListener('focusout', hideTip);
  addEventListener('scroll', hideTip, { passive: true });
}

function decadesChart() {
  const years = RECS.map(year).filter(Number.isFinite);
  const first = Math.floor(Math.min(...years) / 10) * 10, last = Math.floor(Math.max(...years) / 10) * 10;
  const bins = []; for (let d = first; d <= last; d += 10) bins.push({ d, n: RECS.filter(r => year(r) >= d && year(r) < d + 10).length });
  const max = Math.max(...bins.map(b => b.n)), step = max > 12 ? 5 : max > 6 ? 4 : 2, top = Math.ceil(max / step) * step;
  const busiest = bins.filter(b => b.n === max).map(b => b.d);
  const grid = []; for (let v = 0; v <= top; v += step) grid.push(`<div style="bottom:${(v / top * 100).toFixed(2)}%"><span>${v}</span></div>`);
  // Each decade is a full-height band (the hit target); the visible bar sits centred inside it.
  const bands = bins.map(b => {
    const pct = (b.n / top * 100).toFixed(2), label = `${b.d}s`;
    if (!b.n) return `<span class="decade-band" aria-hidden="true"></span>`;
    const text = `<b>${label}</b><br>${b.n} find${b.n === 1 ? '' : 's'} recorded<br>Select to filter the map`;
    return `<button class="decade-band" data-decade="${b.d}" data-tip="${esc(text)}" aria-label="${label}: ${b.n} finds. Filter the map to this decade."><span class="decade-bar" style="--h:${pct}">${busiest.includes(b.d) ? `<span class="decade-count">${b.n}</span>` : ''}</span></button>`;
  }).join('');
  const span = last + 10 - first, axis = [];
  for (let y = Math.ceil(first / 50) * 50; y <= last + 10; y += 50) axis.push(`<span style="left:${((y - first) / span * 100).toFixed(2)}%">${y}</span>`);
  const totalYears = `${Math.min(...years)}–${Math.max(...years)}`;
  return `<section class="chart decades" aria-labelledby="chartDecades"><h3 id="chartDecades">Finds recorded per decade</h3><p class="chart-sub">${years.length} records with a discovery or collection year, ${totalYears} · busiest decade: ${busiest.map(d => d + 's').join(', ')} (${max})</p><div class="decades-plot" role="group" aria-label="Finds per decade, ${first}s to ${last}s"><div class="decade-grid" aria-hidden="true">${grid.join('')}</div><div class="decade-track">${bands}</div><div class="decade-axis" aria-hidden="true">${axis.join('')}</div></div></section>`;
}

function barList({ id, title, sub, rows, total, param, labelFor, shortFor, swatchFor, colorFor, extraClass = '', after = '' }) {
  const max = Math.max(...rows.map(r => r.n), 1);
  const items = rows.map(r => {
    const full = labelFor(r.key), short = (shortFor && shortFor(r.key)) || full;
    const pct = (r.n / max * 100).toFixed(1), share = (r.n / total * 100).toFixed(0);
    const tipText = `<b>${esc(full)}</b><br>${r.n} of ${total} records (${share}%)${param ? '<br>Select to filter the map' : ''}`;
    const inner = `<span class="bar-label">${swatchFor ? swatchFor(r.key) : ''}<span${short !== full ? ` title="${esc(full)}"` : ''}>${esc(short)}</span></span><span class="bar-track"><span class="bar-fill" style="width:${pct}%${colorFor ? ';background:' + colorFor(r.key) : ''}"></span></span><span class="bar-value">${r.n}</span>`;
    return param ? `<li><button class="bar-row" data-param="${param}" data-key="${esc(r.key)}" data-tip="${esc(tipText)}" aria-label="${esc(full)}: ${r.n} of ${total} records. Filter the map.">${inner}</button></li>` : `<li><span class="bar-row" data-tip="${esc(tipText)}">${inner}</span></li>`;
  }).join('');
  return `<section class="chart ${extraClass}" aria-labelledby="${id}"><h3 id="${id}">${esc(title)}</h3><p class="chart-sub">${esc(sub)}</p><ul class="bar-list">${items}</ul>${after}</section>`;
}

function renderSummary() {
  const host = $('summaryCharts'); if (!host) return;
  const total = RECS.length;
  const taxa = count(RECS, r => r.species);
  const taxonRows = Object.keys(payload.species).map(k => ({ key: k, n: taxa.get(k) || 0 }));
  const prov = count(RECS, provKey);
  const provOrder = Object.keys(payload.metadata.provenance_counts || {}).map(k => k.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unlabelled');
  const provRows = [...new Set([...provOrder, ...prov.keys()])].filter(k => prov.has(k)).map(k => ({ key: k, n: prov.get(k) }));
  const mapped = count(RECS, r => isMapped(r) ? 'mapped' : 'unmapped');
  const mappedRows = ['mapped', 'unmapped'].filter(k => mapped.has(k)).map(k => ({ key: k, n: mapped.get(k) }));
  const grades = count(RECS, r => r.grade);
  const gradeRows = [4, 3, 2, 1, 0].filter(g => grades.has(g)).map(g => ({ key: g, n: grades.get(g) }));
  const mats = count(RECS.flatMap(r => r.facets.map(f => ({ f }))), x => x.f);
  const matRows = Object.keys(MATERIALS).filter(k => mats.has(k)).map(k => ({ key: k, n: mats.get(k) })).sort((a, b) => b.n - a.n);
  const taxonChart = barList({ id: 'chartTaxa', title: 'Taxon groups', sub: `${total} records · Species_type column`, rows: taxonRows, total, param: 'taxa', labelFor: k => k, swatchFor: k => taxonSwatch(k), colorFor: k => PALETTE[k] || '#b0a89f' });
  const gradeChart = barList({ id: 'chartGrade', title: 'Completeness', sub: 'Complete? column, as recorded', rows: gradeRows, total, param: null, labelFor: k => GRADE_TEXT[k] });
  const provChart = barList({ id: 'chartProv', title: 'Coordinate provenance', sub: `${total} records · Location Provenance column`, rows: provRows, total, param: 'prov', labelFor: k => PROV_TEXT[k] || clean(k), shortFor: k => PROV_SHORT[k], swatchFor: k => provSymbol(PROV_STYLE[k] || 'placeholder'), after: '<p class="chart-key">Solid point: source-stated coordinate. Dashed ring: inferred or historical-map position. Hollow point: regional placeholder or unlocated find.</p>' });
  const mappedChart = barList({ id: 'chartMapped', title: 'Map position', sub: 'Latitude and Longitude cells', rows: mappedRows, total, param: 'mapped', labelFor: k => MAPPED_TEXT[k] });
  const matChart = barList({ id: 'chartMaterial', title: 'Preserved material', sub: 'Tags derived from Parts_found · a record can carry several', rows: matRows, total, param: 'material', labelFor: k => MATERIALS[k], shortFor: k => MATERIAL_SHORT[k], extraClass: 'material' });
  host.innerHTML = decadesChart()
    + `<div class="chart-stack">${taxonChart}${gradeChart}</div>`
    + `<div class="chart-stack">${provChart}${mappedChart}</div>`
    + matChart;
  attachTip(host);
  host.addEventListener('click', e => {
    const band = e.target.closest('.decade-band[data-decade]');
    if (band) { const d = +band.dataset.decade; go({ view: 'sites', from: String(d), to: String(d + 9), ageFrom: null, ageTo: null }); return; }
    const row = e.target.closest('.bar-row[data-param]');
    if (!row) return;
    const { param, key } = row.dataset;
    if (param === 'material') {
      const p = new URLSearchParams(location.hash.replace(/^#/, ''));
      const current = (p.get('material') || '').split(',').filter(Boolean);
      const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
      go({ material: next.length ? next.join(',') : null });
    } else go({ [param]: key });
  });
}

function renderLedger() {
  const host = $('ledger'); if (!host) return;
  const rows = [...RECS].sort((a, b) => (year(a) || 9999) - (year(b) || 9999) || a.source_row - b.source_row);
  let century = null, html = '<table class="ledger"><thead><tr><th scope="col">Year</th><th scope="col">No.</th><th scope="col">Specimen</th><th scope="col">Taxon</th><th scope="col">Discovery site</th><th scope="col">Position</th></tr></thead><tbody>';
  for (const r of rows) {
    const y = year(r), c = y ? Math.floor(y / 100) * 100 : null;
    if (c !== century) { century = c; html += `<tr class="century"><th scope="rowgroup" colspan="6">${c == null ? 'Year not recorded' : c + 's'}</th></tr>`; }
    const collected = !r.year_found && r.year_collected;
    html += `<tr data-record="${esc(r.id)}"><td class="year${collected ? ' collected' : ''}">${y ? (collected ? '[' + y + ']' : y) : '—'}</td><td class="no">#${esc(recordID(r))}</td><td class="spec"><button class="record-link" data-open="${esc(r.id)}" aria-label="Open ${esc(name(r))}, record ${esc(recordID(r))}">${esc(name(r))}</button>${r.binomial ? `<span class="binomial">${esc(r.binomial)}</span>` : ''}</td><td class="taxon"><span class="taxon-cell">${taxonSwatch(r.species)}${esc(r.species)}</span></td><td class="site">${esc(clean(r.location) || 'Not recorded')}</td><td class="pos"><span class="prov-cell">${provSymbol(PROV_STYLE[provKey(r)] || 'placeholder')}${esc(PROV_TEXT[provKey(r)] || clean(r.coordinate_label))}</span></td></tr>`;
  }
  host.innerHTML = html + '</tbody></table>';
  host.addEventListener('click', e => {
    const b = e.target.closest('[data-open]');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    go({ view: 'sites', record: b.dataset.open });
  });
  // The ledger mirrors the filters: lines outside the engine's current result set are dimmed and
  // cannot be opened, so no click ever clears the filters silently.
  const list = $('recordList'), status = $('ledgerStatus');
  const sync = () => {
    const visible = new Set([...list.querySelectorAll('[data-record]')].map(b => b.dataset.record));
    let shown = 0;
    for (const tr of host.querySelectorAll('tr[data-record]')) {
      const on = visible.has(tr.dataset.record), link = tr.querySelector('.record-link');
      tr.classList.toggle('dim', !on);
      if (on) { shown++; tr.removeAttribute('title'); link.removeAttribute('aria-disabled'); link.removeAttribute('tabindex'); }
      else { tr.title = 'Outside the current filters'; link.setAttribute('aria-disabled', 'true'); link.setAttribute('tabindex', '-1'); }
    }
    if (status) status.textContent = shown === RECS.length ? `All ${RECS.length} records in order of discovery year. Select a specimen to open its record.` : `${shown} of ${RECS.length} records match the current filters; the rest are dimmed and cannot be opened. Select a specimen to open its record.`;
  };
  if (list) { new MutationObserver(sync).observe(list, { childList: true }); sync(); }
}

renderSummary();
renderLedger();
skipLink($('skipToCatalogue'), () => $('workspace'));
skipLink($('skipMap'), () => [$('discoveryChronology'), $('specimenChronology'), $('legend')].find(el => el && !el.hidden));
const toNotes = $('aboutToNotes');
if (toNotes) toNotes.addEventListener('click', e => { e.preventDefault(); $('aboutDialog').close(); jumpTo($('method')); });
})();

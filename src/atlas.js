/* Mammoth History Lab specimen atlas. Raw workbook cells are retained in source_values; display fields are separate.
   No network requests. The original Three.js renderer is bundled. Display-derived fields never mutate records. */
(() => {
'use strict';
const D = globalThis.__ATLAS_DATA__ || JSON.parse(document.getElementById('payload').textContent);
const RECS = D.recs, BY_ID = new Map(RECS.map(r => [r.id, r]));
const SOURCE_LABEL=D.metadata.source_file;
// Publication settings: fill these with the released Borealis dataset URL and DOI.
const DATASET_URL = '{{DATASET_URL}}';
const DATASET_DOI = '{{DATASET_DOI}}';
// Specimen_id values are temporary Lab checks, retained only for this working edition.
const recordID=r=>String(r.source_id)+(r.duplicate_source_id?' · row '+r.source_row:'');
const val = p => Array.isArray(p) ? p[0] : p;
const status = p => Array.isArray(p) ? p[1] : (p == null ? 'na' : 'val');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = s => String(s ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const normal = s => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const name = r => status(r.common_name) === 'val' ? clean(val(r.common_name)) : clean(r.location);
// Taxon groups come from the workbook (payload.species, in Specimen_type_list order). Colours are
// assigned by name; any new group falls back to the spare palette.
const PALETTE={Mammoth:'#d9b075',Rhinoceros:'#8cb8b5',Horse:'#b3a3c8',Bison:'#a9b68d','Cave Lion/Felid':'#d59585','Wolf/Canid':'#b0b1b0'};
const SPARE_COLORS=['#c9a7a0','#9fb7c9','#c7c29a','#b7a9c9','#a3c0a8'];
const TAXA={};Object.keys(D.species).forEach((k,i)=>{TAXA[k]={color:PALETTE[k]||SPARE_COLORS[i%SPARE_COLORS.length],shape:'circle'};});
const TAXON_COUNT=Object.keys(TAXA).length;
const MATERIALS = {skin:'Skin & hide',hair:'Hair, fur & wool',flesh:'Flesh & muscle',organs:'Internal organs',trunk:'Trunk',keratin:'Hoofs, claws, nails & horn',carcass:'Whole / near-whole',softgeneric:'Soft tissue / mummified',connective:'Tendons & ligaments',unclassified:'No material tag assigned'};
const GRADES={0:'Not recorded',1:'Fragments only',2:'Partial',3:'Mostly complete',4:'Complete carcass'};
// Coordinate provenance classes follow the workbook's Location Provenance column. The key is a
// slug of the label; the style decides the marker symbol (solid / dashed ring / hollow).
const PROVENANCE_STYLE={source_stated:'solid',historical_map:'derived',inferred_historical_map:'derived',inferred:'derived',regional_placeholder:'placeholder',unlocated:'placeholder',unlabelled:'placeholder'};
const PROVENANCE_TEXT={source_stated:'Source-stated',historical_map:'Historical map',inferred_historical_map:'Inferred / historical map',inferred:'Inferred',regional_placeholder:'Regional placeholder',unlocated:'Unlocated',unlabelled:'No provenance label'};
const PROVENANCE={};
for(const label of Object.keys(D.metadata.provenance_counts||{}).concat(RECS.map(r=>r.coordinate_label||'unlabelled'))){
  const key=label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'unlabelled';
  if(!PROVENANCE[key])PROVENANCE[key]={label:PROVENANCE_TEXT[key]||clean(label),raw:label,style:PROVENANCE_STYLE[key]||'placeholder'};
}
const PROV_COUNT=Object.keys(PROVENANCE).length;
const provenanceOf=r=>PROVENANCE[r.coordinate_key]||PROVENANCE.unlabelled||{label:'No provenance label',style:'placeholder'};
const STYLE_TEXT={solid:'Source-stated coordinate',derived:'Inferred or historical-map position',placeholder:'Regional placeholder / unlocated'};

const years=RECS.map(r=>r.year_found || r.year_collected || r.timeline_year).filter(Number.isFinite);
const MIN=Math.min(...years), MAX=Math.max(...years);
const recordYear=r=>r.year_found || r.year_collected || r.timeline_year || null;
const yearBasis=r=>r.year_found ? 'Find year' : r.year_collected ? 'Collection year used' : 'Timeline year supplied';
const hasCoords=r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&Math.abs(r.lat)<=90&&Math.abs(r.lon)<=180;

const AGE_BANDS=[
 {key:'b0',label:'≤ 10,000',color:'#f7cfb6'},
 {key:'b1',label:'10,000–20,000',color:'#f0a878'},
 {key:'b2',label:'20,000–35,000',color:'#d98a6a'},
 {key:'b3',label:'35,000–50,000',color:'#9dafae'},
 {key:'b4',label:'> 50,000',color:'#719590'},
 {key:'range',label:'Spans bands / multiple values',color:'#b3a3c8'},
 {key:'lower',label:'Lower limit',color:'#d9c17a'},
 {key:'missing',label:'No numeric age',color:'#a39c96'},
 {key:'unparsed',label:'Source text only',color:'#cfaa72'}
];
const bandIndex=n=>n<=10000?0:n<=20000?1:n<=35000?2:n<=50000?3:4;
function parseAge(r){
  const raw=String(val(r.age)??''),empty={raw,values:[],intervals:[],kind:'missing',key:'missing',basis:'Not recorded'};
  if(status(r.age)!=='val'||!/\d/.test(raw)||/undated|not[\s_]*(?:recorded|applicable|available)|unknown|^\s*n\/?a\s*$/i.test(raw))return empty;
  if(/\d[,\s]+\d{4,}(?:\D|$)/.test(raw))return {...empty,kind:'unparsed',key:'unparsed',basis:'Numeric reading unresolved'};
  // Parse a separate display representation; never rewrite the source text.
  // "29 500", "34, 450" and "31.700" are all read as thousands groups.
  const s=raw.replace(/(\d)[,\s]+(?=\d{3}\b)/g,'$1').replace(/\b(\d{1,3})\.(\d{3})\b/g,'$1$2').replace(/\+\s*\/\s*-/g,'±');
  const parts=s.split('/'),intervals=[],values=[];let uncertainty=false,range=false,error=0;
  for(const part of parts){
    const estimates=[...part.matchAll(/(\d+(?:\.\d+)?)(?:\s*±\s*(\d+(?:\.\d+)?))?/g)].map(m=>({n:+m[1],e:+(m[2]||0)}));
    if(!estimates.length)continue;
    values.push(...estimates.map(p=>p.n));
    uncertainty ||= estimates.some(p=>p.e>0);range ||= estimates.length>1;error=Math.max(error,...estimates.map(p=>p.e));
    const lower=/older than|greater than|>|\d\s*\+\s*(?:years|yr|BP|$)/i.test(part);
    const lo=Math.max(0,Math.min(...estimates.map(p=>p.n-p.e))),hi=lower?Infinity:Math.max(...estimates.map(p=>p.n+p.e));
    intervals.push({lo,hi,lower});
  }
  if(!values.length)return {...empty,kind:'unparsed',key:'unparsed',basis:'Numeric reading unresolved'};
  const basis=/cal\.?/i.test(s)?'Calibrated BP':/\bb\.?p\.?\b|yBP/i.test(s)?'BP; calibration not stated':'Age basis not stated';
  const lo=Math.min(...intervals.map(i=>i.lo)),hi=Math.max(...intervals.map(i=>i.hi));
  const kind=parts.length>1?'multiple':intervals[0].lower?'lower':range?'range':uncertainty?'uncertainty':'value';
  const key=kind==='multiple'?'range':kind==='lower'?'lower':bandIndex(lo)!==bandIndex(hi)?'range':'b'+bandIndex(lo);
  return {raw,values,intervals,lo,hi,error,kind,key,basis};
}
// Search only the fields available in this discovery-focused interface.
const SEARCH_FIELDS=['Specimen_id','Species_type','Binomial','Former_classification','Common_name','Secondary_name(s)','Secondary_name','Location_found','Location Provenance','Date(s)_collected','Date_Found','Age_BP_radiocarbon','Complete?','Parts_found','Published_References','Archival_References'];
const DERIVED=new Map(RECS.map(r=>[r.id,{age:parseAge(r),search:normal([...SEARCH_FIELDS.map(k=>r.source_values[k]),val(r.notes),r.coordinate_label].join(' '))}]));
const AGE_MAX=Math.ceil(Math.max(...[...DERIVED.values()].flatMap(d=>[...d.age.values,...d.age.intervals.filter(i=>Number.isFinite(i.hi)).map(i=>i.hi)]),5000)/5000)*5000;
const usesSpecimenTime=s=>s.view==='ages'||s.view==='table'&&s.tableTime==='specimen';
function ageOverlaps(age,min,max){
  // A lower limit describes possible ages beyond the limit, not an exact age.
  // Test alternative reported values separately rather than filling the gap between them.
  return age.intervals.some(i=>(i.lower?max>i.lo:max>=i.lo)&&min<=i.hi);
}
function defaults(){return {taxa:new Set(Object.keys(TAXA)),provenance:new Set(Object.keys(PROVENANCE)),materials:new Set(),query:'',mapped:'all',age:'all',mode:'through',start:MIN,end:MAX,ageMode:'all',ageStart:0,ageEnd:AGE_MAX,tableTime:'discovery',view:'sites',projection:'flat',selected:null};}
function matches(r,s,ignoreTime=false){
  const d=DERIVED.get(r.id);
  if(!s.taxa.has(r.species))return false;
  if(s.query){const q=normal(s.query);if(/^#?\d+$/.test(q)){if(r.source_id!==+q.replace('#',''))return false;}else if(!q.split(/\s+/).every(t=>d.search.includes(t)))return false;}
  if(s.materials.size&&![...s.materials].some(m=>r.facets.includes(m)))return false;
  if(!s.provenance.has(r.coordinate_key||'unlabelled'))return false;
  if(s.mapped==='mapped'&&!hasCoords(r))return false;
  if(s.mapped==='unmapped'&&hasCoords(r))return false;
  if(s.age==='dated'&&!d.age.values.length)return false;
  if(s.age==='missing'&&d.age.kind!=='missing')return false;
  if(s.age==='unparsed'&&d.age.kind!=='unparsed')return false;
  if(!ignoreTime){
    if(usesSpecimenTime(s)){if(s.ageMode==='between'&&!ageOverlaps(d.age,s.ageStart,s.ageEnd))return false;}
    else{const y=recordYear(r);if(y==null)return s.end===MAX&&s.start===MIN;if(y>s.end||(s.mode==='between'&&y<s.start))return false;}
  }
  return true;
}

function stateParams(s){
  const p=new URLSearchParams();p.set('view',s.view);p.set('projection',s.projection);
  if(s.taxa.size!==TAXON_COUNT)p.set('taxa',[...s.taxa].join(','));
  if(s.provenance.size!==PROV_COUNT)p.set('prov',[...s.provenance].join(','));
  if(s.materials.size)p.set('material',[...s.materials].join(','));if(s.query)p.set('q',s.query);
  for(const key of ['mapped','age'])if(s[key]!=='all')p.set(key,s[key]);
  if(s.mode==='between')p.set('from',s.start);if(s.end!==MAX)p.set('to',s.end);
  if(s.ageMode==='between'){p.set('ageFrom',s.ageStart);p.set('ageTo',s.ageEnd);}
  if(s.view==='table'&&s.tableTime==='specimen')p.set('tableTime','specimen');
  if(s.selected!=null)p.set('record',s.selected);return p;
}
function parseState(hash){
  const s=defaults(),p=new URLSearchParams(hash.replace(/^#/,''));
  if(['sites','ages','table'].includes(p.get('view')))s.view=p.get('view');
  if(['flat','globe'].includes(p.get('projection')))s.projection=p.get('projection');else if(p.get('projection')==='polar')s.projection='globe';
  if(p.has('taxa'))s.taxa=new Set(p.get('taxa').split(',').filter(k=>TAXA[k]));
  if(p.has('prov'))s.provenance=new Set(p.get('prov').split(',').filter(k=>PROVENANCE[k]));
  if(p.has('material'))s.materials=new Set(p.get('material').split(',').filter(k=>MATERIALS[k]));
  s.query=(p.get('q')||'').slice(0,1000);
  const allowed={mapped:['mapped','unmapped'],age:['dated','missing','unparsed']};
  for(const key of Object.keys(allowed))if(allowed[key].includes(p.get(key)))s[key]=p.get(key);
  if(p.has('from')&&/^\d{4}$/.test(p.get('from'))){s.mode='between';s.start=Math.max(MIN,Math.min(MAX,+p.get('from')));}
  if(p.has('to')&&/^\d{4}$/.test(p.get('to')))s.end=Math.max(MIN,Math.min(MAX,+p.get('to')));
  if(s.start>s.end)s.start=s.end;
  if(p.get('tableTime')==='specimen')s.tableTime='specimen';
  for(const [param,key]of [['ageFrom','ageStart'],['ageTo','ageEnd']]){const raw=p.get(param);if(raw!==null&&/^\d+(?:\.\d+)?$/.test(raw)){s.ageMode='between';s[key]=Math.max(0,Math.min(AGE_MAX,+raw));}}
  if(s.ageStart>s.ageEnd)s.ageStart=s.ageEnd;
  if(p.has('record')&&BY_ID.has(p.get('record')))s.selected=p.get('record');
  else if(p.has('record')&&RECS.some(r=>String(r.source_id)===p.get('record')))s.query='#'+p.get('record');return s;
}
const rad=Math.PI/180;
function projected(lat,lon,projection,g,rotation={lon:110,lat:65}){
  const cx=g.w/2,cy=g.h/2,R=Math.min(g.w-80,g.h-65)/2;
  if(projection==='flat')return {x:(lon+180)/360*g.w,y:(86-lat)/58*g.h,visible:lat>=28&&lat<=86};
  if(projection==='polar'){const rr=(90-lat)/65*R,a=(lon-110)*rad;return {x:cx+rr*Math.sin(a),y:cy-rr*Math.cos(a),visible:lat>=25};}
  const p=lat*rad,l=(lon-rotation.lon)*rad,c=rotation.lat*rad;
  const z=Math.sin(c)*Math.sin(p)+Math.cos(c)*Math.cos(p)*Math.cos(l);
  return {x:cx+R*Math.cos(p)*Math.sin(l),y:cy-R*(Math.cos(c)*Math.sin(p)-Math.sin(c)*Math.cos(p)*Math.cos(l)),visible:z>=-1e-8,z};
}
function spreadPoints(points,minGap=12,bounds={w:1e6,h:1e6}){
  const placed=[];
  // Every record remains a point. Screen-space offsets never change latitude/longitude.
  for(const p of points){
    let x=p.x,y=p.y;
    const free=(xx,yy)=>xx>=8&&yy>=8&&xx<=bounds.w-8&&yy<=bounds.h-8&&!placed.some(q=>Math.hypot(q.x-xx,q.y-yy)<minGap);
    if(!free(x,y)){
      let found=false;
      for(let radius=7;radius<=140&&!found;radius+=4){
        const slots=Math.max(12,Math.ceil(2*Math.PI*radius/minGap));
        for(let i=0;i<slots;i++){const a=2*Math.PI*i/slots-Math.PI/2,xx=p.x+Math.cos(a)*radius,yy=p.y+Math.sin(a)*radius;if(free(xx,yy)){x=xx;y=yy;found=true;break;}}
      }
    }
    placed.push({...p,anchorX:p.x,anchorY:p.y,x,y,offset:Math.hypot(x-p.x,y-p.y)});
  }
  return placed;
}
if(globalThis.__ATLAS_TEST__){globalThis.__ATLAS_API__={RECS,DERIVED,TAXA,TAXON_COUNT,PROVENANCE,PROV_COUNT,provenanceOf,MATERIALS,MIN,MAX,parseAge,ageOverlaps,usesSpecimenTime,AGE_MAX,matches,defaults,parseState,stateParams,projected,spreadPoints,name,recordID,hasCoords,recordYear};return;}

const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const svgEl=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;return n;};
let state=parseState(location.hash),visible=[],sort='year-asc',tableSort={key:'year',dir:1},timer=null,spinTimer=null,toastTimer=null,previousFocus=null;
let geometry={w:1000,h:470},camera={zoom:1,x:0,y:0},rotation={lon:110,lat:65},frame=null,mapPoints=[],restoringHash=false;
const landText=$('land').textContent;
const polygons=landText.split('M').filter(Boolean).map(part=>{const n=part.match(/-?\d+(?:\.\d+)?/g)||[];const ring=[];for(let i=0;i+1<n.length;i+=2)ring.push([+n[i]/D.W*360-180,86-(+n[i+1]/D.H)*58]);return ring;}).filter(r=>r.length>2);
let visibleMarkers=[];

function symbol(shape,x,y,size,color,hollow=false){
  const attrs={fill:hollow?'#fff':color,stroke:hollow?color:'#fff','stroke-width':hollow?1.8:1.1};
  if(shape==='circle')return svgEl('circle',{cx:x,cy:y,r:size,...attrs});
  if(shape==='square')return svgEl('rect',{x:x-size,y:y-size,width:size*2,height:size*2,rx:1,...attrs});
  if(shape==='cross')return svgEl('path',{d:`M${x-size},${y-size*.34}H${x-size*.34}V${y-size}H${x+size*.34}V${y-size*.34}H${x+size}V${y+size*.34}H${x+size*.34}V${y+size}H${x-size*.34}V${y+size*.34}H${x-size}Z`,...attrs});
  const count=shape==='triangle'?3:shape==='diamond'?4:6,offset=-Math.PI/2;
  return svgEl('polygon',{points:Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count+offset;return `${x+Math.cos(a)*size*1.2},${y+Math.sin(a)*size*1.2}`;}).join(' '),...attrs});
}
function provenanceSymbol(style,size=14,color='#6f5a4e'){
  const svg=svgEl('svg',{viewBox:'0 0 20 20',width:size,height:size,'aria-hidden':'true',class:'prov-swatch'});
  if(style==='placeholder')svg.append(svgEl('circle',{cx:10,cy:10,r:5,fill:'none',stroke:color,'stroke-width':1.8}));
  else{svg.append(svgEl('circle',{cx:10,cy:10,r:4.2,fill:color}));if(style==='derived')svg.append(svgEl('circle',{cx:10,cy:10,r:7.6,fill:'none',stroke:color,'stroke-width':1.2,'stroke-dasharray':'2.4 1.7'}));}
  return svg.outerHTML;
}
function symbolHTML(taxon,size=16,hollow=false){const v=TAXA[taxon],svg=svgEl('svg',{viewBox:'0 0 20 20',width:size,height:size,'aria-hidden':'true',class:'taxon-symbol'});svg.append(symbol(v.shape,10,10,6.2,v.color,hollow));return svg.outerHTML;}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4300);}
function syncURL(){try{history.replaceState(null,'','#'+stateParams(state));}catch(_){/* Some local-file contexts disallow history. */}}
function sortedRows(rows=visible){return [...rows].sort((a,b)=>{
  const [key,dir]=sort.split('-'),value=r=>key==='name'?name(r):key==='taxon'?r.species:key==='age'?DERIVED.get(r.id).age.lo:recordYear(r);
  const A=value(a),B=value(b);if(A==null||B==null)return A==null&&B==null?a.source_row-b.source_row:A==null?1:-1;
  return (typeof A==='string'?A.localeCompare(B):A-B)*(dir==='desc'?-1:1)||a.source_row-b.source_row;
});}
function displayedRows(){return sortedRows();}
function buildFilters(){
  $('taxa').innerHTML=Object.keys(TAXA).map(k=>`<label class="check-row">${symbolHTML(k)}<input type="checkbox" data-taxon="${esc(k)}" checked><span>${esc(k)}</span><span class="count">${RECS.filter(r=>r.species===k).length}</span></label>`).join('');
  $('materials').innerHTML=Object.entries(MATERIALS).map(([k,v])=>`<label class="check-row"><input type="checkbox" data-material="${k}"><span>${esc(v)}</span><span class="count">${RECS.filter(r=>r.facets.includes(k)).length}</span></label>`).join('');
  $('provenance').innerHTML=Object.entries(PROVENANCE).map(([k,v])=>`<label class="check-row" title="${esc(STYLE_TEXT[v.style])} · workbook label: ${esc(v.raw)}">${provenanceSymbol(v.style)}<input type="checkbox" data-provenance="${esc(k)}" checked><span>${esc(v.label)}</span><span class="count">${RECS.filter(r=>(r.coordinate_key||'unlabelled')===k).length}</span></label>`).join('');
  $('taxa').addEventListener('change',e=>{const k=e.target.dataset.taxon;if(k){e.target.checked?state.taxa.add(k):state.taxa.delete(k);changed();}});
  $('provenance').addEventListener('change',e=>{const k=e.target.dataset.provenance;if(k){e.target.checked?state.provenance.add(k):state.provenance.delete(k);changed();}});
  $('materials').addEventListener('change',e=>{const k=e.target.dataset.material;if(k){e.target.checked?state.materials.add(k):state.materials.delete(k);changed();}});
}
function configureDatasetLink(){
  const link=$('seeDataset'),ready=Boolean(DATASET_URL);
  if(ready){link.href=DATASET_URL;link.target='_blank';link.rel='noopener';link.removeAttribute('aria-disabled');link.removeAttribute('tabindex');}
  else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');}
  $('datasetStatus').textContent=ready?'Borealis · University of Toronto':'Borealis · publication forthcoming';
  document.querySelectorAll('[data-dataset-doi]').forEach(el=>el.textContent='DOI: '+(DATASET_DOI||'forthcoming'));
}
function placeChronology(){
  // Time graphics belong to their map views; they never move into the table.
  $('discoveryChronology').hidden=state.view!=='sites';
  $('specimenChronology').hidden=state.view!=='ages';
}
function syncViewPanels(){
  const table=state.view==='table';
  $('mapPanel').toggleAttribute('hidden',table);
  $('mapPanel').setAttribute('aria-hidden',String(table));
  $('tablePanel').toggleAttribute('hidden',!table);
  $('tablePanel').setAttribute('aria-hidden',String(!table));
  if(!table)$('mapPanel').setAttribute('aria-labelledby','tab-'+state.view);
  placeChronology();
}
function syncControls(){
  $('search').value=state.query;
  document.querySelectorAll('[data-taxon]').forEach(i=>i.checked=state.taxa.has(i.dataset.taxon));
  document.querySelectorAll('[data-material]').forEach(i=>i.checked=state.materials.has(i.dataset.material));
  document.querySelectorAll('[data-provenance]').forEach(i=>i.checked=state.provenance.has(i.dataset.provenance));
  $('taxonActive').textContent=state.taxa.size===TAXON_COUNT?'All selected':state.taxa.size+' selected';
  $('provenanceActive').textContent=state.provenance.size===PROV_COUNT?'All classes':state.provenance.size+' selected';
  $('materialActive').textContent=state.materials.size?state.materials.size+' selected':'Any';
  for(const k of ['mapped','age'])$(k+'Filter').value=state[k];
  $('timeMode').value=state.mode;$('startWrap').hidden=state.mode!=='between';$('startYear').value=state.start;$('endYear').value=state.end;$('yearRange').value=state.end;
  $('yearRange').setAttribute('aria-valuetext',`${state.mode==='between'?'From '+state.start+' through':'Found by'} ${state.end}`);
  document.querySelectorAll('[data-view]').forEach(b=>{const on=state.view===b.dataset.view;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;});
  document.querySelectorAll('[data-projection]').forEach(b=>b.setAttribute('aria-pressed',state.projection===b.dataset.projection));
  $('globeSpin').disabled=state.projection!=='globe';
  syncViewPanels();syncAgeControls();
  const ageTime=usesSpecimenTime(state);
  if(ageTime&&sort.startsWith('year-'))sort='age-asc';else if(!ageTime&&sort.startsWith('age-'))sort='year-asc';
  $('sort').value=sort;
  for(const o of $('sort').options)o.hidden=ageTime?o.value.startsWith('year-'):o.value.startsWith('age-');
  const taxonContext={...state,taxa:new Set(Object.keys(TAXA))},materialContext={...state,materials:new Set()},provContext={...state,provenance:new Set(Object.keys(PROVENANCE))};
  document.querySelectorAll('[data-taxon]').forEach(i=>{const count=RECS.filter(r=>r.species===i.dataset.taxon&&matches(r,taxonContext)).length;i.closest('label').querySelector('.count').textContent=count;i.closest('label').querySelector('.count').title='Records matching the other filters';});
  document.querySelectorAll('[data-provenance]').forEach(i=>{const count=RECS.filter(r=>(r.coordinate_key||'unlabelled')===i.dataset.provenance&&matches(r,provContext)).length;i.closest('label').querySelector('.count').textContent=count;});
  document.querySelectorAll('[data-material]').forEach(i=>{const count=RECS.filter(r=>r.facets.includes(i.dataset.material)&&matches(r,materialContext)).length;i.closest('label').querySelector('.count').textContent=count;i.closest('label').querySelector('.count').title='Records matching the other filters';});
}
function renderChips(){
  const chips=[];
  if(state.query)chips.push({label:'Search: '+state.query,clear:()=>state.query=''});
  if(state.taxa.size!==TAXON_COUNT)chips.push({label:state.taxa.size+' taxon groups',clear:()=>state.taxa=new Set(Object.keys(TAXA))});
  if(state.provenance.size!==PROV_COUNT)chips.push({label:'Provenance: '+(state.provenance.size>2?state.provenance.size+' classes':[...state.provenance].map(k=>PROVENANCE[k].label).join(', ')||'none'),clear:()=>state.provenance=new Set(Object.keys(PROVENANCE))});
  for(const m of state.materials)chips.push({label:MATERIALS[m],clear:()=>state.materials.delete(m)});
  for(const k of ['mapped','age'])if(state[k]!=='all')chips.push({label:$(k+'Filter').selectedOptions[0].text,clear:()=>state[k]='all'});
  if(!usesSpecimenTime(state)&&(state.end!==MAX||state.mode==='between'))chips.push({label:state.mode==='between'?state.start+'–'+state.end:'Found by '+state.end,clear:()=>{state.mode='through';state.start=MIN;state.end=MAX;}});
  if(usesSpecimenTime(state)&&state.ageMode==='between')chips.push({label:'Specimen age: '+ageNumber(state.ageStart)+'–'+ageNumber(state.ageEnd)+' years',clear:()=>{state.ageMode='all';state.ageStart=0;state.ageEnd=AGE_MAX;}});
  $('activeFilters').replaceChildren(...chips.map(c=>{const b=document.createElement('button');b.className='filter-chip';b.innerHTML=esc(c.label)+'<span aria-hidden="true">×</span>';b.setAttribute('aria-label','Remove filter: '+c.label);b.onclick=()=>{c.clear();changed();};return b;}));
}
function renderHistogram(){
  if(state.view!=='sites')return;
  const svg=$('histogram'),bins=[],first=Math.floor(MIN/10)*10,last=Math.ceil(MAX/10)*10,bw=800/((last-first)/10);
  const candidates=RECS.filter(r=>matches(r,state,true));
  for(let d=first;d<last;d+=10)bins.push({d,all:RECS.filter(r=>recordYear(r)>=d&&recordYear(r)<d+10).length,filtered:candidates.filter(r=>recordYear(r)>=d&&recordYear(r)<d+10).length});
  const max=Math.max(...bins.map(b=>b.all),1);svg.replaceChildren();
  bins.forEach((b,i)=>{if(!b.all)return;const x=i*bw+1,w=bw-2,g=svgEl('g',{class:'hist-bar',tabindex:0,role:'button','aria-label':`${b.d}s: ${b.filtered} records match non-date filters, ${b.all} in full dataset. Filter to this decade.`});
    g.append(svgEl('rect',{x,y:0,width:w,height:38,fill:'transparent'}),svgEl('rect',{x,y:38-b.all/max*36,width:w,height:b.all/max*36,class:'hist-back'}));
    const selected=visible.filter(r=>recordYear(r)>=b.d&&recordYear(r)<b.d+10).length;
    g.append(svgEl('rect',{x,y:38-selected/max*36,width:w,height:selected/max*36,class:'hist-front'}));
    g.append(svgEl('title',{},`${b.d}s · ${selected} shown / ${b.all} total`));
    const choose=()=>{state.mode='between';state.start=Math.max(MIN,b.d);state.end=Math.min(MAX,b.d+9);changed();};g.onclick=choose;g.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose();}};svg.append(g);
  });
  const fallback=visible.filter(r=>!r.year_found&&r.year_collected).length;
  $('timeCaption').textContent=(state.mode==='between'?`${state.start}–${state.end}`:state.end===MAX?'All recorded find years':`Found by ${state.end}`)+(fallback?` · ${fallback} record${fallback>1?'s use':' uses'} collection year`:'');
}
const ageNumber=n=>n.toLocaleString('en-US');
function syncAgeControls(){
  const active=state.ageMode==='between';
  $('ageMode').value=state.ageMode;
  $('ageStart').value=$('ageMinRange').value=state.ageStart;
  $('ageEnd').value=$('ageMaxRange').value=state.ageEnd;
  for(const id of ['ageStart','ageEnd','ageMinRange','ageMaxRange'])$(id).max=AGE_MAX;
  $('ageMinRange').setAttribute('aria-valuetext',ageNumber(state.ageStart)+' years as recorded');
  $('ageMaxRange').setAttribute('aria-valuetext',ageNumber(state.ageEnd)+' years as recorded');
  $('ageSelection').textContent=active?ageNumber(state.ageStart)+'–'+ageNumber(state.ageEnd)+' years':'All recorded ages';
  const step=Math.max(5000,Math.floor(AGE_MAX/3/5000)*5000),ticks=[0,step,step*2,AGE_MAX];
  $('ageAxis').replaceChildren(...ticks.map(n=>{const el=document.createElement('span');el.textContent=ageNumber(n);el.style.left=(n/AGE_MAX*100)+'%';return el;}));
}
function renderAgeTimeline(){
  if(state.view!=='ages')return;
  const svg=$('ageTimeline'),numeric=visible.filter(r=>DERIVED.get(r.id).age.intervals.length).sort((a,b)=>DERIVED.get(a.id).age.lo-DERIVED.get(b.id).age.lo||a.source_row-b.source_row);
  const w=800,h=Math.max(60,Math.min(180,numeric.length*3.5+12)),x=n=>Math.max(8,Math.min(w-8,8+n/AGE_MAX*(w-16)));
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.style.height=h+'px';
  for(let n=0;n<=AGE_MAX;n+=10000)svg.append(svgEl('line',{x1:x(n),x2:x(n),y1:0,y2:h,class:'age-grid'}));
  if(state.ageMode==='between')svg.append(svgEl('rect',{x:x(state.ageStart),y:0,width:Math.max(1,x(state.ageEnd)-x(state.ageStart)),height:h,class:'age-selection'}));
  numeric.forEach((r,index)=>{
    const a=DERIVED.get(r.id).age,y=6+(index+.5)*(h-12)/Math.max(1,numeric.length),col=AGE_BANDS.find(b=>b.key===a.key).color;
    const g=svgEl('g',{class:'age-record',tabindex:0,role:'button','data-age-record':r.id,'aria-label':`${name(r)}. Age as recorded: ${a.raw}. Open specimen record.`});
    for(const i of a.intervals){
      const x1=x(i.lo),x2=x(i.hi),shared={'stroke':col,'stroke-width':1.8};
      if(i.lo===i.hi)g.append(svgEl('circle',{cx:x1,cy:y,r:2,fill:col}));
      else{
        g.append(svgEl('line',{x1,x2,y1:y,y2:y,...shared}));
        g.append(svgEl('line',{x1,x2:x1,y1:y-2,y2:y+2,...shared}));
        if(i.lower)g.append(svgEl('path',{d:`M${x2-5},${y-2.5}L${x2},${y}L${x2-5},${y+2.5}`,fill:'none',...shared}));
        else g.append(svgEl('line',{x1:x2,x2,y1:y-2,y2:y+2,...shared}));
      }
    }
    g.append(svgEl('title',{},name(r)+' · '+a.raw));
    g.onclick=()=>openRecord(r.id);g.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();openRecord(r.id);}};svg.append(g);
  });
  const context=RECS.filter(r=>matches(r,state,true)),unpositioned=context.filter(r=>!DERIVED.get(r.id).age.intervals.length).length;
  $('agePlotEmpty').hidden=numeric.length>0;
  $('ageCoverage').textContent=state.ageMode==='all'?`${numeric.length} records positioned by age · ${unpositioned} without a numeric position remain on the map.`:`${numeric.length} records compatible with this interval · ${unpositioned} without a numeric position are excluded from interval selection.`;
}
function initAgeEvents(){
  $('ageMode').onchange=e=>{state.ageMode=e.target.value;changed();};
  $('ageReset').onclick=()=>{state.ageMode='all';state.ageStart=0;state.ageEnd=AGE_MAX;changed();};
  const setAge=(key,input)=>{
    const n=Number(input.value);
    if(input.value.trim()===''||!Number.isInteger(n)||n<0||n>AGE_MAX){input.value=state[key];toast(`Enter a source age from 0 to ${ageNumber(AGE_MAX)} years.`);return;}
    state[key]=n;state.ageMode='between';
    if(state.ageStart>state.ageEnd){if(key==='ageStart')state.ageEnd=state.ageStart;else state.ageStart=state.ageEnd;}
    changed();
  };
  $('ageStart').onchange=()=>setAge('ageStart',$('ageStart'));$('ageEnd').onchange=()=>setAge('ageEnd',$('ageEnd'));
  $('ageMinRange').oninput=()=>setAge('ageStart',$('ageMinRange'));$('ageMaxRange').oninput=()=>setAge('ageEnd',$('ageMaxRange'));
}


function stopPlay(){clearInterval(timer);timer=null;$('play').textContent='▶';$('play').setAttribute('aria-label','Play discovery chronology');}
function changed({keepPlaying=false}={}){
  if(!keepPlaying)stopPlay();
  visible=RECS.filter(r=>matches(r,state));
  if(state.selected!=null&&!visible.some(r=>r.id===state.selected)){state.selected=null;if($('recordDialog').open)$('recordDialog').close();}
  syncControls();renderChips();renderHistogram();renderAgeTimeline();renderRecordList();renderTable();
  $('resultCount').innerHTML=`<strong>${visible.length}</strong> of ${RECS.length} records`;
  renderMap();syncURL();
}
function resetFilters(){const {view,projection,tableTime}=state;state={...defaults(),view,projection,tableTime};changed();}

let globeEngine=null,globeFailed=false;
function buildMapPoints(){return visible.filter(hasCoords).map(r=>({lat:r.lat,lon:r.lon,id:r.id,r}));}
function transform(p){return {...p,x:geometry.w/2+(p.x-geometry.w/2)*camera.zoom+camera.x,y:geometry.h/2+(p.y-geometry.h/2)*camera.zoom+camera.y};}
function project(lat,lon){return transform(projected(lat,lon,state.projection,geometry,rotation));}
function pathFor(coords,closed=false){
  let out='',drawing=false;
  for(const [lon,lat]of coords){const p=projected(lat,lon,state.projection,geometry,rotation);if(state.projection==='globe'&&!p.visible){drawing=false;continue;}out+=(drawing?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2);drawing=true;}
  return out+(closed&&state.projection!=='globe'?'Z':'');
}
function baseMap(){
  const svg=$('atlasMap');svg.replaceChildren();const {w,h}=geometry;
  const defs=svgEl('defs'),glow=svgEl('filter',{id:'selectedGlow',x:'-100%',y:'-100%',width:'300%',height:'300%'});glow.append(svgEl('feGaussianBlur',{stdDeviation:2.3}));defs.append(glow);svg.append(defs);
  const frame=svgEl('g',{transform:`translate(${w/2+camera.x},${h/2+camera.y}) scale(${camera.zoom}) translate(${-w/2},${-h/2})`});svg.append(frame);
  if(state.projection==='flat'){
    const grat=svgEl('g',{class:'graticule'});
    for(let lat=30;lat<=80;lat+=10){const y=(86-lat)/58*h;grat.append(svgEl('line',{x1:0,y1:y,x2:w,y2:y}));}
    for(let i=0;i<=12;i++)grat.append(svgEl('line',{x1:i/12*w,y1:0,x2:i/12*w,y2:h}));frame.append(grat);
    frame.append(svgEl('path',{d:landText,class:'land',transform:`scale(${w/D.W},${h/D.H})`}));
    for(let lat=30;lat<=80;lat+=10){const p=projected(lat,-177,'flat',geometry);frame.append(svgEl('text',{x:p.x,y:p.y-4,class:'geo-small'},lat+'°N'));}
    frame.append(svgEl('text',{x:w-14,y:h-12,class:'geo-small','text-anchor':'end'},'↑ N'));
  }else{
    // WebGL fallback preserves an interactive sphere when hardware acceleration is unavailable.
    const R=Math.min(w-80,h-65)/2;frame.append(svgEl('circle',{cx:w/2,cy:h/2,r:R,fill:'#51433b',stroke:'#9b8172','stroke-width':1}));
    for(let lat=-60;lat<=80;lat+=20)frame.append(svgEl('path',{d:pathFor(Array.from({length:181},(_,i)=>[-180+i*2,lat])),class:'graticule'}));
    for(let lon=-180;lon<180;lon+=30)frame.append(svgEl('path',{d:pathFor(Array.from({length:87},(_,i)=>[lon,-86+i*2])),class:'graticule'}));
    let d='';for(const ring of polygons)d+=pathFor(ring,true);frame.append(svgEl('path',{d,class:'land',style:'fill:none;stroke:#d1b9a8;stroke-opacity:.55;stroke-width:.8'}));
  }
}
function tooltipForPoint(p){
  const r=p.r,d=DERIVED.get(r.id);
  return `<strong>${esc(name(r))}</strong> <span>#${esc(recordID(r))}</span><br>${esc(r.species)} · ${recordYear(r)||'Year not recorded'}<br>${esc(clean(r.location))}<br>${esc(provenanceOf(r).label)} · ${esc(STYLE_TEXT[provenanceOf(r).style].toLowerCase())}${state.view==='ages'?'<br>'+esc(d.age.raw)+'<br>'+esc(d.age.basis):''}${r.review_notes.length?'<br><span class="tooltip-review">Source review note available</span>':''}`;
}
function positionTip(event){const rect=$('atlasMap').hasAttribute('hidden')?$('classicGlobe').getBoundingClientRect():$('atlasMap').getBoundingClientRect(),tip=$('mapTooltip'),w=tip.offsetWidth||250,h=tip.offsetHeight||95;tip.style.left=Math.max(8,Math.min(rect.width-w-8,event.clientX-rect.left+14))+'px';tip.style.top=Math.max(30,Math.min(rect.height-h-8,event.clientY-rect.top-30))+'px';}
function renderMarkers(){
  const svg=$('atlasMap'),screen=mapPoints.map(p=>({...p,...project(p.lat,p.lon)})).filter(p=>p.visible&&p.x>=0&&p.y>=0&&p.x<=geometry.w&&p.y<=geometry.h);
  const points=spreadPoints(screen,12,geometry);visibleMarkers=points;
  for(const p of points){if(p.offset>1){svg.append(svgEl('line',{x1:p.anchorX,y1:p.anchorY,x2:p.x,y2:p.y,class:'point-leader'}));svg.append(svgEl('circle',{cx:p.anchorX,cy:p.anchorY,r:1.2,class:'site-anchor'}));}}
  const layer=svgEl('g',{'aria-label':'Individual specimen records'});svg.append(layer);
  for(const p of points){
    const r=p.r,col=state.view==='ages'?AGE_BANDS.find(a=>a.key===DERIVED.get(r.id).age.key).color:TAXA[r.species].color,prov=provenanceOf(r);
    const g=svgEl('g',{class:'marker '+prov.style+(r.id===state.selected?' selected':''),transform:`translate(${p.x},${p.y})`,tabindex:0,role:'button','data-map-record':r.id,'aria-label':`${name(r)}, record ${recordID(r)}, ${r.species}, ${clean(r.location)}, ${STYLE_TEXT[prov.style].toLowerCase()}${p.offset>1?'. Display point offset; leader line marks the coordinate.':''}`});
    g.append(svgEl('circle',{r:9,fill:col,opacity:.13,class:'point-halo'}));
    g.append(svgEl('circle',{r:7.5,class:'marker-ring'}));
    if(prov.style==='placeholder')g.append(svgEl('circle',{r:4.2,fill:'#352d28',stroke:col,'stroke-width':1.7,class:'point-core'}));
    else{g.append(svgEl('circle',{r:4.2,fill:col,stroke:'#352d28','stroke-width':.8,class:'point-core'}));g.append(svgEl('circle',{r:1.5,fill:'#f4dfce',opacity:.95}));}
    if(prov.style==='derived')g.append(svgEl('circle',{r:6.6,stroke:col,class:'prov-ring'}));
    if(r.id===state.selected)g.append(svgEl('circle',{r:10,fill:'none',stroke:'#dfa89a','stroke-width':1.2}));
    g.append(svgEl('title',{},name(r)+' · '+r.species+' · '+recordID(r)));
    g.onclick=e=>{e.stopPropagation();openRecord(r.id);};g.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();openRecord(r.id);}};
    g.onpointerenter=e=>{$('mapTooltip').innerHTML=tooltipForPoint(p);$('mapTooltip').hidden=false;positionTip(e);};g.onpointermove=positionTip;g.onpointerleave=()=>$('mapTooltip').hidden=true;
    g.onfocus=()=>{$('mapTooltip').innerHTML=tooltipForPoint(p);$('mapTooltip').hidden=false;const rect=svg.getBoundingClientRect();positionTip({clientX:rect.left+p.x,clientY:rect.top+p.y});};g.onblur=()=>$('mapTooltip').hidden=true;
    layer.append(g);
    if(r.id===state.selected){const right=p.x>geometry.w*.65,label=svgEl('text',{x:p.x+(right?-11:11),y:p.y-11,'text-anchor':right?'end':'start',class:'selected-label'},'#'+recordID(r)+' '+name(r));svg.append(label);}
  }
  return {screenCount:new Set(points.map(p=>p.id)).size,pointCount:points.length,offsetCount:points.filter(p=>p.offset>1).length};
}
function renderMapText(result){
  const {screenCount,pointCount,offsetCount}=result;
  const definitions={
    sites:['Discovery sites','Every point opens one specimen record.','Coordinates and provenance labels follow the current workbook: solid points are source-stated, dashed rings mark inferred or historical-map positions, and hollow points mark regional placeholders or unlocated finds. Nearby points are separated only on screen; fine leader lines retain their coordinate anchors.'],
    ages:['Specimen ages, as recorded','Source wording and notation are retained without translation.','Colours group numeric readings from the source text for browsing only. They do not imply a shared timescale: calibrated ages, unqualified ages, ranges and lower limits have not been standardized or recalibrated. Open a point to read the recorded age.']
  };
  const d=definitions[state.view]||definitions.sites;$('mapTitle').textContent=d[0];$('mapSubtitle').textContent=d[1];$('viewNote').textContent=d[2];
  const detail=`${screenCount} of ${visible.length} matching records in view`;
  $('mapCoverage').textContent=detail;
  $('mapProjection').textContent=state.projection==='flat'?'28–86°N · individual localities':'Polar globe · drag to rotate';
  $('mapEmpty').hidden=screenCount>0;
  if(!screenCount){$('mapEmpty').querySelector('h3').textContent=visible.length?'No matching points in this map view':'No records match these filters';$('mapEmpty').querySelector('p').textContent=visible.length?'Use Fit or reset the map. Records without a mapped location remain in the list.':'Remove a filter or reset to explore all '+RECS.length+' records.';}
  const legend=$('legend');
  if(state.view==='ages')legend.innerHTML=AGE_BANDS.map(a=>`<span class="legend-item"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="${a.color}"/></svg>${esc(a.label)} <span class="count">${visible.filter(r=>DERIVED.get(r.id).age.key===a.key).length}</span></span>`).join('');
  else legend.innerHTML=Object.keys(TAXA).filter(k=>state.taxa.has(k)).map(k=>`<span class="legend-item">${symbolHTML(k,15)}${esc(k)}</span>`).join('')+'<span class="legend-group" aria-label="Coordinate provenance symbols">'+['solid','derived','placeholder'].filter(st=>Object.values(PROVENANCE).some(v=>v.style===st)).map(st=>`<span class="legend-item" title="${esc(STYLE_TEXT[st])}">${provenanceSymbol(st,14,'#e9d6c6')}${esc(STYLE_TEXT[st])}</span>`).join('')+'</span>';
  if(offsetCount)legend.insertAdjacentHTML('beforeend','<span class="legend-item"><i class="line-swatch fine"></i> Offset point → coordinate anchor</span>');
}
function showMapSurface(surface){
  // SVGElement does not reliably reflect the HTMLElement .hidden property.
  // Set the attribute explicitly on both mutually exclusive, co-located surfaces.
  for(const [id,kind] of [['atlasMap','svg'],['classicGlobe','globe']]){
    const el=$(id),hidden=surface!==kind;
    el.toggleAttribute('hidden',hidden);
    el.setAttribute('aria-hidden',String(hidden));
  }
}
function renderMap(){
  if(state.view==='table'){if(globeEngine)globeEngine.hide();return;}
  const svg=$('atlasMap'),w=$('mapStage').clientWidth||$('mapPanel').clientWidth||1000,h=Math.max(320,Math.min(540,w*486/1440));
  geometry={w,h};$('mapStage').style.height=h+'px';svg.setAttribute('viewBox',`0 0 ${w} ${h}`);mapPoints=buildMapPoints();
  $('mapTooltip').hidden=true;
  if(state.projection==='globe'&&!globeFailed){
    try{
      if(!globeEngine)globeEngine=createClassicGlobe();
      showMapSurface('globe');
      renderMapText(globeEngine.update(mapPoints));return;
    }catch(error){globeFailed=true;if(globeEngine)globeEngine.hide();showMapSurface('svg');toast('WebGL is unavailable. The interactive outline globe remains available.');}
  }
  showMapSurface('svg');if(globeEngine)globeEngine.hide();
  baseMap();renderMapText(renderMarkers());
}
function requestMap(){if(frame!=null)return;frame=requestAnimationFrame(()=>{frame=null;renderMap();});}
function resetMap(){camera={zoom:1,x:0,y:0};rotation={lon:110,lat:65};if(globeEngine)globeEngine.reset();requestMap();}
function zoom(f,point={x:geometry.w/2,y:geometry.h/2}){
  if(state.projection==='globe'&&globeEngine&&!globeFailed){globeEngine.zoom(f);requestMap();return;}
  const old=camera.zoom,next=Math.max(1,Math.min(12,old*f)),ratio=next/old;
  camera.x=point.x-geometry.w/2-(point.x-geometry.w/2-camera.x)*ratio;camera.y=point.y-geometry.h/2-(point.y-geometry.h/2-camera.y)*ratio;camera.zoom=next;
  clampCamera();requestMap();
}
function clampCamera(){const limx=geometry.w*(camera.zoom-1)/2,limy=geometry.h*(camera.zoom-1)/2;camera.x=Math.max(-limx,Math.min(limx,camera.x));camera.y=Math.max(-limy,Math.min(limy,camera.y));}
function fitPoints(){
  mapPoints=buildMapPoints();if(!mapPoints.length){toast('No mapped points match these filters.');return;}
  if(state.projection==='globe'&&globeEngine&&!globeFailed){globeEngine.fit(mapPoints);requestMap();return;}
  const pts=mapPoints.map(p=>projected(p.lat,p.lon,state.projection,geometry,rotation)).filter(p=>p.visible);if(!pts.length){resetMap();return;}
  const minx=Math.min(...pts.map(p=>p.x)),maxx=Math.max(...pts.map(p=>p.x)),miny=Math.min(...pts.map(p=>p.y)),maxy=Math.max(...pts.map(p=>p.y));
  const z=Math.max(1,Math.min(8,(geometry.w-90)/Math.max(45,maxx-minx),(geometry.h-70)/Math.max(45,maxy-miny)));
  camera={zoom:z,x:(geometry.w/2-(minx+maxx)/2)*z,y:(geometry.h/2-(miny+maxy)/2)*z};clampCamera();requestMap();
}
function mapInteractions(){
  const svg=$('atlasMap');let drag=null;
  const point=e=>{const r=svg.getBoundingClientRect();return{x:(e.clientX-r.left)*geometry.w/r.width,y:(e.clientY-r.top)*geometry.h/r.height};};
  svg.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15,point(e));},{passive:false});
  svg.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('.marker'))return;stopSpin();drag={x:e.clientX,y:e.clientY,camera:{...camera},rotation:{...rotation}};svg.setPointerCapture(e.pointerId);svg.classList.add('dragging');});
  svg.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(state.projection==='globe'){rotation.lon=drag.rotation.lon-dx*.32;rotation.lat=Math.max(-89,Math.min(89,drag.rotation.lat+dy*.32));}else{camera.x=drag.camera.x+dx;camera.y=drag.camera.y+dy;clampCamera();}requestMap();});
  const end=e=>{drag=null;svg.classList.remove('dragging');try{svg.releasePointerCapture(e.pointerId);}catch(_){}};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  svg.addEventListener('keydown',e=>{if(e.target.closest('.marker'))return;if(['+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))e.preventDefault();else return;
    if(e.key==='+'||e.key==='=')zoom(1.3);else if(e.key==='-')zoom(1/1.3);else if(e.key==='Home')resetMap();else if(state.projection==='globe'){rotation.lon+=e.key==='ArrowLeft'?-10:e.key==='ArrowRight'?10:0;rotation.lat=Math.max(-89,Math.min(89,rotation.lat+(e.key==='ArrowUp'?10:e.key==='ArrowDown'?-10:0)));requestMap();}else{camera.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;camera.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;clampCamera();requestMap();}});
  $('zoomIn').onclick=()=>zoom(1.35);$('zoomOut').onclick=()=>zoom(1/1.35);$('mapReset').onclick=()=>{stopSpin();resetMap();};$('fit').onclick=fitPoints;
  document.querySelectorAll('[data-projection]').forEach(b=>b.onclick=()=>{stopSpin();state.projection=b.dataset.projection;camera={zoom:1,x:0,y:0};changed();});
}
function stopSpin(){clearInterval(spinTimer);spinTimer=null;if($('globeSpin')){$('globeSpin').setAttribute('aria-pressed','false');$('globeSpin').textContent='Rotate';}}

function createClassicGlobe(){
  const THREE=window.THREE;if(!THREE)throw new Error('Bundled Three.js unavailable');
  const canvas=$('classicGlobe'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
  const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(38,1,.01,100),R=1;
  const orbit={radius:3.6,theta:315*rad,phi:.62},DEFAULT={...orbit};
  const vec=(lat,lon,r=1)=>{const phi=(90-lat)*rad,th=(lon+180)*rad;return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(th),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(th));};
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R,64,64),new THREE.MeshStandardMaterial({color:0x51433b,roughness:.95,metalness:.05,emissive:0x211a16,emissiveIntensity:.6})));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R*1.05,48,48),new THREE.MeshBasicMaterial({color:0xae8c76,transparent:true,opacity:.10,side:THREE.BackSide})));
  const gratMat=new THREE.LineBasicMaterial({color:0xb69885,transparent:true,opacity:.35});
  const addLine=(pts,mat)=>scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat));
  for(let lat=-60;lat<=80;lat+=20)addLine(Array.from({length:91},(_,i)=>vec(lat,-180+i*4,1.001)),gratMat);
  for(let lon=-180;lon<180;lon+=30)addLine(Array.from({length:43},(_,i)=>vec(-80+i*4,lon,1.001)),gratMat);
  const coastMat=new THREE.LineBasicMaterial({color:0xd1b9a8,transparent:true,opacity:.5});
  for(const ring of polygons){let segment=[];for(const [lon,lat]of ring){const p=vec(lat,lon,1.002);if(segment.length&&p.distanceTo(segment[segment.length-1])>.35){if(segment.length>1)addLine(segment,coastMat);segment=[];}segment.push(p);}if(segment.length>1)addLine(segment,coastMat);}
  const pole=new THREE.Mesh(new THREE.SphereGeometry(.008,12,12),new THREE.MeshBasicMaterial({color:0xf0d9c6}));pole.position.copy(vec(90,0,1.01));scene.add(pole);
  scene.add(new THREE.AmbientLight(0xdfcbb9,.85));const light=new THREE.DirectionalLight(0xffffff,.7);light.position.set(2,3,2);scene.add(light);const rim=new THREE.DirectionalLight(0xe1ac98,.4);rim.position.set(-3,-1,-2);scene.add(rim);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const ctx=glowCanvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.35,'rgba(255,255,255,.5)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const glowTexture=new THREE.CanvasTexture(glowCanvas);
  const markerLayer=new THREE.Group();scene.add(markerLayer);const markers=new Map();let current=[],screenPoints=[],lastW=0,lastH=0;
  const dotGeo=new THREE.SphereGeometry(.0125,14,14),ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
  function place(){cam.position.set(orbit.radius*Math.sin(orbit.phi)*Math.sin(orbit.theta),orbit.radius*Math.cos(orbit.phi),orbit.radius*Math.sin(orbit.phi)*Math.cos(orbit.theta));cam.lookAt(0,0,0);cam.updateMatrixWorld();}
  function createMarker(key){
    const dot=new THREE.Mesh(dotGeo,new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.65,roughness:.4,transparent:true}));
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xffffff,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending}));spr.scale.set(.065,.065,.065);
    const stem=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xdfa89a,transparent:true,opacity:.52}));markerLayer.add(dot,spr,stem);const m={dot,spr,stem};markers.set(key,m);return m;
  }
  function update(points){
    current=points;const {w,h}=geometry;if(w!==lastW||h!==lastH){renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();lastW=w;lastH=h;}place();
    for(const m of markers.values()){m.dot.visible=m.spr.visible=m.stem.visible=false;}
    const projectedPoints=[];
    for(const p of points){const anchor=vec(p.lat,p.lon,1.004),top=vec(p.lat,p.lon,1.055),front=vec(p.lat,p.lon).dot(cam.position)>1;if(!front)continue;const ndc=top.clone().project(cam),x=(ndc.x+1)*w/2,y=(1-ndc.y)*h/2;if(x<0||x>w||y<0||y>h)continue;projectedPoints.push({...p,x,y,z:ndc.z,anchor,top});}
    screenPoints=spreadPoints(projectedPoints,11,{w,h});
    for(const p of screenPoints){const key=p.id+'|'+(p.key||'find'),m=markers.get(key)||createMarker(key),col=state.view==='ages'?AGE_BANDS.find(a=>a.key===DERIVED.get(p.id).age.key).color:TAXA[p.r.species].color;
      const position=new THREE.Vector3(p.x/w*2-1,1-p.y/h*2,p.z).unproject(cam);m.dot.position.copy(position);m.spr.position.copy(position);m.stem.geometry.setFromPoints([p.anchor,position]);
      const style=provenanceOf(p.r).style;
      m.dot.material.color.set(col);m.dot.material.emissive.set(col);m.dot.material.opacity=style==='placeholder'?.45:style==='derived'?.78:1;m.spr.material.color.set(col);m.spr.material.opacity=style==='placeholder'?.18:.42;m.dot.scale.setScalar((p.id===state.selected?1.55:1)*(style==='placeholder'?.85:1));m.spr.scale.setScalar(p.id===state.selected?.105:.065);m.dot.visible=m.spr.visible=m.stem.visible=true;m.dot.userData={id:p.id,point:p};
    }
    renderer.render(scene,cam);return {screenCount:new Set(screenPoints.map(p=>p.id)).size,pointCount:screenPoints.length,offsetCount:screenPoints.filter(p=>p.offset>1).length};
  }
  function pick(e){const rect=canvas.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);ray.setFromCamera(mouse,cam);const hits=ray.intersectObjects([...markers.values()].filter(m=>m.dot.visible).map(m=>m.dot));return hits.length?hits[0].object.userData.point:null;}
  let dragging=false,start=null,moved=false;
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;stopSpin();dragging=true;moved=false;start={x:e.clientX,y:e.clientY,theta:orbit.theta,phi:orbit.phi};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');});
  canvas.addEventListener('pointermove',e=>{
    if(dragging){const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;orbit.theta=start.theta-dx*.006;orbit.phi=Math.max(.12,Math.min(Math.PI-.12,start.phi-dy*.006));$('mapTooltip').hidden=true;requestMap();return;}
    const p=pick(e);canvas.style.cursor=p?'pointer':'grab';if(p){$('mapTooltip').innerHTML=tooltipForPoint(p);$('mapTooltip').hidden=false;positionTip(e);}else $('mapTooltip').hidden=true;
  });
  function end(e,cancelled=false){const wasDragging=dragging;dragging=false;canvas.classList.remove('dragging');try{canvas.releasePointerCapture(e.pointerId);}catch(_){}if(wasDragging&&!moved&&!cancelled){const p=pick(e);if(p)openRecord(p.id);}}
  canvas.addEventListener('pointerup',e=>end(e));canvas.addEventListener('pointercancel',e=>end(e,true));canvas.addEventListener('pointerleave',()=>$('mapTooltip').hidden=true);
  canvas.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();orbit.radius=Math.max(1.55,Math.min(6,orbit.radius*(e.deltaY<0?.9:1.1)));requestMap();},{passive:false});
  canvas.addEventListener('keydown',e=>{if(!['+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();stopSpin();if(e.key==='+'||e.key==='=')orbit.radius=Math.max(1.55,orbit.radius*.85);else if(e.key==='-')orbit.radius=Math.min(6,orbit.radius*1.18);else if(e.key==='Home')Object.assign(orbit,DEFAULT);else{orbit.theta+=e.key==='ArrowLeft'?.12:e.key==='ArrowRight'?-.12:0;orbit.phi=Math.max(.12,Math.min(Math.PI-.12,orbit.phi+(e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0)));}requestMap();});
  return {update,hide(){canvas.setAttribute('hidden','');canvas.setAttribute('aria-hidden','true');},reset(){Object.assign(orbit,DEFAULT);},rotate(delta){orbit.theta-=delta;},zoom(f){orbit.radius=Math.max(1.55,Math.min(6,orbit.radius/f));},fit(points){const v=new THREE.Vector3();points.forEach(p=>v.add(vec(p.lat,p.lon)));v.normalize();orbit.theta=Math.atan2(v.x,v.z);orbit.phi=Math.acos(v.y);orbit.radius=DEFAULT.radius;}};
}


function renderRecordList(){
  const rows=displayedRows();$('listTitle').textContent='Matching records';$('listCaption').textContent=`${visible.length} matching records · Each point opens one record.`;
  $('recordList').innerHTML=rows.length?rows.map(r=>`<button class="record-card${r.id===state.selected?' selected':''}" data-record="${esc(r.id)}" aria-label="Open ${esc(name(r))}, record ${esc(recordID(r))}"><div class="card-meta"><span>${symbolHTML(r.species,15)}${esc(r.species)}</span><span>#${recordID(r)}</span></div><h3>${esc(name(r))}</h3><p>${esc(clean(r.location))} · ${usesSpecimenTime(state)?esc(val(r.age)||'Age not recorded'):(recordYear(r)||'Undated')+(!r.year_found?' (collected)':'')}</p><p class="card-parts">${esc(r.facets.filter(k=>k!=='softgeneric').slice(0,3).map(k=>MATERIALS[k]).join(' · ')||MATERIALS.softgeneric)}</p></button>`).join(''):'<div class="empty-records">No records match. Remove a filter or use Reset all.</div>';
}
const COLUMNS=[{key:'id',label:'Internal ID',get:r=>r.source_id},{key:'name',label:'Specimen',get:name},{key:'taxon',label:'Taxon',get:r=>r.species},{key:'location',label:'Discovery site',get:r=>clean(r.location)},{key:'provenance',label:'Coordinate provenance',get:r=>provenanceOf(r).label},{key:'year',label:'Discovery year',get:r=>recordYear(r)},{key:'age',label:'Age as recorded',get:r=>val(r.age)}];
function renderTable(){
  if(state.view!=='table')return;
  $('tableHead').innerHTML='<tr>'+COLUMNS.map(c=>`<th scope="col"${c.key===tableSort.key?` aria-sort="${tableSort.dir===1?'ascending':'descending'}"`:''}><button data-sort="${c.key}">${esc(c.label)}${c.key===tableSort.key?(tableSort.dir===1?' ↑':' ↓'):''}</button></th>`).join('')+'</tr>';
  const col=COLUMNS.find(c=>c.key===tableSort.key),rows=[...visible].sort((a,b)=>{const A=col.get(a)??'',B=col.get(b)??'';return (typeof A==='number'&&typeof B==='number'?A-B:String(A).localeCompare(String(B)))*tableSort.dir||a.source_row-b.source_row;});
  $('tableBody').innerHTML=rows.length?rows.map(r=>`<tr class="${r.id===state.selected?'selected':''}"><td>${esc(recordID(r))}</td><td><button class="record-link" data-record="${esc(r.id)}">${esc(name(r))}</button><small><i>${esc(r.binomial)}</i></small></td><td>${symbolHTML(r.species,14)} ${esc(r.species)}</td><td>${esc(clean(r.location))}<small>${hasCoords(r)?esc(r.lat+', '+r.lon):'No coordinates recorded'}</small></td><td>${provenanceSymbol(provenanceOf(r).style,13)} ${esc(provenanceOf(r).label)}<small>${esc(STYLE_TEXT[provenanceOf(r).style])}</small></td><td>${recordYear(r)||'Not recorded'}${!r.year_found?'<small>Collection year</small>':''}</td><td>${esc(val(r.age))}<small>${esc(DERIVED.get(r.id).age.basis)}</small></td></tr>`).join(''):`<tr><td colspan="${COLUMNS.length}">No records match these filters.</td></tr>`;
}
function field(label,p,long=false){const raw=val(p),missing=['na','blank'].includes(status(p));return `<div class="field${long?' long':''}"><dt>${esc(label)}</dt><dd class="${missing?'missing':''}">${esc(raw==null||raw===''?'Blank in workbook':raw)}${status(p)==='q'?' <span class="badge">Uncertain / unknown in source</span>':''}</dd></div>`;}
function renderRecord(r){
  const d=DERIVED.get(r.id),rows=displayedRows(),idx=rows.findIndex(o=>o.id===r.id);
  $('recordPosition').textContent=`Record #${recordID(r)} · ${idx+1} of ${rows.length} matches`;$('prevRecord').disabled=idx<=0;$('nextRecord').disabled=idx<0||idx>=rows.length-1;
  $('recordContent').innerHTML=`<div class="record-hero"><div class="record-taxonomy">${symbolHTML(r.species)}${esc(r.species)} · Record #${recordID(r)}</div><h2 id="recordTitle">${esc(name(r))}</h2><p class="binomial">${esc(r.binomial)}</p><div class="record-quick"><span>${esc(clean(r.location))}</span><span>${recordYear(r)||'Date unknown'}${!r.year_found?' (collection)':''}</span></div></div>
  <div class="record-body">${r.review_notes.length?`<section class="record-section"><h3>Source review notes</h3>${r.review_notes.map(note=>`<p class="record-note">${esc(note)}</p>`).join('')}</section>`:''}
    <section class="record-section"><h3>Preserved material</h3><div class="material-tags">${r.facets.map(k=>`<span class="material-tag">${esc(MATERIALS[k]||k)}</span>`).join('')}</div><dl>${field('Parts found',r.parts,true)}${field('Completeness',r.complete)}</dl><p class="record-note">Completeness follows the workbook’s Complete? field. Material tags are derived from the current description; they are browsing aids and can be checked against the source wording above.</p></section>
    <section class="record-section"><h3>Discovery site &amp; chronology</h3><dl>${field('Locality',r.location)}${field('Discovery date',r.date_found)}${field('Collection date',r.date_coll)}${field('Chronology year',recordYear(r)?recordYear(r)+' · '+yearBasis(r):'Not recorded')}${field('Map coordinate',hasCoords(r)?`${r.lat}, ${r.lon}`:'Not mapped')}${field('Coordinate provenance',r.coordinate_label?r.coordinate_label+' · '+STYLE_TEXT[provenanceOf(r).style]:'No label recorded')}${field('Latitude cell',r.lat_raw)}${field('Longitude cell',r.lon_raw)}</dl><p class="record-note">Coordinates and the provenance label come from the workbook’s Latitude, Longitude and Location Provenance cells. Placeholder and inferred positions are drawn with hollow or dashed symbols; no accuracy class is inferred from the number of decimal places.</p></section>
    <section class="record-section"><h3>Specimen age</h3><p class="record-note">Reproduced as recorded from the source. No translation, standardization or recalibration has been applied.</p><dl>${field('Age as recorded',r.age,true)}${field('Atlas reading of notation',d.age.basis)}</dl>${d.age.values.length?`<p class="record-note">${d.age.kind==='lower'?'This is a lower bound, not a point estimate.':d.age.kind==='multiple'?'Several values are recorded; the map does not choose between them.':d.age.kind==='range'?'The recorded range is retained.':d.age.kind==='uncertainty'?'The stated uncertainty is retained.':'The map uses the numeric value for a broad browsing band.'} Calibrated and other BP values have not been converted to a shared timescale.</p>`:''}</section>
    <section class="record-section"><h3>Additional identity fields</h3><dl>${field('Common name',r.common_name)}${field('Binomial',r.binomial)}${field('Former classification',r.former_classification)}${field('Secondary name',r.secondary)}</dl></section>
    <section class="record-section"><h3>Sources</h3><dl>${field('Published reference keys',r.published_ref,true)}${field('Archival reference keys',r.archival_ref,true)}</dl><p class="record-note">Reference keys are reproduced from the dataset. Consult the full bibliography and archival references before citing the underlying sources.</p></section>
    ${status(r.notes)==='val'?`<section class="record-section"><h3>Workbook note</h3><dl>${field('Note as entered',r.notes,true)}</dl><p class="record-note workbook-note">This text sits in a workbook column without a header. It is reproduced as found and is not searched for coordinates or ages.</p></section>`:''}

  </div>`;

}
function openRecord(id){if(!BY_ID.has(id)||!visible.some(r=>r.id===id))return;stopPlay();stopSpin();state.selected=id;renderRecord(BY_ID.get(id));const dlg=$('recordDialog');if(!dlg.open){previousFocus=document.activeElement;dlg.showModal();document.body.classList.add('modal-open');}$('recordDialog').scrollTop=0;renderMap();renderRecordList();renderTable();syncURL();}
function closeRecord(){state.selected=null;$('recordDialog').close();}
function nextRecord(delta){const rows=displayedRows(),idx=rows.findIndex(r=>r.id===state.selected),r=rows[idx+delta];if(r)openRecord(r.id);}
function openAbout(){stopPlay();stopSpin();$('aboutDialog').showModal();document.body.classList.add('modal-open');}
function switchView(view){
  if(!['sites','ages','table'].includes(view))return;
  const enteringTable=view==='table'&&state.view!=='table';
  stopPlay();stopSpin();
  if(enteringTable)state.tableTime=state.view==='ages'?'specimen':'discovery';
  state.view=view;syncViewPanels();changed();
  if(enteringTable)document.querySelector('.table-scroll').scrollTop=0;
}
function initEvents(){
  $('reset').onclick=resetFilters;$('emptyReset').onclick=resetFilters;$('taxaAll').onclick=()=>{state.taxa=new Set(Object.keys(TAXA));changed();};$('taxaNone').onclick=()=>{state.taxa.clear();changed();};
  $('search').oninput=e=>{state.query=e.target.value;changed();};
  for(const k of ['mapped','age'])$(k+'Filter').onchange=e=>{state[k]=e.target.value;changed();};
  $('provAll').onclick=()=>{state.provenance=new Set(Object.keys(PROVENANCE));changed();};$('provNone').onclick=()=>{state.provenance.clear();changed();};
  $('timeMode').onchange=e=>{state.mode=e.target.value;if(state.mode==='through')state.start=MIN;changed();};
  $('timeReset').onclick=()=>{state.mode='through';state.start=MIN;state.end=MAX;changed();};
  const setYear=(key,input)=>{const n=Number(input.value);if(!Number.isInteger(n)||n<MIN||n>MAX){input.value=state[key];toast(`Enter a year from ${MIN} to ${MAX}.`);return;}state[key]=n;if(state.start>state.end){if(key==='start')state.end=state.start;else state.start=state.end;}changed();};
  $('startYear').onchange=()=>setYear('start',$('startYear'));$('endYear').onchange=()=>setYear('end',$('endYear'));$('yearRange').oninput=()=>setYear('end',$('yearRange'));
  $('play').onclick=()=>{if(timer){stopPlay();return;}state.mode='through';state.start=MIN;if(state.end>=MAX)state.end=MIN;timer=setInterval(()=>{state.end=Math.min(MAX,state.end+1);changed({keepPlaying:true});if(state.end===MAX)stopPlay();},90);$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause discovery chronology');changed({keepPlaying:true});};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  document.querySelector('.view-tabs').onkeydown=e=>{const tabs=[...document.querySelectorAll('[data-view]')],idx=tabs.indexOf(document.activeElement);if(idx<0)return;let next;if(e.key==='ArrowRight')next=(idx+1)%tabs.length;else if(e.key==='ArrowLeft')next=(idx-1+tabs.length)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();tabs[next].focus();switchView(tabs[next].dataset.view);};
  $('recordList').onclick=e=>{const b=e.target.closest('[data-record]');if(b)openRecord(b.dataset.record);};$('tableBody').onclick=e=>{const b=e.target.closest('[data-record]');if(b)openRecord(b.dataset.record);};
  $('sort').onchange=e=>{sort=e.target.value;renderRecordList();};
  $('tableHead').onclick=e=>{const b=e.target.closest('[data-sort]');if(!b)return;tableSort={key:b.dataset.sort,dir:tableSort.key===b.dataset.sort?-tableSort.dir:1};renderTable();$('tableHead').querySelector(`[data-sort="${tableSort.key}"]`).focus();};
  $('closeRecord').onclick=closeRecord;$('prevRecord').onclick=()=>nextRecord(-1);$('nextRecord').onclick=()=>nextRecord(1);
  $('recordDialog').addEventListener('close',()=>{if(restoringHash){restoringHash=false;return;}document.body.classList.remove('modal-open');state.selected=null;renderMap();renderRecordList();renderTable();syncURL();if(previousFocus?.isConnected)previousFocus.focus();else $('tab-'+state.view).focus();});
  $('aboutOpen').onclick=openAbout;$('footerAbout').onclick=openAbout;$('closeAbout').onclick=()=>$('aboutDialog').close();$('aboutDialog').addEventListener('close',()=>document.body.classList.remove('modal-open'));
  for(const id of ['recordDialog','aboutDialog'])$(id).addEventListener('click',e=>{if(e.target!==$(id))return;const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();});
  window.addEventListener('hashchange',()=>{stopPlay();stopSpin();const restored=parseState(location.hash),id=restored.selected;if($('recordDialog').open){restoringHash=true;$('recordDialog').close();document.body.classList.remove('modal-open');}state=restored;changed();if(id!=null&&visible.some(r=>r.id===id))openRecord(id);});
  window.addEventListener('resize',()=>{camera={zoom:1,x:0,y:0};requestMap();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPlay();stopSpin();}});
}
configureDatasetLink();buildFilters();initEvents();initAgeEvents();mapInteractions();
if(matchMedia('(max-width: 700px)').matches)document.querySelectorAll('.filter-section').forEach(d=>d.open=false);
// Rotation starts only on request and stops when the tab or page becomes inactive.
const spin=$('globeSpin');
spin.onclick=()=>{if(spinTimer){stopSpin();return;}state.projection='globe';camera={zoom:1,x:0,y:0};changed();spin.setAttribute('aria-pressed','true');spin.textContent='Pause rotation';spinTimer=setInterval(()=>{if(globeEngine)globeEngine.rotate(.006);else rotation.lon=(rotation.lon+.4)%360;requestMap();},65);};
const initialSelected=state.selected;changed();if(initialSelected!=null&&visible.some(r=>r.id===initialSelected))openRecord(initialSelected);
})();


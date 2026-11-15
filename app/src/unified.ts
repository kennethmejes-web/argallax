// AI-assisted code. Licensed under Apache-2.0.
import { annual, fmt, MONTHS_LONG } from './data';
import { $, atlas, cur, esc, goTo, monthIndex, monthLabel, onRender, presetIndex, readHash, refresh, selectMonth, selectYear, setBox, setMapPeriod, setMeasure, setSeries, setYears, shown, start, state, verdict } from './core';
import { initMap } from './map';
import { annualChart, benchLimits, benchMethod, benchSelection, benchSources, copyRecord, download, downloadCalendar, downloadHotspots, evidenceRecord, renderDownloads, switchFinding } from './science';
import { renderCalendar, renderMonthChart, summaryHtml } from './views';
import { renderSwitch, switchKeys } from './switch';

const convertedCaption='Aqua values are scaled to the S-NPP level, so the step is removed by construction. This says nothing about whether burning changed.';
let lastSelection='',evidenceKey='';
const detailsOpen=(id:string)=>id==='monthly-calendar'?!$('calendar-drawer').hidden:id==='explanation'?!$('story-drawer').hidden:$<HTMLDetailsElement>(id).open;
let jump:string|null=null;

export async function initUnified(){
  await atlas.load();
  const fresh=!location.hash;const saved=readHash();state.view='living';state.intro=0;if(fresh)state.series='raw';
  setBox(saved.box??atlas.aoiBox(),undefined,true);
  if(saved.month){const i=monthIndex(saved.month);if(i>=0)state.sel=state.focus=i;}
  const full=atlas.series(atlas.mask(atlas.snap(atlas.aoiBox())),'whole_area'),a=annual(full);
  const avg=(lo:number,hi:number)=>{const ys=a.filter(y=>y.year>=lo&&y.year<=hi);return ys.reduce((s,y)=>s+y.raw,0)/ys.length;};
  // The approved rounded result is recorded in the review; fail closed if data drifts.
  const ratio=(avg(2013,2021)/avg(2003,2011)).toFixed(1);if(ratio!=='5.2')throw new Error('The whole-area satellite-switch result differs from the approved science review.');jump=ratio+'×';
  $('area-select').innerHTML='<option value="0">Whole screening area</option>'+atlas.meta.regions.map((r,i)=>`<option value="${i+1}">${esc(r.name)} (latitude band)</option>`).join('')+'<option value="custom" disabled>Custom box</option>';
  $('area-select').addEventListener('change',()=>{const n=+$<HTMLSelectElement>('area-select').value;setBox(n===0?atlas.aoiBox():atlas.regionBox(n-1));});
  $('go-month').innerHTML=MONTHS_LONG.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
  const years=Array.from(new Set(state.pts.map(p=>p.year)));
  $('go-year').innerHTML=years.map(y=>`<option>${y}</option>`).join('');
  const date=()=>{
    const year=+$<HTMLSelectElement>('go-year').value,month=+$<HTMLSelectElement>('go-month').value;
    goTo(year,month);
    if(cur()!.year!==year||cur()!.cal!==month)$('change-status').textContent=`${MONTHS_LONG[month-1]} ${year} is outside the available record. Showing ${monthLabel(cur()!)}.`;
  };
  $('go-month').addEventListener('change',date);$('go-year').addEventListener('change',date);
  $('coordinate-form').addEventListener('submit',ev=>{
    ev.preventDefault();const read=(k:string)=>+$<HTMLInputElement>('in-'+k).value;
    const b={w:read('w'),s:read('s'),e:read('e'),n:read('n')},a=atlas.aoiBox();
    if(!Object.values(b).every(Number.isFinite)||b.w>=b.e||b.s>=b.n||b.e<a.w||b.w>a.e||b.n<a.s||b.s>a.n){$('coordinate-status').textContent='Use an ordered rectangle that overlaps the screening area.';return;}
    setBox(b,'Custom box');$('coordinate-status').textContent='Applied, snapped to the grid.';
    document.querySelector<HTMLDetailsElement>('.coords-toggle')!.open=false;
  });
  for(const s of document.querySelectorAll<HTMLSelectElement>('select.y0,select.y1')){
    s.innerHTML=years.map(y=>`<option>${y}</option>`).join('');
    s.addEventListener('change',()=>{const other=s.closest('.years')!.querySelector<HTMLSelectElement>(s.classList.contains('y0')?'select.y1':'select.y0')!;s.classList.contains('y0')?setYears(+s.value,+other.value):setYears(+other.value,+s.value);});
  }
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.addEventListener('click',()=>setSeries(b.dataset.mode as 'raw'|'harm'));
  for(const b of $('map-period').querySelectorAll<HTMLButtonElement>('button'))b.addEventListener('click',()=>setMapPeriod(b.dataset.v as 'month'|'year'|'avg'));
  $('measure-counts').addEventListener('click',()=>setMeasure('counts'));$('measure-anom').addEventListener('click',()=>setMeasure('anom'));
  const drawer=(btn:string,id:string,render:()=>void)=>$(btn).addEventListener('click',()=>{const d=$(id),open=d.hidden;d.hidden=!open;$(btn).setAttribute('aria-expanded',String(open));if(open){render();d.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}});
  drawer('open-calendar','calendar-drawer',renderCalendar);
  for(const a of document.querySelectorAll<HTMLAnchorElement>('.jump a[data-open]'))a.addEventListener('click',ev=>{ev.preventDefault();if(a.dataset.open==='calendar'){if($('calendar-drawer').hidden)$('open-calendar').click();else $('calendar-drawer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}else $('open-evidence').click();});
  $('open-evidence').addEventListener('click',()=>{const d=$<HTMLDetailsElement>('evidence');d.open=true;renderEvidence();d.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});drawer('open-story','story-drawer',renderStory);
  $('evidence').addEventListener('toggle',()=>{if(detailsOpen('evidence'))renderEvidence();});
  $('dl-calendar').addEventListener('click',downloadCalendar);
  $('dl-hotspots').addEventListener('click',async()=>{const b=$<HTMLButtonElement>('dl-hotspots');b.disabled=true;try{await downloadHotspots();}catch(e){$('dl-status').textContent='Download failed. Please try again. '+String(e);}finally{b.disabled=false;}});
  switchKeys($('switch'),d=>selectMonth(state.sel+d));
  renderFooter();onRender(renderUnified);initMap();start();
  let frame=0,lastSize='';
  new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const key=`${$('switch').clientWidth}|${$('map').clientWidth}|${$('map').clientHeight}`;if(key===lastSize)return;lastSize=key;refresh();});}).observe($('explorer'));
  window.addEventListener('resize',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>refresh());});
  // One top bar: shortcuts always; a compact month and year picker while the map and reading are on screen.
  const mini=document.querySelector<HTMLElement>('.minibar')!,head=document.querySelector<HTMLElement>('.masthead')!;
  const mm=$<HTMLSelectElement>('mini-month'),my=$<HTMLSelectElement>('mini-year');
  mm.innerHTML=$('go-month').innerHTML;my.innerHTML=$('go-year').innerHTML;
  const mirror=(from:HTMLSelectElement,to:string)=>from.addEventListener('change',()=>{const t=$<HTMLSelectElement>(to);t.value=from.value;t.dispatchEvent(new Event('change'));});
  mirror(mm,'go-month');mirror(my,'go-year');
  let raf=0;const bar=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
    const on=head.getBoundingClientRect().bottom<0,r=$('map-section').getBoundingClientRect(),inMap=on&&document.querySelector('.control-dock')!.getBoundingClientRect().bottom<60&&r.bottom>160;
    document.body.classList.toggle('scrolled',on);document.body.classList.toggle('in-map',inMap);mini.setAttribute('aria-hidden',String(!on));
    for(const a of mini.querySelectorAll<HTMLElement>('a,select'))a.tabIndex=on?0:-1;});};
  addEventListener('scroll',bar,{passive:true});addEventListener('resize',bar);bar();
  document.body.classList.add('ready');
}
function renderUnified(){
  const p=cur()!;
  $<HTMLSelectElement>('area-select').value=presetIndex()<0?'custom':String(presetIndex());
  $<HTMLSelectElement>('go-month').value=String(p.cal);$<HTMLSelectElement>('go-year').value=String(p.year);$<HTMLSelectElement>('mini-month').value=String(p.cal);$<HTMLSelectElement>('mini-year').value=String(p.year);
  for(const[k,v]of Object.entries(state.box)){const el=$<HTMLInputElement>('in-'+k);if(document.activeElement!==el)el.value=String(v);}
  for(const el of document.querySelectorAll<HTMLSelectElement>('select.y0,select.y1'))el.value=String(el.classList.contains('y0')?state.y0:state.y1);
  const key=JSON.stringify(state.box)+'|'+p.month;
  if(key!==lastSelection){$('change-status').textContent=`${state.scopeName} · ${monthLabel(p)}. Map, record and reading follow this selection.`;lastSelection=key;}
  renderReadout();renderOverview();renderDownloads();
  if(detailsOpen('monthly-calendar'))renderCalendar();
  if(detailsOpen('evidence'))renderEvidence();
  if(detailsOpen('explanation'))renderStory();
}
let lastReadKey='',lastValue=NaN;
function renderReadout(){
  const p=cur()!,v=shown(p),vd=verdict(p),M=atlas.meta,readKey=JSON.stringify(state.box)+'|'+p.month,changed=lastReadKey!==''&&readKey!==lastReadKey,from=lastValue;
  const sat=M.sensors.find(s=>s.key===p.era.sensor)!.name;
  const status=p.provisional?'Provisional · near-real-time':p.conv?'Estimated VIIRS-equivalent':'Observed · reference scale';
  const warnings=[];
  if(p.provisional)warnings.push(M.labels.provisional_month);
  if(p.conv)warnings.push(M.labels.pre2012);
  if(!p.era.complete)warnings.push(M.labels.incomplete_month);
  if(state.scope==='other_box')warnings.push('Custom box: ranges are approximate, not validated at this size. No minimum area size is validated.');
  if(state.box.e-state.box.w<M.small_area_warning.threshold_deg||state.box.n-state.box.s<M.small_area_warning.threshold_deg)warnings.push(M.small_area_warning.label);
  if(v===0)warnings.push(M.labels.zero);
  $('readout').innerHTML=`<h2>${esc(monthLabel(p))} · ${esc(state.scopeName)}</h2><p class="reading"><span class="value number" id="readout-value">${fmt(v)}</span><span class="unit">daytime<br>grid-cell-days</span></p>
    <div class="verdict-block"><h3 class="verdict${p.provisional?' provisional':''}">${esc(vd.text)}</h3><p class="ref">${p.ref?`${MONTHS_LONG[p.cal-1]} reference range: <span class="number">${fmt(p.ref.p10)}–${fmt(p.ref.p90)}</span> cell-days<br>Median <span class="number">${fmt(p.ref.p50)}</span> · <span class="number">${p.ref.n}</span> other years${p.ref.early?`, days 1–${M.current_month.elapsed_days} only`:''}`:'Not enough complete months for a historical reference range.'}</p></div>
    <p class="source">Satellite: ${esc(sat)} · ${p.era.complete?'complete month':`days 1–${M.current_month.elapsed_days}`}<br><strong>${status}</strong>${p.era.status==='archive'?' · science-quality archive':''}</p>
    ${warnings.length?`<div class="selection-warnings">${warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</div>`:''}
    <p class="qualifier">Detections are not fire counts or burned area. The historical reference range is descriptive, not a prediction or a significance test.</p>
    <div class="area-summary">${summaryHtml()}</div>`;
  if(readKey!==lastReadKey){lastReadKey=readKey;lastValue=v;}
  if(changed&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const el=$('readout');el.classList.remove('fresh');void el.offsetWidth;el.classList.add('fresh');
    const out=$('readout-value');if(isFinite(from)&&from!==v){const t0=performance.now(),d=450;const tick=(t:number)=>{const k=Math.max(0,Math.min(1,(t-t0)/d)),e=1-Math.pow(1-k,3);out.textContent=fmt(from+(v-from)*e);if(k<1)requestAnimationFrame(tick);else out.textContent=fmt(v);};requestAnimationFrame(tick);}
  }
}
function renderOverview(){
  const raw=state.series==='raw',whole=state.scope==='whole_area';
  renderSwitch($('switch'),whole?jump:null);
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===state.series));
  $('overview-caption').textContent=raw?switchFinding(true):convertedCaption+' Before 2012 the line is Aqua\'s own record scaled up, so its higher early level is not evidence that burning fell.';$('drift-note').hidden=!raw;
  $('hero-scope').innerHTML=`Yearly hotspot cell-days in <strong>${esc(state.scopeName)}</strong>${whole?'':' (follows your selected area)'}`;
  const a=annual(state.pts);$('coverage').textContent=a.length?`Full years only, ${a[0].year}–${a[a.length-1].year}. Partial years are in the monthly calendar.`:'';
}
function renderStory(){
  $('story').innerHTML=`<section><h3>1. Join the recorded values</h3><div id="story-raw" class="chart"></div><p>${esc(switchFinding(true))}</p></section><section><h3>2. Keep the same instrument</h3><div id="story-aqua" class="chart"></div><p>The Aqua MODIS line continues across 2012. Compare it with the joined record for this same area.</p></section><section><h3>3. Convert to one scale</h3><div id="story-harm" class="chart"></div><p>${convertedCaption}</p></section>`;
  annualChart($('story-raw'),{raw:true,aqua:false,harm:false});annualChart($('story-aqua'),{raw:true,aqua:true,harm:false});annualChart($('story-harm'),{raw:false,aqua:false,harm:true});
}
function renderEvidence(){
  const key=`${JSON.stringify(state.box)}|${cur()!.month}|${$('evidence-body').clientWidth}`;
  if(key!==evidenceKey){
    $('evidence-body').innerHTML=`<section class="evidence-selection">${benchSelection()}</section><section><h3>Historical reference range</h3><div id="month-chart" class="chart"></div></section><section>${benchMethod()}<p>Aqua records about 6 times fewer cell-days than S-NPP.</p></section><section>${benchLimits()}</section><section>${benchSources()}</section>`;
    $('rec-copy').addEventListener('click',copyRecord);$('rec-save').addEventListener('click',()=>download(`argallax_evidence_${cur()!.month}.txt`,evidenceRecord(),'text/plain'));evidenceKey=key;
  }
  renderMonthChart(cur()!);
}
function renderFooter(){
  const M=atlas.meta;
  $('footer').innerHTML=`<p><strong>Data.</strong> ${esc(M.credits.data)} We acknowledge the use of data from NASA's Fire Information for Resource Management System (FIRMS) (<a href="${esc(M.credits.citation_url)}">FIRMS citation</a>), part of NASA's Earth Science Data and Information System (ESDIS). Land outline: Natural Earth (public domain), via world-atlas (ISC).</p>
  <p><strong>Software and type.</strong> MapLibre GL JS (BSD-3-Clause), d3-scale-chromatic (ISC), topojson-client (ISC), Vite (MIT). Source Sans 3 (Adobe), self-hosted under the <a href="./licenses/source-sans-3-OFL.txt">SIL Open Font License 1.1</a>.</p>
  <p>ARGALLAX was created by Kenneth Mejes for Project Sidequest, a solo entry in NASA Space Apps Challenge 2026. Development was AI-assisted, with the project direction, scientific decisions, and final accountability held by the creator. AI tools used: Claude and Claude Code (Anthropic); ChatGPT and Codex (OpenAI).</p>
  <p>Code licence: Apache-2.0. Not affiliated with or endorsed by NASA.</p>`;
}

'use strict';

// LegacyScape Atlas. Static, framework-free frontend backed exclusively by data/*.json.
const TYPES = {
  objects: {label:'Objects',one:'Object',letter:'O',samples:['Bank booth','Tree','Door'],columns:['','ID','OBJECT NAME','SIZE','INTERACTIONS','MODELS',''],filters:[['all','All objects'],['named','Named only'],['interactive','Interactive'],['clipped','Clipped'],['models','Has models']]},
  npcs: {label:'NPCs',one:'NPC',letter:'N',samples:['General Graardor','Abyssal demon','Banker'],columns:['','ID','NPC NAME','LEVEL','SIZE','INTERACTIONS',''],filters:[['all','All NPCs'],['named','Named only'],['combat','Combat NPCs'],['noncombat','Non-combat'],['interactive','Interactive']]},
  items: {label:'Items',one:'Item',letter:'I',samples:['Abyssal whip','Blue partyhat','Rune platebody'],columns:['','ID','ITEM NAME','VALUE','STACKABLE','NOTED',''],filters:[['all','All items'],['named','Named only'],['members','Members only'],['stackable','Stackable'],['noted','Noted items'],['equipment','Equipment']]}
};
const $ = s => document.getElementById(s);
const format = n => Number(n||0).toLocaleString('en-GB');
const html = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hasName = r => !!r && !!String(r.name ?? '').trim() && String(r.name).toLowerCase()!=='null';
const name = r => hasName(r) ? String(r.name) : 'Unnamed definition';
const options = r => Array.isArray(r.options) ? r.options.filter(Boolean) : Array.isArray(r.inventoryOptions) ? r.inventoryOptions.filter(Boolean) : [];
const models = r => Array.isArray(r.modelIds) ? r.modelIds.filter(x => Number.isInteger(x)) : Number.isInteger(r.modelId) && r.modelId>0 ? [r.modelId] : [];
const jsValue = value => Array.isArray(value) ? value.join(', ') : typeof value==='boolean' ? (value?'Yes':'No') : value===null || value===undefined || value==='' ? '—' : String(value);
const state = {type:'objects', data:{objects:[],npcs:[],items:[]}, loaded:{objects:false,npcs:false,items:false}, errors:{}, query:'', filter:'all',sort:'id-asc',savedOnly:false,page:1,pageSize:30,results:[],selectedId:null,bookmarks:new Set(),loading:true};
try {const value=JSON.parse(localStorage.getItem('legacyscape-atlas:saved')||'[]');if(Array.isArray(value))state.bookmarks=new Set(value);}catch{}
let lastFocus=null;
let renderTimeout=null;

function notify(message,error=false){const e=$('toast');e.textContent=message;e.className=`toast show${error?' error':''}`;clearTimeout(notify.timer);notify.timer=setTimeout(()=>e.className='toast',3200);}
async function copyText(value){if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(value);return;}const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const done=document.execCommand('copy');area.remove();if(!done)throw Error('Clipboard not available');}
function downloadJSON(filename,obj){const file=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(file);const a=document.createElement('a');a.download=filename;a.href=url;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function saveBookmarks(){try{localStorage.setItem('legacyscape-atlas:saved',JSON.stringify([...state.bookmarks]));}catch{}}
function saveKey(type,id){return `${type}:${id}`;}
function isSaved(type,id){return state.bookmarks.has(saveKey(type,id));}
function toggleSaved(type,id){const key=saveKey(type,id);if(state.bookmarks.has(key))state.bookmarks.delete(key);else state.bookmarks.add(key);saveBookmarks();$('saved-count').textContent=format(state.bookmarks.size);renderList();renderInspector();}
function setHash(type,search){const address='#'+type+(search ? ':'+encodeURIComponent(search):'');if(location.hash!==address)history.replaceState(null,'',address);}
function readHash(){let raw='';try{raw=decodeURIComponent(location.hash.slice(1));}catch{raw=location.hash.slice(1);}const match=raw.match(/^(objects|npcs|items)(?::(.*))?$/i);if(match){state.type=match[1].toLowerCase();state.query=match[2]||'';state.selectedId=/^#?\d+$/.test(state.query)?Number(state.query.replace('#','')):null;}else if(/^\d[\d\s,\-+]*$/.test(raw)){state.type='objects';state.query=raw;state.selectedId=/^\d+$/.test(raw)?Number(raw):null;}}
function lookup(type,id){return state.data[type].find(r=>r.id===Number(id))||null;}
function searchIds(q){let s=q.replace(/^#/, '').trim();if(!s || !/^[\d\s,+-]+$/.test(s) || !/^\d/.test(s))return null;
 const set=new Set();const chunks=s.split(',').map(x=>x.trim());if(chunks.some(x=>!x))return null;
 for(const chunk of chunks){let m=chunk.match(/^(\d+)\s*([-+])\s*(\d+)$/);if(m){const start=Number(m[1]);const end=m[2]==='+'?start+Number(m[3])-1:Number(m[3]);if(end<start || end-start>30000 || !Number.isSafeInteger(end))return null;for(let i=start;i<=end;i++)set.add(i);}else if(/^\d+$/.test(chunk)){set.add(Number(chunk));}else{return null;}}
 return set;
}
function filterRecords(){let records=state.data[state.type];const q=state.query.trim().toLowerCase();const ids=q?searchIds(q):null;
 if(ids) records=records.filter(r=>ids.has(r.id));
 else if(q){const terms=q.split(/\s+/).filter(Boolean);records=records.filter(r=>{const searchable=[r.name,r.id,...options(r)].join(' ').toLowerCase();return terms.every(t=>searchable.includes(t));});}
 if(state.savedOnly)records=records.filter(r=>isSaved(state.type,r.id));
 switch(state.filter){
 case 'named':records=records.filter(hasName);break;
 case 'interactive':records=records.filter(r=>options(r).length>0);break;
 case 'clipped':records=records.filter(r=>r.clipType===2);break;
 case 'models':records=records.filter(r=>models(r).length>0);break;
 case 'combat':records=records.filter(r=>(r.combatLevel||0)>0);break;
 case 'noncombat':records=records.filter(r=>(r.combatLevel||0)===0);break;
 case 'members':records=records.filter(r=>r.members===true);break;
 case 'stackable':records=records.filter(r=>r.stackable===true);break;
 case 'noted':records=records.filter(r=>r.noted===true);break;
 case 'equipment':records=records.filter(r=>r.maleWornModel1>=0 || r.femaleWornModel1>=0);break;
 }
 if(state.sort==='id-desc')records=[...records].reverse();
 if(state.sort==='name-asc')records=[...records].sort((a,b)=>name(a).localeCompare(name(b))||a.id-b.id);
 return records;
}
function badge(text){return `<span class="action-pill">${html(text)}</span>`;}
function actionHtml(r){const actions=options(r);if(!actions.length)return '<span class="muted-cell">—</span>';return `<div class="action-pills" title="${html(actions.join(', '))}">${actions.slice(0,2).map(badge).join('')}${actions.length>2?badge('+'+(actions.length-2)):''}</div>`;}
function rowMarkup(r){const type=state.type,selected=state.selectedId===r.id,saved=isSaved(type,r.id),named=hasName(r);
 let rest='';if(type==='objects')rest=`<td>${html(r.sizeX)} × ${html(r.sizeY)}</td><td>${actionHtml(r)}</td><td>${models(r).length||'<span class="muted-cell">—</span>'}</td>`;
 else if(type==='npcs')rest=`<td>${r.combatLevel>0?`<span class="lvl-pill">Lv. ${html(r.combatLevel)}</span>`:'<span class="muted-cell">—</span>'}</td><td>${html(r.size)}</td><td>${actionHtml(r)}</td>`;
 else rest=`<td>${format(r.value)}</td><td><span class="${r.stackable?'flag-yes':'flag-no'}">${r.stackable?'Yes':'No'}</span></td><td><span class="${r.noted?'flag-yes':'flag-no'}">${r.noted?'Yes':'No'}</span></td>`;
 return `<tr data-id="${r.id}" class="${selected?'row-selected':''}"><td><button type="button" class="star ${saved?'active':''}" title="${saved?'Unsave':'Save'} record" aria-label="${saved?'Unsave':'Save'} ${type} ${r.id}" data-bookmark="${r.id}">${saved?'★':'☆'}</button></td><td><span class="row-id">${r.id}</span></td><td class="cell-name" title="${html(name(r))}">${named?html(name(r)):`<span class="muted-cell">${html(name(r))}</span>`}</td>${rest}<td class="row-view">↗</td></tr>`;
}
function renderList(){if(state.selectedId===null && !state.query && state.loaded[state.type] && !state.savedOnly){state.selectedId=state.data[state.type].find(hasName)?.id??null;}state.results=filterRecords();const records=state.results;const pages=Math.max(1,Math.ceil(records.length/state.pageSize));state.page=Math.min(pages,Math.max(1,state.page));const start=(state.page-1)*state.pageSize;const current=records.slice(start,start+state.pageSize);
 $('result-count').textContent=format(records.length);
 $('table-head').innerHTML=`<tr>${TYPES[state.type].columns.map(c=>`<th>${html(c)}</th>`).join('')}</tr>`;
 $('table-body').innerHTML=current.map(rowMarkup).join('');
 $('no-results').hidden=!!records.length;
 if(!records.length){$('no-results').innerHTML=`<div class="no-symbol">⌕</div><strong>${state.loaded[state.type]?'No matching definitions':'Definitions unavailable'}</strong><p>${state.loaded[state.type]?'Try another name or ID, or reset your filters.':'Add data/'+state.type+'.json and serve the website using start-website.bat.'}</p>`;}
 $('table-head').hidden=!records.length;
 $('page-summary').textContent=records.length?`Showing ${format(start+1)}–${format(start+current.length)} of ${format(records.length)}`:'Showing 0 results';
 $('page-label').textContent=`${state.page} / ${pages}`;$('prev').disabled=state.page===1;$('next').disabled=state.page===pages;
}
function property(label,value){return `<div class="property"><span class="property-label">${html(label)}</span><span class="property-value ${typeof value==='boolean'?(value?'true':'false'):''}">${html(jsValue(value))}</span></div>`;}
function field(label,value){return `<div class="field-row"><span>${html(label)}</span><strong>${html(jsValue(value))}</strong></div>`;}
function section(title,content){return `<div class="property-section"><h3>${html(title)}</h3>${content}</div>`;}
function inspectorFieldList(r){const hide=new Set(['id','name','options','inventoryOptions','modelIds','modelId','modelGroups','recolorFrom','recolorTo','transformIds','groundOptions']);const pairs=Object.entries(r).filter(([k])=>!hide.has(k));return pairs.map(([k,v])=>field(k,v)).join('');}
function renderInspector(){const r=state.selectedId===null?null:lookup(state.type,state.selectedId);if(!r){$('inspector-body').innerHTML='<div class="inspector-empty"><div class="empty-cube">⬡</div><strong>Select a definition</strong><p>Choose a record on the left to inspect its cache properties and raw JSON.</p></div>';return;}
 let basics=[];let extra='';
 if(state.type==='objects'){
 basics=[['Width',r.sizeX],['Length',r.sizeY],['Clipping type',r.clipType],['Projectile clipping',r.projectileClipped]];
 extra=section('Object configuration',`<div class="field-list">${field('No clip',r.noClip)}${field('Config ID',r.configId)}${field('Config file ID',r.configFileId)}${field('Access block flag',r.accessBlockFlag)}${field('Transforms',r.transformIds)}</div>`);
 } else if(state.type==='npcs'){
 basics=[['Combat level',r.combatLevel],['Size',r.size],['Render emote',r.renderEmote],['Visible on map',r.visibleOnMap]];
 extra=section('NPC configuration',`<div class="field-list">${field('Head icons',r.headIcons)}</div>`);
 } else {
 basics=[['Cache value',format(r.value)],['Stackable',r.stackable],['Members',r.members],['Noted',r.noted]];
 extra=section('Item configuration',`<div class="field-list">${field('Lended',r.lended)}${field('Equip slot',r.equipSlot)}${field('Equip type',r.equipType)}${field('Certificate link ID',r.certId)}${field('Lend link ID',r.lendId)}${field('Male worn model 1',r.maleWornModel1)}${field('Female worn model 1',r.femaleWornModel1)}</div>`);
 }
 const actions=options(r),ground=Array.isArray(r.groundOptions)?r.groundOptions:[],modelIds=models(r);
 let sections=section('Core properties',`<div class="property-grid">${basics.map(([k,v])=>property(k,v)).join('')}</div>`);
 sections+=section(state.type==='items'?'Inventory actions':'Interactions',actions.length?`<div class="action-list">${actions.map(a=>`<span class="action-tag">${html(a)}</span>`).join('')}</div>`:'<div class="empty-muted">No available actions in cache</div>');
 if(ground.length)sections+=section('Ground actions',`<div class="action-list">${ground.map(a=>`<span class="action-tag">${html(a)}</span>`).join('')}</div>`);
 sections+=section('Model references',modelIds.length?`<div class="models-list">${modelIds.slice(0,60).map(id=>`<span class="model-tag"><button type="button" data-model="${id}" title="Copy model ID">${id}</button></span>`).join('')}${modelIds.length>60?`<span class="empty-muted">and ${modelIds.length-60} more...</span>`:''}</div>`:'<div class="empty-muted">No model ID in this definition</div>');
 if(state.type==='objects' && Array.isArray(r.modelGroups) && r.modelGroups.length)sections+=section('Model groups',`<div class="field-list">${r.modelGroups.slice(0,20).map((m,i)=>field('Group '+(i+1),m)).join('')}</div>`);
 sections+=extra;
 if(Array.isArray(r.recolorFrom) && r.recolorFrom.length)sections+=section('Recolour mappings',`<div class="field-list">${r.recolorFrom.slice(0,40).map((v,i)=>field(v,r.recolorTo?.[i]??'—')).join('')}</div>`);
 const remaining=inspectorFieldList(r);if(remaining)sections+=section('Additional cache fields',`<div class="field-list">${remaining}</div>`);
 sections+=section('Raw definition JSON',`<details class="raw-details" id="raw-details"><summary>View full JSON (${Object.keys(r).length} fields)</summary><pre class="raw-json" id="raw-json"></pre></details>`);
 $('inspector-body').innerHTML=`<div class="record-cover"><div class="record-type">${html(TYPES[state.type].one.toUpperCase())} / CACHE RECORD</div><h3 class="record-name">${html(name(r))}</h3><div class="record-id">DEFINITION ID <code>#${r.id}</code></div><div class="cover-actions"><button class="cover-action primary" id="copy-id" type="button">⧉ Copy ID</button><button class="cover-action" id="copy-link" type="button">↗ Link</button><button class="cover-action" id="save-record" type="button">${isSaved(state.type,r.id)?'★ Saved':'☆ Save'}</button></div></div>${sections}`;
 $('raw-json').textContent=JSON.stringify(r,null,2);
}
function syncHeader(){for(const type of Object.keys(TYPES)){$('nav-'+type).textContent=state.loaded[type]?format(state.data[type].length):state.loading?'···':'—';$('metric-'+type).textContent=state.loaded[type]?format(state.data[type].length):state.loading?'···':'—';}
 $('saved-count').textContent=format(state.bookmarks.size);
 document.querySelectorAll('[data-nav]').forEach(el=>{const active=el.dataset.nav===state.type;el.classList.toggle('active',active);el.setAttribute('aria-current',active?'page':'false');});
 document.querySelectorAll('[data-stat]').forEach(el=>el.classList.toggle('selected',el.dataset.stat===state.type));
 $('breadcrumb').textContent=TYPES[state.type].label;$('active-type-title').textContent=TYPES[state.type].label;
 $('loaded-tag').textContent=state.loaded[state.type]?'LIVE CACHE JSON':state.loading?'LOADING JSON':'MISSING DATA FILE';
 const indicator=document.querySelector('.dataset-indicator');indicator.classList.toggle('waiting',state.loading);indicator.classList.toggle('error',!state.loading&&!state.loaded[state.type]);
 $('saved-button').classList.toggle('active',state.savedOnly);
 $('filter').innerHTML=TYPES[state.type].filters.map(([key,label])=>`<option value="${html(key)}">${html(label)}</option>`).join('');$('filter').value=state.filter;
 $('sort').value=state.sort;$('search').value=state.query;
 $('examples').innerHTML='<span class="example-label">TRY:</span>'+TYPES[state.type].samples.map(s=>`<button class="example-button" type="button" data-example="${html(s)}">${html(s)}</button>`).join('');
 const count=Object.values(state.loaded).filter(Boolean).length;$('source-progress').style.width=`${count/3*100}%`;
 $('side-status').textContent=state.loading?'Loading definitions':count===3?'All databases ready':count===0?'No JSON datasets':`${count} of 3 datasets loaded`;
 $('side-substatus').textContent=state.loading?'Reading cache exports...':count===3?'3 files verified · Local mode':count===0?'See setup instructions':'Check missing data/*.json files';
}
function render(){syncHeader();renderList();renderInspector();}
function changeType(type,query='',id=null){if(!TYPES[type])return;state.type=type;state.query=query;state.filter='all';state.page=1;state.savedOnly=false;state.selectedId=id;setHash(type,query);render();closeMenu();}
function showRecord(id){if(!lookup(state.type,id))return;state.selectedId=id;setHash(state.type,String(id));renderList();renderInspector();if(window.innerWidth<=1050){$('inspector-body').scrollTop=0;}
}
function submitSearch(q){state.query=q;state.page=1;const isSingle=/^#?\d+$/.test(q.trim());state.selectedId=isSingle?Number(q.trim().replace('#','')):null;setHash(state.type,q.trim());renderList();renderInspector();}
function closeMenu(){$('sidebar').classList.remove('open');$('sidebar-scrim').hidden=true;}
function page(delta){const max=Math.ceil(state.results.length/state.pageSize)||1;state.page=Math.min(max,Math.max(1,state.page+delta));renderList();}
function bindEvents(){document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>changeType(el.dataset.nav)));document.querySelectorAll('[data-stat]').forEach(el=>el.addEventListener('click',()=>changeType(el.dataset.stat)));
 document.querySelectorAll('[data-quick]').forEach(el=>el.addEventListener('click',()=>{const [type,id]=el.dataset.quick.split(':');changeType(type,id,Number(id));document.getElementById('explorer').scrollIntoView({behavior:'smooth',block:'start'});}));
 $('search').addEventListener('input',e=>{const value=e.target.value;clearTimeout(renderTimeout);renderTimeout=setTimeout(()=>submitSearch(value),90);});
 $('filter').addEventListener('change',e=>{state.filter=e.target.value;state.page=1;renderList();});
 $('sort').addEventListener('change',e=>{state.sort=e.target.value;state.page=1;renderList();});
 $('clear').addEventListener('click',()=>{state.query='';state.filter='all';state.sort='id-asc';state.savedOnly=false;state.page=1;state.selectedId=null;setHash(state.type,'');render();});
 $('examples').addEventListener('click',e=>{const btn=e.target.closest('[data-example]');if(!btn)return;state.query=btn.dataset.example;$('search').value=state.query;submitSearch(state.query);});
 $('table-body').addEventListener('click',e=>{const button=e.target.closest('[data-bookmark]');if(button){toggleSaved(state.type,Number(button.dataset.bookmark));return;}const row=e.target.closest('tr[data-id]');if(row)showRecord(Number(row.dataset.id));});
 $('inspector-body').addEventListener('click',async e=>{const id=state.selectedId,r=id===null?null:lookup(state.type,id);if(!r)return;try{if(e.target.closest('#copy-id')){await copyText(String(id));notify('Definition ID copied');}else if(e.target.closest('#copy-link')){await copyText(`${location.origin}${location.pathname}#${state.type}:${id}`);notify('Direct link copied');}else if(e.target.closest('#save-record')){toggleSaved(state.type,id);notify(isSaved(state.type,id)?'Saved to bookmarks':'Removed from bookmarks');}else if(e.target.closest('[data-model]')){await copyText(e.target.closest('[data-model]').dataset.model);notify('Model ID copied');}}catch{notify('Clipboard is not available',true);}});
 $('prev').addEventListener('click',()=>page(-1));$('next').addEventListener('click',()=>page(1));
 $('saved-button').addEventListener('click',()=>{state.savedOnly=!state.savedOnly;state.page=1;render();closeMenu();});
 $('export').addEventListener('click',()=>{if(!state.results.length){notify('No records to export',true);return;}downloadJSON(`rs667-${state.type}-results.json`,state.results);notify(`Exported ${format(state.results.length)} definitions`);});
 $('share-top').addEventListener('click',async()=>{try{await copyText(location.href);notify('Page URL copied');}catch{notify('Unable to copy link',true);}});
 $('help-button').addEventListener('click',()=>{$('help-dialog').showModal();closeMenu();});$('close-help').addEventListener('click',()=>$('help-dialog').close());$('done-help').addEventListener('click',()=>$('help-dialog').close());
 $('mobile-menu').addEventListener('click',()=>{$('sidebar').classList.add('open');$('sidebar-scrim').hidden=false;});$('sidebar-scrim').addEventListener('click',closeMenu);
 document.addEventListener('keydown',e=>{const element=document.activeElement;const typing=element && ['INPUT','TEXTAREA','SELECT'].includes(element.tagName);if(e.key==='/'&&!typing&&!$('help-dialog').open){e.preventDefault();$('search').focus();}if(e.key==='Escape'){closeMenu();if(document.activeElement===$('search'))$('search').blur();}if(!typing&&!$('help-dialog').open && e.key==='ArrowLeft')page(-1);if(!typing&&!$('help-dialog').open && e.key==='ArrowRight')page(1);});
 window.addEventListener('hashchange',()=>{readHash();state.page=1;state.filter='all';render();});
}
async function loadAll(){const tasks=Object.keys(TYPES).map(async type=>{try{const res=await fetch(`data/${type}.json`,{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);const values=await res.json();if(!Array.isArray(values))throw Error('Expected JSON array');if(!values.length)throw Error('Empty array');const valid=values.filter(x=>x && typeof x==='object' && Number.isSafeInteger(x.id) && x.id>=0);if(!valid.length)throw Error('No usable records');state.data[type]=valid;state.loaded[type]=true;}catch(err){state.errors[type]=String(err.message||err);}syncHeader();if(state.type===type){renderList();renderInspector();}});await Promise.all(tasks);state.loading=false;syncHeader();renderList();renderInspector();if(Object.keys(state.errors).length)console.warn('Atlas JSON loading issues:',state.errors);}
readHash();bindEvents();render();loadAll();

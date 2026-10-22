"use strict";
(() => {
  const $=id=>document.getElementById(id),base=new URL('./',document.baseURI),key='paperflow:metrics:v1:'+base.pathname,schema='paperflow.metric-notebook/v1';
  const definitions={net_rate:{label:'净速率',units:{'Gb/s':1,'Tb/s':1000,'Mb/s':0.001},standard:'Gb/s'},gross_rate:{label:'总速率',units:{'Gb/s':1,'Tb/s':1000,'Mb/s':0.001},standard:'Gb/s'},baud:{label:'符号率',units:{GBd:1,MBd:0.001},standard:'GBd'},distance:{label:'传输距离',units:{km:1,m:0.001},standard:'km'},bandwidth:{label:'带宽',units:{GHz:1,MHz:0.001,THz:1000},standard:'GHz'},ber:{label:'误码率 BER',units:{'无量纲':1},standard:'无量纲'},ngmi:{label:'NGMI',units:{'无量纲':1},standard:'无量纲'},osnr:{label:'OSNR',units:{dB:1},standard:'dB'},energy:{label:'每比特能耗',units:{'pJ/bit':1,'fJ/bit':0.001,'nJ/bit':1000},standard:'pJ/bit'},power:{label:'功耗',units:{W:1,mW:0.001},standard:'W'}};
  const basis={simulation:'仿真',offline:'离线实验',realtime:'实时实验',field:'现场试验',theory:'理论分析',unknown:'原文未明确'};
  let state={schema,entries:[]},blocked=false,items=[],loadFailed=false,editingRevision=null;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  function message(t){$('metrics-status').textContent=t;}
  const text=(s,n)=>typeof s==='string'&&s.length<=n,id=s=>text(s,128)&&/^[-\w]+$/.test(s);
  function numeric(value){return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(value.trim())&&Number.isFinite(Number(value));}
  function normalize(category,value,unit){const d=definitions[category];if(!d||!Object.hasOwn(d.units,unit)||!numeric(value))return null;const number=Number(value)*d.units[unit];return Number.isFinite(number)?{value:Number(number.toPrecision(10)),unit:d.standard}:null;}
  function valid(v){
    if(v?.schema!==schema||!Array.isArray(v.entries)||v.entries.length>2000)throw Error('备份格式或数量不正确');
    const entries=v.entries.map(m=>{
      if(!id(m.id)||!id(m.record_id)||!Number.isInteger(m.revision)||m.revision<1||!text(m.title,2000)||!Object.hasOwn(definitions,m.category)||!text(m.value,60)||!normalize(m.category,m.value,m.unit)||!Object.hasOwn(basis,m.basis)||!text(m.conditions,2000)||!m.conditions.trim()||!text(m.baseline,1000)||!m.baseline.trim()||!text(m.locator,300)||!m.locator.trim()||!text(m.quote,1000)||!m.quote.trim()||!text(m.source_url,2000)||!text(m.updated_at,40)||!/^\d{4}-\d\d-\d\dT/.test(m.updated_at)||!Number.isFinite(Date.parse(m.updated_at)))throw Error('指标字段不完整');
      const u=new URL(m.source_url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('来源网址不正确');
      if(['ber','ngmi'].includes(m.category)&&(Number(m.value)<0||Number(m.value)>1)||m.category!=='osnr'&&Number(m.value)<0)throw Error('数值超出该指标范围');
      return Object.fromEntries(['id','record_id','revision','title','category','value','unit','basis','conditions','baseline','locator','quote','source_url','updated_at'].map(k=>[k,m[k]]));
    });if(new Set(entries.map(m=>m.id)).size!==entries.length)throw Error('指标编号重复');return {schema,entries};
  }
  function read(){try{const raw=localStorage.getItem(key);state=raw?valid(JSON.parse(raw)):{schema,entries:[]};blocked=false;}catch(_){blocked=true;state={schema,entries:[]};message('指标存储不可用，已停止写入并保留原数据。请导出原始备份检查。');}}
  function save(next){if(blocked){message('存储不可用，未覆盖原数据。');return false;}try{next=valid(next);localStorage.setItem(key,JSON.stringify(next));state=next;render();return true;}catch(e){message('保存失败：'+e.message);return false;}}
  function unitOptions(value){$('metric-unit').replaceChildren(...Object.keys(definitions[$('metric-category').value].units).map(u=>new Option(u,u)));if(value)$('metric-unit').value=value;}
  function clear(){ $('metric-form').reset();$('metric-id').value='';editingRevision=null;unitOptions();$('metric-submit').textContent='保存个人指标'; }
  const selected=()=>window.PaperFlowResearch?.getState().compare||[];
  function formatted(m){const n=normalize(m.category,m.value,m.unit);return `${m.value} ${m.unit}`+(n&&m.unit!==n.unit?`（${n.value} ${n.unit}）`:'');}
  function render(){
    const list=$('metrics-list');list.replaceChildren();$('metrics-count').textContent=state.entries.length+' 条';
    if(!state.entries.length)list.append(el('p','还没有记录。先从原文确认一个指标，再把实验条件一起记下来。','empty-hint'));
    for(const m of [...state.entries].sort((a,b)=>b.updated_at.localeCompare(a.updated_at))){const p=items.find(i=>i.record_id===m.record_id),box=el('article',undefined,'metric-record');box.append(el('p',m.title,'fine'),el('h3',definitions[m.category].label+' · '+formatted(m)),el('p',basis[m.basis]+' · '+m.conditions));if(!p||p.revision!==m.revision)box.append(el('p','公开条目已变更或不可用；此记录仍基于修订 '+m.revision,'notice subtle'));
      const actions=el('div',undefined,'actions'),edit=el('button','编辑'),remove=el('button','删除');edit.addEventListener('click',()=>{if(!p){message('论文当前不可用，请保留备份后核对来源。');return;}for(const [f,k] of [['id','id'],['paper','record_id'],['category','category'],['value','value'],['basis','basis'],['conditions','conditions'],['baseline','baseline'],['locator','locator'],['source','source_url'],['quote','quote']])$('metric-'+f).value=m[k];unitOptions(m.unit);editingRevision=m.revision;$('metric-submit').textContent='保存修改';$('metric-editor').scrollIntoView({block:'start'});$('metric-value').focus({preventScroll:true});});
      remove.addEventListener('click',()=>{const next=state.entries.filter(x=>x.id!==m.id);if(save({schema,entries:next})){if($('metric-id').value===m.id)clear();message('已删除个人指标；其他笔记保留。');}});actions.append(edit,remove);box.append(actions);list.append(box);
    }
    const ids=selected(),papers=ids.map(id=>items.find(i=>i.record_id===id)).filter(Boolean),host=$('metrics-comparison');host.replaceChildren();$('metrics-selection').textContent=papers.length?papers.map(p=>p.venue_info.abbr+' · '+(p.title_zh||p.title)).join(' / '):'先从论文卡片“加入对比”，再回到这里。';
    if(papers.length<2){host.append(el('p','至少选择2篇论文后展示横向对比。','empty-hint'));return;}
    for(const p of papers){const box=el('article',undefined,'metric-column'),h=el('h3'),a=el('a',p.title_zh||p.title);a.href='items/'+p.record_id+'.html#metrics';h.append(a);box.append(h,el('p',p.venue_info.abbr+' · '+p.evidence_status,'fine'));
      box.append(el('h4','公开结构化指标'));
      for(const m of p.metrics||[])box.append(el('p',`${m.name}：${m.value} ${m.unit}`),el('p',`${m.conditions||'条件待补充'} · ${m.basis||'验证方式待补充'} · ${m.locator||'定位待补充'}`,'fine'));
      if(!p.metrics?.length)box.append(el('p','尚无经审核的结构化指标。','fine'));
      box.append(el('h4','个人摘录 · 未独立核查'));const records=state.entries.filter(m=>m.record_id===p.record_id&&(!$('metrics-filter').value||m.category===$('metrics-filter').value));
      for(const m of records){const block=el('section',undefined,'metric-proof');block.append(el('strong',definitions[m.category].label+' '+formatted(m)),el('p',basis[m.basis]+' · '+m.conditions),el('p','对照：'+m.baseline),el('blockquote',m.quote));const link=el('a',m.locator);link.href=m.source_url;link.rel='noreferrer';block.append(link);if(m.revision!==p.revision)block.append(el('p','基于旧修订 '+m.revision+'，需复核','fine'));box.append(block);}
      if(!records.length)box.append(el('p','此维度暂无个人记录，不补造数值。','fine'));host.append(box);
    }
    host.append(el('p','只换算同一维度的明确单位。净/总速率、仿真/实时实验、单通道/总吞吐以及不同FEC、BER口径仍需逐项核对，不自动判定谁更优。','comparison-caution'));
  }
  for(const [key,d] of Object.entries(definitions)){ $('metric-category').add(new Option(d.label,key));$('metrics-filter').add(new Option(d.label,key));}
  unitOptions();read();render();
  $('metric-category').addEventListener('change',()=>unitOptions());$('metrics-filter').addEventListener('change',render);$('metric-reset').addEventListener('click',clear);
  $('metric-paper').addEventListener('change',()=>{const p=items.find(i=>i.record_id===$('metric-paper').value);if(p)$('metric-source').value=p.source_url;if($('metric-id').value){$('metric-id').value='';editingRevision=null;$('metric-submit').textContent='保存个人指标';}});
  $('metric-form').addEventListener('submit',e=>{e.preventDefault();const p=items.find(i=>i.record_id===$('metric-paper').value);if(!p){message('请先选择论文。');return;}const m={id:$('metric-id').value||crypto.randomUUID(),record_id:p.record_id,revision:editingRevision||p.revision,title:p.title_zh||p.title,category:$('metric-category').value,value:$('metric-value').value.trim(),unit:$('metric-unit').value,basis:$('metric-basis').value,conditions:$('metric-conditions').value.trim(),baseline:$('metric-baseline').value.trim(),locator:$('metric-locator').value.trim(),source_url:$('metric-source').value.trim(),quote:$('metric-quote').value.trim(),updated_at:new Date().toISOString()};if(save({schema,entries:[...state.entries.filter(x=>x.id!==m.id),m]})){clear();message('已保存个人指标，尚未经独立核查。');}});
  function download(name,text,type){const u=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  $('metrics-export').addEventListener('click',()=>{try{download(blocked?'paperflow-metrics-recovery.txt':'paperflow-metrics.json',blocked?localStorage.getItem(key)||'':JSON.stringify(state,null,2),'application/json');}catch(_){message('浏览器禁止读取存储，暂无法导出。');}});
  $('metrics-import').addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>5000000)throw Error('文件过大');const incoming=valid(JSON.parse(await f.text()));read();const map=new Map(state.entries.map(m=>[m.id,m]));for(const m of incoming.entries)if(!map.has(m.id)||Date.parse(m.updated_at)>Date.parse(map.get(m.id).updated_at))map.set(m.id,m);if(save({schema,entries:[...map.values()]}))message('指标备份已合并。');}catch(err){message('导入失败：'+err.message+'。原数据未更改。');}e.target.value='';});
  const md=s=>String(s).replace(/[\\`*_{}\[\]<>#|]/g,'\\$&');
  $('metrics-export-md').addEventListener('click',()=>{if(selected().length<2){message('请先选择至少2篇论文。');return;}const records=state.entries.filter(m=>selected().includes(m.record_id)&&(!$('metrics-filter').value||m.category===$('metrics-filter').value));download('paperflow-metric-comparison.md','# 个人指标对比\n\n以下仅导出个人摘录，未经独立核查。单位换算不表示实验可比，不作性能排名。\n\n'+records.map(m=>'## '+md(m.title)+'\n\n'+md(definitions[m.category].label+'：'+formatted(m))+'\n\n'+md(basis[m.basis]+'；条件：'+m.conditions+'；对照：'+m.baseline)+'\n\n原文：'+md(m.quote)+'\n\n定位：'+md(m.locator)+'；修订 '+m.revision+'\n\n来源：'+m.source_url).join('\n\n'),'text/markdown');});
  window.addEventListener('paperflow:research-changed',render);window.addEventListener('storage',e=>{if(e.key===key||e.key===null){read();render();}});
  window.PaperFlowMetrics=Object.freeze({normalize,getState:()=>JSON.parse(JSON.stringify(state))});
  PaperFlow.getItems().then(data=>{items=data;for(const p of items.filter(i=>['paper','preprint'].includes(i.kind)))$('metric-paper').add(new Option(p.title_zh||p.title,p.record_id));render();}).catch(()=>{loadFailed=true;message('论文目录暂不可用，请刷新重试。已有个人指标保留。');});
})();

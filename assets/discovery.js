/* Local discovery preferences. Public papers and approval records are never edited. */
"use strict";
(() => {
  const base=new URL(document.body.dataset.prefix||'./',document.baseURI);
  const key='paperflow:discovery:v1:'+base.pathname, schema='paperflow.discovery-workspace/v1';
  const labels={deep:'精读',skim:'略读',later:'暂缓',irrelevant:'不相关'};
  const fields=['author','keyword','keyword_source','metadata','focus','search','venue','kind','year','evidence','presentation','rank','hust','exchange','session','topic','review','period'];
  const aliases=[['硅光','silicon photonic'],['相干','coherent'],['光互连','interconnect'],['共封装','co-packaged','cpo'],['空芯','hollow-core','hollow core'],['微波光子','microwave photonic'],['光网络','optical network'],['量子','quantum'],['自由空间','free-space','free space'],['调制器','modulator'],['光纤','fiber','fibre'],['均衡','equaliz'],['波束','beamform','beam steer']];
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const blank=()=>({schema,searches:[],triage:[]}), stamp=()=>new Date().toISOString();
  let blocked=false, state=blank(), view='all', controller=null, dataset=null, itemset=null, renderSerial=0;
  const str=(v,n)=>typeof v==='string'&&v.length<=n, id=v=>str(v,200)&&/^[\w-]+$/.test(v);
  const date=v=>str(v,40)&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v));
  function validate(v){
    if(v?.schema!==schema||!Array.isArray(v.searches)||v.searches.length>30||!Array.isArray(v.triage)||v.triage.length>3000)throw Error('备份格式或数量不正确');
    const searches=v.searches.map(s=>{
      if(!id(s.id)||!str(s.name,100)||!s.name.trim()||!date(s.updated_at)||!s.filters||typeof s.filters!=='object'||Array.isArray(s.filters)||Object.keys(s.filters).some(k=>!fields.includes(k))||Object.values(s.filters).some(v=>!str(v,500))||!Array.isArray(s.seen)||s.seen.length>50000||!s.seen.every(id))throw Error('检索记录无效');
      if(s.filters.period&&!['7','30','90','365'].includes(s.filters.period))throw Error('日期范围无效');
      if(s.checked_at!==undefined&&!date(s.checked_at))throw Error('基线日期无效');
      return {id:s.id,name:s.name,filters:{...s.filters},seen:[...new Set(s.seen)],updated_at:s.updated_at,checked_at:s.checked_at||s.updated_at};
    });
    const triage=v.triage.map(t=>{
      if(!id(t.id)||!['item','catalog'].includes(t.type)||!id(t.record_id)||!Object.hasOwn(labels,t.decision)||!str(t.title,2000)||!date(t.updated_at)||!Number.isInteger(t.revision)||t.revision<0||t.id!==t.type+'_'+t.record_id)throw Error('筛选记录无效');
      return {id:t.id,type:t.type,record_id:t.record_id,revision:t.revision,title:t.title,decision:t.decision,updated_at:t.updated_at};
    });
    if(new Set(searches.map(s=>s.id)).size!==searches.length||new Set(triage.map(t=>t.id)).size!==triage.length)throw Error('记录编号重复');
    return {schema,searches,triage};
  }
  function message(text){const node=document.getElementById('discovery-status')||document.getElementById('app-notice');if(node){node.hidden=false;node.textContent=text;}}
  function read(){try{const raw=localStorage.getItem(key);state=raw?validate(JSON.parse(raw)):blank();blocked=false;}catch(_){blocked=true;state=blank();message('检索与筛选存储不可用，已停止写入并保留原始数据。请导出原始备份检查。');}}
  function save(next){if(blocked){message('存储不可用，未覆盖原始数据。');return false;}try{const clean=validate(next);localStorage.setItem(key,JSON.stringify(clean));state=clean;syncSelectors();renderPersonal();window.dispatchEvent(new Event('paperflow:discovery-changed'));return true;}catch(_){message('保存失败，请检查存储空间或备份格式；原记录未更改。');return false;}}
  function match(p,f,searchText){
    const text=f.search?norm(searchText??[p.title,p.title_zh,p.search_summary,...(p.authors||[]),p.doi,p.paper_code,p.abbr,p.venue,...(p.venue_aliases||[]),p.hust_label,p.exchange_label,p.session,...(p.attributes?.content.topic_tags||[]),...(p.attributes?.content.author_keywords||[])].join(' ')):'';
    if(!PaperAttributes.match(p.attributes,f))return false;
    if(f.focus&&(p.focus_tier||'unrated')!==f.focus)return false;
    const terms=norm(f.search).split(' ').filter(Boolean);
    if(!terms.every(t=>(aliases.find(g=>g.includes(t))||[t]).some(a=>text.includes(a))))return false;
    if(f.hust&&(p.hust_rule_grade||(p.kind==='journal'||p.kind==='conference'?'unverified':'na'))!==f.hust||f.exchange&&(p.exchange_grade||'unlisted')!==f.exchange)return false;
    if(f.venue&&p.venue_key!==f.venue||f.kind&&p.kind!==f.kind||f.year&&String(p.year)!==f.year||f.evidence&&p.has_abstract!==(f.evidence==='yes')||f.presentation&&p.presentation_type!==f.presentation||f.rank&&p.rank_label!==f.rank||f.session&&p.session!==f.session||f.topic&&!PaperAttributes.topicMatch(p.theme_hints,f.topic)||f.review&&Boolean(p.reading_url)!==(f.review==='yes'))return false;
    if(f.period){
      if(!/^\d{4}-\d\d-\d\d$/.test(p.date)||['publication-year','publication-month'].includes(p.date_basis))return false;
      const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
      const age=(Date.parse(today+'T00:00:00Z')-Date.parse(p.date+'T00:00:00Z'))/86400000;
      if(!Number.isFinite(age)||age<0||age>=Number(f.period))return false;
    }
    return true;
  }
  const filters=()=>Object.fromEntries(fields.map(k=>[k,document.getElementById('catalog-'+k)?.value||'']));
  const decision=(type,record)=>state.triage.find(t=>t.id===type+'_'+record)?.decision||'';
  function choose(type,record,title,revision,value){
    read();const rows=state.triage.filter(t=>t.id!==type+'_'+record);
    if(value)rows.push({id:type+'_'+record,type,record_id:record,title,revision,decision:value,updated_at:stamp()});
    if(save({...state,triage:rows}))message(value?'已标记为'+labels[value]+'，仅影响本机阅读安排。':'已清除筛选决定，阅读笔记保留。');
  }
  function mount(host,type,record,title,revision=0){
    if(host.querySelector('[data-triage-select]'))return;
    const label=el('label','阅读安排','triage-control'),select=el('select');
    select.dataset.triageSelect=type+'_'+record;select.setAttribute('aria-label','阅读安排：'+title);
    select.append(new Option('尚未筛选',''));for(const [v,t] of Object.entries(labels))select.append(new Option(t,v));select.value=decision(type,record);
    select.addEventListener('change',()=>{choose(type,record,title,revision,select.value);select.value=decision(type,record);});label.append(select);host.append(label);
  }
  function syncSelectors(){for(const select of document.querySelectorAll('[data-triage-select]'))select.value=state.triage.find(t=>t.id===select.dataset.triageSelect)?.decision||'';}
  function linkFor(s){const url=new URL(s.filters.kind==='conference'?'conferences.html':'catalog.html',base);for(const [k,v] of Object.entries(s.filters))if(v)url.searchParams.set(k==='search'?'q':k,v);url.searchParams.set('saved',s.id);return url;}
  async function loadData(){
    if(!dataset)dataset=await PaperCatalogData.load();
    if(!itemset){itemset=await PaperFlow.getItems();const byId=new Map(itemset.map(i=>[i.record_id,i]));for(const p of dataset.papers){const i=byId.get(p.reading_url?.split('/').pop().replace('.html',''));if(i){p.title_zh=i.title_zh;p.search_summary=i.summary_zh;}}}
  }
  async function renderPersonal(){
    const host=document.getElementById('saved-search-list');if(!host)return;const serial=++renderSerial;
    try{await loadData();if(serial!==renderSerial)return;host.replaceChildren();
      if(!state.searches.length)host.append(el('p','还没有保存检索。在题录库设置筛选后，给检索起一个名字即可。','fine'));
      for(const s of state.searches){
        const found=dataset.papers.filter(p=>match(p,s.filters)),seen=new Set(s.seen),fresh=found.filter(p=>!seen.has(p.index_id));
        const box=el('article',undefined,'saved-search-card'),h=el('h3'),a=el('a',s.name);a.href=linkFor(s);h.append(a);
        box.append(h,el('p',`${found.length} 条匹配 · ${fresh.length} 条未确认新增`,'saved-search-count'),el('p','基线确认于 '+new Date(s.checked_at).toLocaleString('zh-CN'),'fine'));
        const actions=el('div',undefined,'actions'),ack=el('button','确认当前匹配'),rename=el('button','重命名'),remove=el('button','删除检索');
        ack.addEventListener('click',()=>{read();save({...state,searches:state.searches.map(x=>x.id===s.id?{...x,seen:found.map(p=>p.index_id),updated_at:stamp(),checked_at:stamp()}:x)});});
        rename.addEventListener('click',()=>{const name=prompt('检索名称（最多100字）',s.name)?.trim();if(name&&name.length<=100){read();save({...state,searches:state.searches.map(x=>x.id===s.id?{...x,name,updated_at:stamp()}:x)});}});
        remove.addEventListener('click',()=>{read();save({...state,searches:state.searches.filter(x=>x.id!==s.id)});});
        const freshLink=el('a','只看新增 →');const freshUrl=linkFor(s);freshUrl.searchParams.set('new','1');freshLink.href=freshUrl;
        actions.append(freshLink,ack,rename,remove);box.append(actions);host.append(box);
      }
      const list=document.getElementById('triage-list');list.replaceChildren();const rows=state.triage.filter(t=>view==='all'||t.decision===view).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
      document.getElementById('triage-count').textContent=`${rows.length} / ${state.triage.length} 篇`;
      if(!rows.length)list.append(el('p','这个队列还没有论文，可从题录库或今日阅读标记。','fine'));
      for(const t of rows){const source=t.type==='item'?itemset.find(i=>i.record_id===t.record_id):dataset.papers.find(p=>p.index_id===t.record_id);
        const box=el('article',undefined,'triage-card'),h=el('h3');
        if(source){const a=el('a',source.title_zh||source.title);a.href=t.type==='item'?new URL('items/'+t.record_id+'.html',base):source.source_url;a.rel='noreferrer';h.append(a);}else h.textContent=t.title;
        box.append(h,el('p',labels[t.decision]+' · '+(t.type==='item'?'公开解读':'题录，未必已有解读'),'fine'));
        if(!source)box.append(el('p','当前目录中没有此条目，保留原筛选供复查。','fine'));
        if(t.type==='item'&&source&&t.revision!==source.revision)box.append(el('p','解读已修订，请重新核对筛选决定。','notice subtle'));
        mount(box,t.type,t.record_id,t.title,source?.revision||t.revision);
        if(t.type==='item'&&source){const b=el('button','加入阅读清单');b.dataset.save=t.record_id;b.dataset.revision=source.revision;box.append(b);}
        else if(source?.reading_url){const a=el('a','已有中文解读 →');a.href=new URL(source.reading_url,base);box.append(a);}
        list.append(box);
      }
    }catch(_){if(serial===renderSerial){host.replaceChildren(el('p','目录读取失败，个人记录未丢失。请刷新重试。'));}}
  }
  function attachCatalog(api){controller=api;
    const input=document.getElementById('saved-search-name'),button=document.getElementById('save-search');if(!button)return;
    button.disabled=false;button.addEventListener('click',()=>{
      const name=input.value.trim();if(!name||name.length>100){message('请填写不超过100字的检索名称。');input.focus();return;}
      read();const f=filters();const found=controller.papers().filter(p=>match(p,f));
      const same=state.searches.find(s=>fields.every(k=>(s.filters[k]||'')===(f[k]||'')));
      if(same){message('相同条件已保存为“'+same.name+'”，可到我的检索管理。');return;}
      if(state.searches.length>=30){message('最多保存30个检索，请先整理已有检索。');return;}
      const s={id:crypto.randomUUID(),name,filters:f,seen:found.map(p=>p.index_id),updated_at:stamp(),checked_at:stamp()};
      if(save({...state,searches:[...state.searches,s]})){input.value='';message('检索已保存；当前结果作为基线，后续匹配新增会单独标记。');}
    });
  }
  function catalogChanged(found){
    const savedId=new URL(location.href).searchParams.get('saved'),s=state.searches.find(s=>s.id===savedId),node=document.getElementById('saved-search-context');if(!node)return;
    const onlyNew=document.getElementById('catalog-new-only');
    node.replaceChildren();if(!s){if(onlyNew){onlyNew.disabled=true;onlyNew.checked=false;}return;}
    const same=fields.every(k=>(s.filters[k]||'')===(filters()[k]||''));
    if(onlyNew)onlyNew.disabled=!same;
    if(!same){if(onlyNew)onlyNew.checked=false;node.append(el('p','筛选条件已改变，保存的“'+s.name+'”保持原条件。'));return;}
    const seen=new Set(s.seen),fresh=found.filter(p=>!seen.has(p.index_id));node.append(el('p',`“${s.name}”：${fresh.length} 条未确认新增。`));
    const ack=el('button','确认当前匹配');ack.addEventListener('click',()=>{read();if(save({...state,searches:state.searches.map(x=>x.id===s.id?{...x,seen:found.map(p=>p.index_id),updated_at:stamp(),checked_at:stamp()}:x)}))controller?.render();});node.append(ack);
  }
  function isNew(p){const s=state.searches.find(s=>s.id===new URL(location.href).searchParams.get('saved'));return !!s&&fields.every(k=>(s.filters[k]||'')===(filters()[k]||''))&&!s.seen.includes(p.index_id);}
  read();
  for(const card of document.querySelectorAll('.card[data-id]'))mount(card,'item',card.dataset.id,card.querySelector('h3')?.textContent.trim()||card.dataset.id,Number(card.dataset.revision));
  const detail=document.querySelector('[data-note-editor]');if(detail)mount(detail,'item',detail.dataset.noteEditor,document.querySelector('h1')?.textContent||detail.dataset.noteEditor,Number(detail.dataset.revision));
  document.addEventListener('click',e=>{const b=e.target.closest('[data-triage-view]');if(b){view=b.dataset.triageView;for(const button of document.querySelectorAll('[data-triage-view]'))button.setAttribute('aria-pressed',String(button===b));renderPersonal();}});
  document.getElementById('discovery-export')?.addEventListener('click',()=>{const raw=blocked?localStorage.getItem(key):JSON.stringify(state);const url=URL.createObjectURL(new Blob([raw||''],{type:'application/json'}));const a=el('a');a.href=url;a.download=blocked?'paperflow-discovery-recovery.txt':'paperflow-discovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  document.getElementById('discovery-import')?.addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>5*1024*1024)throw Error();const incoming=validate(JSON.parse(await f.text()));read();const merge=(a,b)=>{const m=new Map(a.map(v=>[v.id,v]));for(const v of b)if(!m.has(v.id)||Date.parse(v.updated_at)>Date.parse(m.get(v.id).updated_at))m.set(v.id,v);return [...m.values()];};if(save({schema,searches:merge(state.searches,incoming.searches),triage:merge(state.triage,incoming.triage)}))message('检索与筛选备份已合并。');}catch(_){message('导入失败：请使用有效的检索与筛选备份（不超过5 MB），原数据未更改。');}e.target.value='';});
  window.addEventListener('storage',e=>{if(e.key===key||e.key===null){read();syncSelectors();renderPersonal();window.dispatchEvent(new Event('paperflow:discovery-changed'));}});
  window.PaperFlowDiscovery=Object.freeze({match,mount,attachCatalog,catalogChanged,isNew,decision,getState:()=>JSON.parse(JSON.stringify(state))});
  renderPersonal();
})();

/* Direction -> evidence -> personal reading. Public data stays read-only.
   Uses existing catalog matching and personal stores so saved searches stay portable. */
'use strict';
(() => {
  if(!document.getElementById('direction-explorer'))return;
  const $=id=>document.getElementById(id),base=new URL(document.body.dataset.prefix||'./',document.baseURI);
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
  const link=(text,path)=>{const a=el('a',text);const u=new URL(path,base);if(['http:','https:'].includes(u.protocol)){a.href=u;a.rel=u.origin!==location.origin?'noreferrer':'';}return a;};
  const topics=[...document.querySelectorAll('[data-explore-topic]')];
  const defaultQuestion=$('explore-question').lastElementChild.textContent;
  const PAGE_SIZE=10;
  let state={},items=null,catalog=null,readings=[],venueNames=new Map(),currentFound=[],busy={items:false,catalog:false},errors={};
  const norm=PaperAttributes.norm;
  function restore(){
    const p=new URL(location.href).searchParams;
    state={search:(p.get('q')||'').slice(0,200),topic:(p.get('topic')||'').slice(0,200),
      venue:(p.get('venue')||'').slice(0,200),year:(p.get('year')||'').slice(0,4),
      view:p.get('view')==='catalog'?'catalog':'readings',sort:p.get('sort')==='recent'?'recent':'recommended',
      page:Math.max(1,Math.min(100000,Math.floor(Number(p.get('page')))||1))};
  }
  function writeURL(push=false){
    const url=new URL(location.href);
    for(const k of ['q','topic','venue','year','view','sort','page'])url.searchParams.delete(k);
    for(const k of ['search','topic','venue','year'])if(state[k])url.searchParams.set(k==='search'?'q':k,state[k]);
    if(state.view==='catalog')url.searchParams.set('view','catalog');
    if(state.sort==='recent')url.searchParams.set('sort','recent');
    if(state.page>1)url.searchParams.set('page',String(state.page));
    if(url.href!==location.href)history[push?'pushState':'replaceState'](null,'',url);
  }
  function change(values,{scroll=false}={}){
    state={...state,page:1,...values};render();writeURL(true);
    if(scroll){$('explore-title').tabIndex=-1;$('explore-title').focus({preventScroll:true});$('explore-title').scrollIntoView({block:'start',behavior:'instant'});}
  }
  function prepare(){
    venueNames=new Map((catalog?.venues||[]).map(v=>[v.key,v.abbr]));
    const byAbbr=new Map((catalog?.venues||[]).map(v=>[norm(v.abbr),v.key]));
    if(catalog&&state.venue.startsWith('reading-')){
      const selected=(items||[]).find(i=>'reading-'+i.venue_info.id===state.venue);
      const resolved=selected&&byAbbr.get(norm(selected.venue_info.abbr));
      if(resolved)state.venue=resolved;
    }
    readings=(items||[]).filter(i=>['paper','preprint'].includes(i.kind)).map(i=>{
      const v=i.venue_info,venue=byAbbr.get(norm(v.abbr))||'reading-'+v.id;
      venueNames.set(venue,v.abbr);
      return {...i,original:i,venue_key:venue,abbr:v.abbr,kind:v.kind,date:i.published_at||'',
        year:i.attributes.bibliography.year,theme_hints:i.topics,search_summary:i.summary_zh,
        rank_label:v.rank_label,hust_rule_grade:v.hust_rule_grade,reading_url:'items/'+i.record_id+'/',
        has_abstract:i.evidence_status!=='metadata-only'};
    });
    const byId=new Map((items||[]).map(i=>[i.record_id,i]));
    if(items)for(const b of topics){const count=b.querySelector('.explore-topic-count');if(count){const n=readings.filter(p=>PaperAttributes.topicMatch(p.theme_hints,b.dataset.exploreTopic)).length;count.textContent=String(n);count.setAttribute('aria-label',n+'条精选解读');}}
    for(const p of catalog?.papers||[]){
      const id=(p.reading_url||'').match(/items\/([\w-]+)/)?.[1],i=byId.get(id);
      if(i){p.title_zh=i.title_zh;p.search_summary=i.summary_zh;}
    }
  }
  const filters=()=>Object.fromEntries(['search','topic','venue','year'].map(k=>[k,state[k]]));
  function matches(p,f=filters()){return PaperFlowDiscovery.match(p,f);}
  function sorted(found){
    return [...found].sort((a,b)=>{
      if(state.sort==='recommended'){
        const priority=p=>p.record_id?({'A':0,'B':1,'C':2,'D':3}[p.reading_level]??4):(p.reading_url?0:1);
        const d=priority(a)-priority(b);if(d)return d;
      }
      return String(b.date||'').localeCompare(String(a.date||''))||String(a.record_id||a.index_id).localeCompare(String(b.record_id||b.index_id));
    });
  }
  function options(node,pairs,value){
    const original=node.options[0].textContent;node.replaceChildren(new Option(original,''));
    for(const [v,label] of pairs)node.add(new Option(label,v));
    if(value&&![...node.options].some(o=>o.value===value))node.add(new Option((venueNames.get(value)||value)+' · 当前无匹配',value));
    node.value=value;
  }
  function syncControls(){
    $('explore-query').value=state.search;
    const known=topics.find(b=>b.dataset.exploreTopic===state.topic);
    for(const b of topics)b.setAttribute('aria-pressed',String(b===known));
    $('explore-direction-label').textContent=state.topic||'全部方向';
    $('explore-title').textContent=state.topic||(state.search?'探索「'+state.search+'」':'先找到值得读的，再提出值得问的');
    $('explore-description').textContent=known?.dataset.description||'从精选解读起步，或切换题录查看更广的收录范围。';
    $('explore-question').lastElementChild.textContent=known?.dataset.question||defaultQuestion;
    $('explore-question').hidden=!state.topic;
    for(const b of document.querySelectorAll('[data-explore-view]'))b.setAttribute('aria-pressed',String(b.dataset.exploreView===state.view));
    const all=[...readings,...(catalog?.papers||[])];
    options($('explore-venue'),[...venueNames].sort((a,b)=>a[1].localeCompare(b[1])),state.venue);
    options($('explore-year'),[...new Set(all.map(p=>String(p.year||'')).filter(Boolean))].sort().reverse().map(y=>[y,y]),state.year);
    $('explore-sort').value=state.sort;
    $('explore-sort').options[0].textContent=state.view==='catalog'?'有解读优先':'阅读建议优先';
    const chips=$('explore-active');chips.replaceChildren();
    for(const [k,label] of [['search','关键词'],['topic','方向'],['venue','刊会'],['year','年份']])if(state[k]){
      const caption=k==='venue'?(venueNames.get(state[k])||state[k]):state[k];
      const b=button(label+'：'+caption+' ×',()=>{change({[k]:''});$('explore-query').focus();});
      b.setAttribute('aria-label','移除'+label+'：'+caption);chips.append(b);
    }
    $('explore-reset').hidden=!['search','topic','venue','year'].some(k=>state[k]);
    const url=new URL('catalog/',base);for(const [k,v] of Object.entries(filters()))if(v)url.searchParams.set(k==='search'?'q':k,v);
    const unsupported=state.venue.startsWith('reading-');
    $('explore-full-catalog').href=url;$('explore-full-catalog').hidden=unsupported;
    $('explore-save').disabled=!catalog||!items||unsupported;
    $('explore-save-quick').disabled=$('explore-save').disabled;
    $('explore-save').title=unsupported?'该刊会暂无题录，清除刊会条件后可保存探索。':'';
    $('explore-save-name').placeholder=(state.search||state.topic||'光通信方向').slice(0,80)+' · 持续关注';
    if(unsupported)$('explore-save-status').textContent='此刊会目前只有精选解读，尚未接入题录；清除刊会条件后可保存跨刊会探索。';
    else if($('explore-save-status').textContent.startsWith('此刊会'))$('explore-save-status').textContent='';
  }
  function paperCard(p){
    const card=el('article',undefined,'explore-paper');card.dataset.id=p.record_id||p.index_id;
    const meta=el('div',undefined,'explore-paper-meta');
    meta.append(el('span',p.abbr||'刊会待核','explore-venue-name'),el('span',p.date||'日期待核'));
    if(p.record_id)meta.append(el('span',({A:'A · 精读',B:'B · 简读',C:'C · 浏览',D:'D · 归档'})[p.reading_level]||'阅读建议待定','explore-reading-level'));
    else meta.append(el('span',p.reading_url?'附本站解读':'题录 · 结论未审核'));
    const title=el('h3'),target=p.reading_url||p.source_url;
    title.append(link(p.title_zh||p.title,target));card.append(meta,title);
    const authors=(p.authors||[]).slice(0,3).join(' · ')+((p.authors||[]).length>3?' 等':'');
    card.append(el('p',authors||'作者信息待补充','explore-byline'));
    if(p.record_id){
      card.append(el('p',p.summary_zh,'explore-summary'));
      const evidence=p.evidence_status==='fulltext-reviewed'?'全文证据已核对':p.evidence_status==='metadata-only'?'仅元数据证据':'摘要范围解读 · 尚未完整核对全文';
      const detail=el('details',undefined,'explore-evidence');detail.append(el('summary',evidence));
      detail.append(el('p',p.summary_zh));
      if(p.missing_evidence?.length){const list=el('ul');for(const gap of p.missing_evidence)list.append(el('li',gap));detail.append(el('strong','继续阅读需要核对'),list);}
      card.append(detail);
    }else{
      card.append(el('p',p.session?'分会：'+p.session:(p.has_abstract?'来源附摘要，可先核对研究问题与方法。':'目前仅有题录，原文可用性以来源为准。'),'explore-summary'));
    }
    const actions=el('div',undefined,'explore-paper-actions');actions.append(link(p.reading_url?'查看解读 →':'查看原始来源 ↗',target));
    if(p.record_id){
      const saved=!!PaperFlow.getReadingEntry(p.record_id),save=button(saved?'已加入阅读':'加入阅读',()=>{});
      save.dataset.save=p.record_id;save.dataset.revision=String(p.revision);save.setAttribute('aria-pressed',String(saved));
      const compared=PaperFlowResearch.getState().compare.includes(p.record_id),compare=button(compared?'已加入对比':'加入对比',()=>{});
      compare.dataset.compare=p.record_id;compare.setAttribute('aria-pressed',String(compared));actions.append(save,compare);
    }
    card.append(actions);
    if(!p.record_id)PaperFlowDiscovery.mount(card,'catalog',p.index_id,p.title);
    return card;
  }
  function emptyState(otherCount){
    const box=el('div',undefined,'explore-empty');box.append(el('h3','这里暂时没有匹配结果'),el('p','可能是当前条件过窄，或本站尚未收录。没有结果不代表该方向没有论文。'));
    const actions=el('div',undefined,'actions');
    if(otherCount)actions.append(button('查看'+otherCount+'条'+(state.view==='readings'?'题录':'解读'),()=>change({view:state.view==='readings'?'catalog':'readings'})));
    const data=state.view==='readings'?readings:catalog?.papers||[];
    for(const [k,label] of [['search','关键词'],['topic','方向'],['venue','刊会'],['year','年份']]){
      if(!state[k])continue;const count=data.filter(p=>matches(p,{...filters(),[k]:''})).length;
      if(count)actions.append(button('移除'+label+' · '+count+'条',()=>change({[k]:''})));
    }
    if(!actions.childNodes.length)actions.append(button('重新选择方向',()=>change({search:'',topic:'',venue:'',year:''})));
    box.append(actions,link('查看本站收录范围','venues/#coverage'));return box;
  }
  function render(){
    syncControls();
    const a=readings.filter(p=>matches(p)),b=(catalog?.papers||[]).filter(p=>matches(p));
    $('explore-reading-count').textContent=items?String(a.length):errors.items?'暂不可用':'…';
    $('explore-catalog-count').textContent=catalog?String(b.length):errors.catalog?'暂不可用':'…';
    const host=$('explore-results'),available=state.view==='readings'?items:catalog;
    host.setAttribute('aria-busy',String(!available&&Object.values(busy).some(Boolean)));host.replaceChildren();
    const notice=$('explore-load-notice');notice.replaceChildren();notice.hidden=!Object.keys(errors).length;
    for(const k of Object.keys(errors)){notice.append(el('span',(k==='items'?'精选解读':'题录')+'暂时未能加载。'),button('重试'+(k==='items'?'解读':'题录'),()=>load(k)));}
    if(!available){$('explore-count').textContent=errors[state.view==='readings'?'items':'catalog']?'内容暂不可用，请重试':'正在加载…';host.append(el('p','已有阅读记录和笔记不受影响。','explore-placeholder'));$('explore-pagination').hidden=true;return;}
    currentFound=sorted(state.view==='readings'?a:b);const pages=Math.max(1,Math.ceil(currentFound.length/PAGE_SIZE));state.page=Math.min(state.page,pages);
    $('explore-count').textContent=currentFound.length+' 条'+(state.view==='readings'?'精选解读':'题录')+(currentFound.length?' · '+(state.sort==='recent'?'按发表时间':state.view==='readings'?'按阅读建议、再按时间':'有解读优先、再按时间'):'');
    $('explore-scope-note').textContent=state.view==='readings'?'阅读建议是本站优先级，不是期刊等级；摘要解读不等于全文已读。':'题录可能包含不同分册记录；方向含题名/分会规则线索，数量不代表去重论文量或热度。';
    if(!currentFound.length)host.append(emptyState(state.view==='readings'?b.length:a.length));
    for(const p of currentFound.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE))host.append(paperCard(p));
    $('explore-pagination').hidden=pages<=1;$('explore-prev').disabled=state.page<=1;$('explore-next').disabled=state.page>=pages;
    $('explore-page-input').value=String(state.page);$('explore-page-input').max=String(pages);$('explore-pages').textContent='/ 共 '+pages+' 页';
  }
  async function load(kind){
    if(busy[kind])return;busy[kind]=true;delete errors[kind];render();
    try{if(kind==='items')items=await PaperFlow.getItems();else catalog=await PaperCatalogData.load();prepare();}
    catch(_){errors[kind]=true;}
    finally{busy[kind]=false;render();if(items&&catalog)writeURL();}
  }
  $('explore-form').addEventListener('submit',e=>{e.preventDefault();change({search:$('explore-query').value.trim()},{scroll:innerWidth<=760});});
  for(const b of document.querySelectorAll('[data-explore-query]'))b.onclick=()=>change({search:b.dataset.exploreQuery,topic:'',venue:'',year:'',view:'readings'},{scroll:innerWidth<=760});
  for(const b of topics)b.onclick=()=>{if(innerWidth<=760)$('explore-direction-menu').open=false;change({topic:b.dataset.exploreTopic},{scroll:innerWidth<=760});};
  for(const b of document.querySelectorAll('[data-explore-view]'))b.onclick=()=>change({view:b.dataset.exploreView});
  for(const k of ['venue','year','sort'])$('explore-'+k).onchange=e=>change({[k]:e.target.value});
  $('explore-reset').onclick=()=>change({search:'',topic:'',venue:'',year:'',sort:'recommended'});
  $('explore-prev').onclick=()=>change({page:state.page-1},{scroll:true});
  $('explore-next').onclick=()=>change({page:state.page+1},{scroll:true});
  $('explore-page-input').onchange=e=>{const n=Number(e.target.value);change({page:Number.isFinite(n)?Math.max(1,Math.floor(n)):1});};
  function saveExploration(focusLink=false){
    if($('explore-save').disabled)return;
    const name=$('explore-save-name').value.trim()||(state.search||state.topic||'全部题录')+' · 持续关注';
    const answer=PaperFlowDiscovery.saveSearch(name,filters(),catalog.papers);
    $('explore-save-status').textContent=answer.ok?(answer.existing?'已保存过相同条件，可到“我的检索”继续。':'探索已保存。后续在“我的检索”检查匹配的新题录；不会自动发送通知。'):'未能保存，请检查浏览器存储或检索数量。';
    $('explore-quick-status').textContent=$('explore-save-status').textContent;
    $('explore-quick-status').hidden=focusLink;
    if(answer.ok){$('explore-save-name').value='';if(focusLink)$('explore-saved-link').focus();}
  }
  $('explore-save-form').onsubmit=e=>{e.preventDefault();saveExploration(true);};
  $('explore-save-quick').onclick=()=>saveExploration();
  window.addEventListener('popstate',()=>{restore();render();});
  restore();if(innerWidth<=760)$('explore-direction-menu').open=false;
  load('items');load('catalog');
})();

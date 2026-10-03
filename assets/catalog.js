"use strict";
(() => {
  const ids=['search','venue','kind','year','evidence','presentation','rank'];
  const controls=Object.fromEntries(ids.map(k=>[k,document.getElementById('catalog-'+k)]));
  const list=document.getElementById('catalog-list');
  const norm=t=>String(t||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
  const aliases=[['硅光','silicon photonic'],['相干','coherent'],['光互连','interconnect'],['共封装','co-packaged','cpo'],['空芯','hollow-core','hollow core'],['微波光子','microwave photonic'],['光网络','optical network'],['量子','quantum'],['自由空间','free-space','free space'],['调制器','modulator'],['光纤','fiber','fibre'],['均衡','equaliz'],['波束','beamform','beam steer']];
  const el=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};
  let data, papers=[],page=1;
  function readUrl(){const params=new URLSearchParams(location.search);for(const [key,c] of Object.entries(controls)){c.value=params.get(key==='search'?'q':key)||'';if(key!=='search'&&c.selectedIndex<0)c.value='';}page=Math.max(1,Number(params.get('page'))||1);}
  function render(update=true){
    const terms=norm(controls.search.value).split(' ').filter(Boolean);
    const found=papers.filter(({paper:p,search})=>terms.every(t=>{const group=aliases.find(g=>g.includes(t));return (group||[t]).some(a=>search.includes(a));})&&(!controls.venue.value||p.venue_key===controls.venue.value)&&(!controls.kind.value||p.kind===controls.kind.value)&&(!controls.year.value||String(p.year)===controls.year.value)&&(!controls.evidence.value||p.has_abstract===(controls.evidence.value==='yes'))&&(!controls.presentation.value||p.presentation_type===controls.presentation.value)&&(!controls.rank.value||p.rank_label===controls.rank.value));
    const pages=Math.max(1,Math.ceil(found.length/30));page=Math.min(Math.max(1,Math.floor(page)),pages);
    list.replaceChildren();
    for(const {paper:p} of found.slice((page-1)*30,page*30)){
      const article=el('article',undefined,'card catalog-card');
      const meta=el('div',undefined,'meta');meta.append(el('strong',p.abbr,'venue-badge'),el('span',String(p.year)),el('span',p.paper_code||p.date));
      meta.append(el('span',p.rank_label),el('span',p.focus_label));
      if(p.presentation_type)meta.append(el('span',p.presentation_type));
      const h=el('h3'),a=el('a',p.title);a.href=p.source_url;a.rel='noreferrer';h.append(a);
      article.append(meta,h,el('p',p.authors.join(' · '),'byline'));
      if(p.session)article.append(el('p',p.session,'fine'));
      article.append(el('p',(p.reading_url?'已有经审核解读':p.has_abstract?'已取得摘要 · 尚待解读':'仅题录 · 尚待补充摘要')+' · '+p.provenance,'fine'));
      if(p.reading_url){const reading=el('a','阅读中文解读 →','button secondary');reading.href=p.reading_url;article.append(reading);}
      if(p.doi)article.append(el('p','DOI '+p.doi,'fine'));
      list.append(article);
    }
    if(!found.length){const empty=el('div',undefined,'empty-state');empty.append(el('h3','当前没有匹配题录'),el('p','可放宽筛选，或到“刊会分级”查看来源是否尚未收录、失败或达到查询上限。'));list.append(empty);}
    document.getElementById('catalog-count').textContent=`${found.length} / ${papers.length} 条`;
    document.getElementById('catalog-page').textContent=`第 ${page} / ${pages} 页`;
    document.getElementById('catalog-prev').disabled=page===1;document.getElementById('catalog-next').disabled=page===pages;
    const venue=data.venues.find(v=>v.key===controls.venue.value);
    document.getElementById('catalog-coverage-note').textContent=venue?`${venue.abbr}：${venue.count} 条；${venue.reports.map(r=>r.note||r.error||r.status).join(' ')}；最近检查 ${venue.checked_date||'尚未执行'}`:'期刊采用近期窗口，会议采用年度目录。不同来源的覆盖范围分别记录；按年份、记录日期排序。';
    for(const b of document.querySelectorAll('[data-catalog-venue]'))b.setAttribute('aria-pressed',String(b.dataset.catalogVenue===controls.venue.value));
    if(update){const url=new URL(location.href);for(const [k,c] of Object.entries(controls)){const key=k==='search'?'q':k;if(c.value)url.searchParams.set(key,c.value);else url.searchParams.delete(key);}if(page>1)url.searchParams.set('page',String(page));else url.searchParams.delete('page');history.replaceState(null,'',url);}
  }
  async function load(){
    try{const response=await fetch('data/venue-index.json');if(!response.ok)throw Error('load');data=await response.json();if(data.schema!=='paperflow.venue-index/v1')throw Error('schema');papers=data.papers.map(p=>({paper:p,search:norm([p.title,...p.authors,p.doi,p.paper_code,p.abbr,p.venue,p.session].join(' '))}));readUrl();render(false);}
    catch(_){list.replaceChildren(el('p','题录加载失败，请重试。精选解读仍可从主导航打开。'));const retry=el('button','重新加载');retry.addEventListener('click',load);list.append(retry);document.getElementById('catalog-count').textContent='暂不可用';}
  }
  for(const c of Object.values(controls))c.addEventListener('input',()=>{if(data){page=1;render();}});
  document.addEventListener('click',event=>{const b=event.target.closest('[data-catalog-venue]');if(b&&data){controls.venue.value=b.dataset.catalogVenue;page=1;render();}});
  document.getElementById('catalog-reset').addEventListener('click',()=>{for(const c of Object.values(controls))c.value='';page=1;if(data)render();});
  for(const [id,step] of [['prev',-1],['next',1]])document.getElementById('catalog-'+id).addEventListener('click',()=>{if(data){page+=step;render();document.getElementById('catalog-count').scrollIntoView({block:'center'});}});
  window.addEventListener('popstate',()=>{if(data){readUrl();render(false);}});load();
})();

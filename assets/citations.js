(() => {
  'use strict';
  const host=document.querySelector('[data-citation-record]');if(!host)return;
  const $=id=>document.getElementById('citation-'+id),base=new URL(document.body.dataset.prefix||'./',document.baseURI);
  const ns='http://www.w3.org/2000/svg', svg=$('svg'), reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const roleLabels={root:'当前论文',reference:'它引用的论文',citing:'引用它的论文',both:'互相引用'};
  const s=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
  let graph,nodes=[],edges=[],selected,hovered,layer,frame=0,heat=0,paused=reduced.matches,visible=true,drag=null,suppressUntil=0;
  let zoom=1,panX=0,panY=0,lastFrame=0;
  if(innerWidth<600)$('limit').value='10';
  function safeLink(value,local=false){try{const u=new URL(value,base);return local?(u.origin===base.origin&&u.pathname.startsWith(base.pathname+'items/')&&u.pathname.endsWith('.html')?u.href:null):(u.protocol==='https:'&&!u.username&&!u.password?u.href:null);}catch(_){return null;}}
  function inspect(n){
    selected=n;$('node-role').textContent=roleLabels[n.role]||'关联论文';$('node-title').textContent=n.title;
    $('node-authors').textContent=n.authors?.length?n.authors.join(' · '):'作者信息待补充';
    $('node-venue').textContent=[n.venue_abbr||n.venue||'刊会待核实',n.year||'年份待核实',n.rank_label].filter(Boolean).join(' · ');
    $('node-keywords').textContent=n.keywords?.length?'关键词（OpenAlex）：'+n.keywords.join(' · '):'关键词待补充';
    $('node-summary').textContent=n.summary||'尚无经核对的摘要解读，可加入略读或精读队列继续了解。';
    const b=n.score_basis||{};$('node-score').textContent=n.role==='root'?(n.summary_basis||'本站论文'):`关联度 ${Math.round(n.importance*100)}/100 · 共同参考文献 ${b.shared_references||0} 篇 · ${n.cited_by_count===null?'全局被引数未知':'全局被引 '+n.cited_by_count+' 次（不计入关联度）'}`;
    $('open').textContent=n.reading_url?'打开站内解读':'选择略读 / 精读';
    const source=safeLink(n.url);$('source').hidden=!source;if(source)$('source').href=source;
    const evidence=$('edge-source');evidence.replaceChildren();
    const sources=graph.edges.filter(e=>(e.from===n.id&&e.to===graph.root)||(e.to===n.id&&e.from===graph.root)).flatMap(e=>e.sources);
    const seen=new Set();for(const source of sources){if(seen.has(source.url)||!safeLink(source.url))continue;seen.add(source.url);const a=document.createElement('a');a.textContent=source.provider+' 引用依据 ↗';a.href=source.url;a.target='_blank';a.rel='noreferrer';evidence.append(a,document.createTextNode(' '));}
    for(const node of nodes)node.element.classList.toggle('selected',node.id===n.id);
    for(const edge of edges)edge.element.classList.toggle('active',edge.from===n.id||edge.to===n.id);
  }
  function activate(n){
    if(n.reading_url){const url=safeLink(n.reading_url,true);if(url)location.assign(url);return;}
    selected=n;$('dialog-title').textContent=n.title;$('dialog-status').textContent='';$('dialog').showModal();
  }
  function transform(){layer?.setAttribute('transform',`translate(${450+panX} ${280+panY}) scale(${zoom}) translate(-450 -280)`);}
  function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return {x:(q.x-450-panX)/zoom+450,y:(q.y-280-panY)/zoom+280};}
  function draw(){
    for(const n of nodes)n.element.setAttribute('transform',`translate(${n.x.toFixed(2)} ${n.y.toFixed(2)})`);
    for(const e of edges){const a=e.a,b=e.b,dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy));const r=e.reverse?9:0;
      const x1=a.x+dx/d*(a.radius+3),y1=a.y+dy/d*(a.radius+3),x2=b.x-dx/d*(b.radius+6),y2=b.y-dy/d*(b.radius+6);
      e.element.setAttribute('d',`M ${x1} ${y1} Q ${(x1+x2)/2-dy/d*r} ${(y1+y2)/2+dx/d*r} ${x2} ${y2}`);
    }
  }
  function tick(){
    const root=nodes.find(n=>n.id===graph.root);if(!root)return;
    for(const n of nodes){
      if(n===root){n.vx+=(450-n.x)*.025;n.vy+=(280-n.y)*.025;continue;}
      const dx=n.x-root.x,dy=n.y-root.y,d=Math.max(1,Math.hypot(dx,dy)),desired=125+(1-n.importance)*205;
      const f=(desired-d)*.025;n.vx+=dx/d*f;n.vy+=dy/d*f;
      n.vx+=(450-n.x)*.001;n.vy+=(280-n.y)*.001;
    }
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j],dx=b.x-a.x||.1,dy=b.y-a.y||.1,d=Math.max(1,Math.hypot(dx,dy)),min=a.radius+b.radius+30;
      const f=Math.min(2.5,200/(d*d)+(d<min?(min-d)*.07:0));a.vx-=dx/d*f;a.vy-=dy/d*f;b.vx+=dx/d*f;b.vy+=dy/d*f;
    }
    for(const e of edges){if(e.a===root||e.b===root)continue;const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,d=Math.max(1,Math.hypot(dx,dy)),force=(d-120)*.0009;e.a.vx+=dx/d*force;e.a.vy+=dy/d*force;e.b.vx-=dx/d*force;e.b.vy-=dy/d*force;}
    let energy=0;
    for(const n of nodes){n.vx*=.82;n.vy*=.82;if(drag?.node===n||hovered===n){n.vx=0;n.vy=0;continue;}n.x=Math.max(40,Math.min(860,n.x+Math.max(-9,Math.min(9,n.vx))));n.y=Math.max(60,Math.min(490,n.y+Math.max(-9,Math.min(9,n.vy))));energy+=n.vx*n.vx+n.vy*n.vy;}
    return energy;
  }
  function animate(time){frame=0;if(paused||!visible||document.hidden)return;if(time-lastFrame<15){frame=requestAnimationFrame(animate);return;}lastFrame=time;const energy=tick();draw();heat--;if(heat>0&&(energy>.015||drag))frame=requestAnimationFrame(animate);}
  function wake(){heat=240;if(!frame&&!paused&&visible&&!document.hidden)frame=requestAnimationFrame(animate);}
  function motion(){ $('motion').textContent=paused?'开启动效':'暂停动效';$('motion').setAttribute('aria-pressed',String(paused));if(paused){cancelAnimationFrame(frame);frame=0;}else wake();}
  function search(){const term=$('search').value.trim().toLocaleLowerCase();let hits=0;for(const n of nodes){const match=!term||[n.title,...(n.authors||[]),...(n.keywords||[]),n.venue,n.venue_abbr].join(' ').toLocaleLowerCase().includes(term);n.element.classList.toggle('dim',!match);if(match)hits++;}if(term)$('status').textContent=`图中匹配 ${hits} 篇；筛选方向与展示规模不变。`;else status();}
  function status(){const count=nodes.length-1;$('status').textContent=count?`显示 ${count} 篇关联论文 · ${edges.length} 条引用连线`:'当前来源尚未提供可绘制的引用关系，不代表论文没有引用或影响。';}
  function render(){
    cancelAnimationFrame(frame);frame=0;hovered=null;drag=null;suppressUntil=0;svg.replaceChildren();
    const defs=s('defs'),marker=s('marker',{id:'citation-arrow',viewBox:'0 0 8 8',refX:7,refY:4,markerWidth:5,markerHeight:5,orient:'auto',markerUnits:'userSpaceOnUse'});marker.append(s('path',{d:'M 0 0 L 8 4 L 0 8 Z',fill:'#6b8174'}));defs.append(marker);svg.append(defs);
    layer=s('g');svg.append(layer);transform();const root=graph.nodes.find(n=>n.id===graph.root),direction=$('direction').value,limit=Number($('limit').value);
    const eligible=graph.nodes.filter(n=>n!==root&&(direction==='all'||n.role===direction||n.role==='both'));
    const chosen=new Set(direction==='all'?eligible.filter(n=>n.role==='citing'||n.role==='both').slice(0,Math.ceil(limit*.4)).map(n=>n.id):[]);
    for(const n of eligible)if(chosen.size<limit)chosen.add(n.id);
    const choices=eligible.filter(n=>chosen.has(n.id)),small=svg.clientWidth<500;
    svg.setAttribute('viewBox',small?'200 0 500 560':'0 0 900 560');
    nodes=[root,...choices].map((n,i)=>{const angle=(i-1)*2.39996-.6,d=125+(1-n.importance)*205;return {...n,x:i?450+Math.cos(angle)*d:450,y:i?280+Math.sin(angle)*d*.78:280,vx:0,vy:0,radius:i?(small?21:14)+n.importance*8:(small?34:29)};});
    const map=new Map(nodes.map(n=>[n.id,n]));
    edges=graph.edges.filter(e=>map.has(e.from)&&map.has(e.to)&&($('cross').checked||e.from===graph.root||e.to===graph.root)).map(e=>({...e,a:map.get(e.from),b:map.get(e.to)}));
    for(const e of edges){const isRoot=e.from===graph.root||e.to===graph.root,importance=isRoot?(e.from===graph.root?e.b:e.a).importance:Math.min(e.a.importance,e.b.importance);e.reverse=edges.some(x=>x.from===e.to&&x.to===e.from);e.element=s('path',{class:'citation-edge'+(isRoot?' root-edge':''),'stroke-width':(isRoot?.9:0.6)+importance*(isRoot?3.5:2),'marker-end':'url(#citation-arrow)'});layer.append(e.element);}
    for(const n of nodes){
      const g=s('g',{class:'citation-node '+n.role,tabindex:0,role:'button','aria-label':`${n.title}；${roleLabels[n.role]}；按 Enter 打开或加入阅读`,'data-node-id':n.id}),circle=s('circle',{r:n.radius}),mark=s('text',{class:'node-mark',dy:4});mark.textContent=n.role==='root'?'本篇':(n.year||'·');
      const label=s('text',{y:n.radius+19,class:'node-label'});label.textContent=(n.venue_abbr||'待核实').slice(0,19);const title=s('title');title.textContent=n.title;const hit=s('circle',{r:Math.max(n.radius,22/svg.getScreenCTM().a),class:'node-hit'});g.append(hit,circle,mark,label,title);n.element=g;layer.append(g);
      g.addEventListener('pointerenter',()=>{if(!drag){hovered=n;inspect(n);}});g.addEventListener('pointerleave',()=>{if(hovered===n)hovered=null;});g.addEventListener('focus',()=>inspect(n));
      g.addEventListener('click',()=>{if(performance.now()>suppressUntil)inspect(n);});g.addEventListener('dblclick',e=>{e.preventDefault();if(performance.now()>suppressUntil)activate(n);});
      g.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();activate(n);}else if(e.key===' '){e.preventDefault();inspect(n);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();n.x+=e.key==='ArrowLeft'?-12:e.key==='ArrowRight'?12:0;n.y+=e.key==='ArrowUp'?-12:e.key==='ArrowDown'?12:0;draw();wake();}});
      g.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.stopPropagation();const p=point(e);drag={node:n,x:p.x,y:p.y,startX:e.clientX,startY:e.clientY,moved:false,id:e.pointerId};g.setPointerCapture(e.pointerId);inspect(n);wake();});
    }
    // Deterministic first layout also serves reduced-motion and paused users.
    for(let i=0;i<90;i++)tick();draw();inspect(nodes[0]);status();search();wake();
  }
  svg.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('.citation-node'))return;drag={node:null,startX:e.clientX,startY:e.clientY,panX,panY,id:e.pointerId,moved:false};svg.setPointerCapture(e.pointerId);});
  svg.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)drag.moved=true;
    if(drag.node){const p=point(e);drag.node.x=Math.max(30,Math.min(870,drag.node.x+p.x-drag.x));drag.node.y=Math.max(50,Math.min(500,drag.node.y+p.y-drag.y));drag.x=p.x;drag.y=p.y;draw();wake();}
    else{const scale=svg.getScreenCTM().a;panX=drag.panX+(e.clientX-drag.startX)/scale;panY=drag.panY+(e.clientY-drag.startY)/scale;transform();}
  });
  function release(e){if(!drag||drag.id!==e.pointerId)return;if(drag.moved)suppressUntil=performance.now()+350;drag=null;hovered=null;wake();}
  svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);svg.addEventListener('lostpointercapture',release);
  svg.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoom=Math.max(.5,Math.min(2.5,zoom*(e.deltaY<0?1.1:1/1.1)));transform();},{passive:false});
  $('zoom-in').onclick=()=>{zoom=Math.min(2.5,zoom*1.2);transform();};$('zoom-out').onclick=()=>{zoom=Math.max(.5,zoom/1.2);transform();};$('reset').onclick=()=>{zoom=1;panX=panY=0;render();};
  $('motion').onclick=()=>{paused=!paused;motion();};reduced.addEventListener('change',e=>{paused=e.matches;motion();});
  for(const id of ['direction','limit','cross'])$(id).addEventListener('change',render);$('search').addEventListener('input',search);$('open').onclick=()=>{if(selected)activate(selected);};
  $('dialog-close').onclick=()=>$('dialog').close();
  for(const mode of ['skim','deep'])$(mode).onclick=()=>{const ok=window.PaperFlowCitationQueue?.add(selected,mode,host.dataset.citationRecord);$('dialog-status').textContent=ok?`已加入${mode==='deep'?'精读':'略读'}待处理队列（仅此浏览器）。`:'保存失败，队列可能已满或浏览器存储不可用；请先检查备份。';};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else if(graph)wake();});
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;}else if(graph)wake();}).observe(svg);
  $('load').onclick=async()=>{
    if(graph){$('content').hidden=!$('content').hidden;$('load').textContent=$('content').hidden?'展开这篇论文的关系图':'收起关系图';return;}
    $('load').disabled=true;$('status').textContent='正在读取引文快照…';
    try{const response=await fetch(new URL('data/citations/'+encodeURIComponent(host.dataset.citationRecord)+'.json',base));if(!response.ok)throw Error();const data=await response.json();if(data.schema!=='paperflow.citation-graph/v1'||!data.nodes.some(n=>n.id===data.root))throw Error();graph=data;$('content').hidden=false;$('load').textContent='收起关系图';render();motion();
      const c=graph.coverage||{},refs=c.references_found===undefined?'未取得':c.references_found,by=c.citing_found===null||c.citing_found===undefined?'未取得':c.citing_found;
      $('coverage').textContent=`快照 ${graph.checked_at?new Date(graph.checked_at).toLocaleDateString('zh-CN'):'等待采集'} · 来源登记参考文献 ${refs} 篇、被引 ${by} 篇 · 已解析候选 ${c.candidates_resolved||0} 篇。${c.references_without_doi?'另有 '+c.references_without_doi+' 条参考文献缺 DOI，未纳入。':''}${graph.status==='partial'?'部分来源或字段尚不可用。':''}${graph.status==='unavailable'?'当前数据获取失败，不能视为零引用。':''}${graph.refresh_failed?'最近刷新失败，保留上次成功快照。':''}`;
    }catch(_){graph=null;$('status').textContent='引文快照暂时无法读取，可重试；正文不受影响。';}finally{$('load').disabled=false;}
  };
})();

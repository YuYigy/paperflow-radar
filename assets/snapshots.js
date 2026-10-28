'use strict';
(() => {
  if(!document.getElementById('snapshot-form'))return;
  const $=id=>document.getElementById(id),base=new URL(document.body.dataset.prefix||'./',document.baseURI),adapters=PaperFlowBackupAdapters;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const evidence={'metadata-only':'仅元数据','abstract-only':'仅摘要证据','abstract+pdf-link':'摘要及全文链接；不等于全文已核查','fulltext-reviewed':'全文证据已核对'};
  let generation=0,pending=null;
  function message(t){$('snapshot-status').textContent=t;}
  function read(k){const a=adapters[k],raw=localStorage.getItem(a.key);return {raw,value:a.validate(raw?JSON.parse(raw):a.empty())};}
  function invalidate(){generation++;pending=null;$('snapshot-download').disabled=true;$('snapshot-download').classList.remove('button');$('snapshot-preview-section').hidden=true;$('snapshot-prepare').classList.add('button');}
  function safeLink(label,url){try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return el('span',label+'（链接不可用）');const a=el('a',label);a.href=u.href;a.rel='noreferrer';return a;}catch(_){return el('span',label+'（链接不可用）');}}
  function paragraph(host,title,value){host.append(el('h3',title),el('p',value||'未填写 / 未提供'));}
  function choices(){
    try{
      const state=read('research').value,selected=new Set([...$('snapshot-question-list').querySelectorAll('input:checked')].map(n=>n.value));
      $('snapshot-question-list').replaceChildren();
      for(const q of state.questions){const label=el('label'),input=el('input');input.type='checkbox';input.value=q.id;input.checked=selected.has(q.id);label.append(input,el('span',q.title));$('snapshot-question-list').append(label);}
      if(!state.questions.length)$('snapshot-question-list').append(el('p','还没有已保存的研究问题。可先到研究空间创建。'));
      $('snapshot-scope').textContent='当前对比清单 '+state.compare.length+' 篇；已保存研究问题 '+state.questions.length+' 个。';
    }catch(_){message('研究记录暂不可读取，请先在“我的数据”检查备份。');}
    $('snapshot-questions').hidden=$('snapshot-mode').value!=='questions';
  }
  function documentBody(options,items,research,reading,metrics){
    const byId=new Map(items.map(p=>[p.record_id,p])),questions=options.mode==='questions'?research.questions.filter(q=>options.questions.includes(q.id)):[];
    if(options.mode==='compare'&&(research.compare.length<2||research.compare.length>4))throw Error('请先在研究空间选择2—4篇对比论文');
    if(options.mode==='questions'&&!questions.length)throw Error('请勾选至少一个研究问题');
    const ids=options.mode==='compare'?research.compare:[...new Set(questions.flatMap(q=>q.records.map(r=>r.record_id)))];
    const notes=options.notes?reading.entries.filter(r=>ids.includes(r.record_id)&&r.note.trim()):[],entries=options.metrics?metrics.entries.filter(r=>ids.includes(r.record_id)):[];
    const root=el('main',undefined,'snapshot-document'),header=el('header');header.append(el('p','知流 PaperFlow · 只读研究快照','snapshot-meta'),el('h1',options.title),el('p','生成于 '+new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（北京时间）','snapshot-meta'));
    const manifest=`${ids.length} 篇关联论文 · ${questions.length} 个私人研究问题 · ${notes.length} 篇个人笔记 · ${entries.length} 条个人指标`;
    header.append(el('p',manifest),el('p','这是生成时的资料快照，不会自动更新。公开解读、个人记录和AI推断分别标注；不因数值大小或刊会等级判断论文优劣。','snapshot-note'));root.append(header);
    if(ids.length){const wrap=el('div',undefined,'snapshot-table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','论文对照表，可横向滚动');const table=el('table'),head=el('thead'),row=el('tr');row.append(...['论文','刊会 / 日期','证据范围','版本'].map(t=>el('th',t)));head.append(row);table.append(el('caption','论文对照概览；小屏幕可左右滑动'),head);const body=el('tbody');for(const rid of ids){const p=byId.get(rid),r=el('tr');r.append(el('td',p?(p.title_zh||p.title):'当前公开版本不可用：'+rid),el('td',p?`${p.venue_info.abbr} · ${p.published_at||'日期待核'}`:'不可用'),el('td',p?(evidence[p.evidence_status]||p.evidence_status):'不能补造'),el('td',p?'修订 '+p.revision:'未知'));body.append(r);}table.append(body);wrap.append(table);root.append(wrap);}
    for(const q of questions){const section=el('section');section.append(el('h2',q.title),el('p','私人研究问题 · 未独立核查 · 修改于 '+q.updated_at,'snapshot-meta'));for(const [key,label] of [['hypothesis','个人假设'],['evidence','个人记录的支持 / 反对证据'],['gaps','证据缺口'],['next','下一步验证']])paragraph(section,label,q[key]);
      const ul=el('ul');for(const r of q.records){const p=byId.get(r.record_id);ul.append(el('li',(p?(p.title_zh||p.title):r.record_id)+' · 问题绑定修订 '+r.revision+(p?.revision===r.revision?'':' · 当前版本已变化或不可用，需复核')));}section.append(el('h3','关联论文及记录版本'),ul);root.append(section);}
    for(const rid of ids){const p=byId.get(rid),section=el('section');section.append(el('h2',p?(p.title_zh||p.title):'当前公开版本不可用：'+rid));
      if(p){section.append(el('p',(p.authors||[]).join(' · '),'snapshot-meta'),el('p',`${p.venue_info.abbr} · ${p.published_at||'日期待核'} · 修订 ${p.revision} · ${evidence[p.evidence_status]||p.evidence_status}`,'snapshot-meta'));
        paragraph(section,'公开解读 · 保留原证据范围',p.summary_zh);
        for(const fact of p.facts||[]){section.append(el('h3','来源事实'),el('p',fact.text),safeLink('核对事实来源 · '+(fact.locator||'定位待补充'),fact.source_url||p.source_url));}
        for(const m of p.metrics||[]){paragraph(section,'公开指标 · '+m.name,m.value+' '+m.unit+'\n条件：'+(m.conditions||'未提供')+'\n验证方式：'+(m.basis||'未提供'));section.append(safeLink('指标原始来源 · '+(m.locator||'定位待补充'),m.source_url||p.source_url));}
        if(p.ai_inference?.length)paragraph(section,'AI研究启发 · 推断',p.ai_inference.join('\n'));
        paragraph(section,'继续阅读需要核对',(p.missing_evidence||[]).join('\n')||'仍需根据研究问题核对全文及实验条件。');
        section.append(safeLink('原始来源',p.source_url),el('p','DOI：'+(p.doi||'未提供'),'snapshot-meta'));
      }else section.append(el('p','该论文已不在当前公开内容中；保留关联标识，不补造题名、结论或新版本。','snapshot-note'));
      for(const note of notes.filter(n=>n.record_id===rid)){paragraph(section,'个人阅读笔记 · 未独立核查',note.note);section.append(el('p','笔记基于修订 '+note.revision+(p?.revision===note.revision?'':' · 与当前公开版本不一致或已不可用，需复核'),'snapshot-meta'));}
      for(const metric of entries.filter(m=>m.record_id===rid)){section.append(el('h3','个人指标 · '+adapters.metrics.categoryLabels[metric.category]),el('p',metric.value+' '+metric.unit+' · '+adapters.metrics.basisLabels[metric.basis]),el('p','基于修订 '+metric.revision+(p?.revision===metric.revision?'':' · 当前版本已变化或不可用，需复核'),'snapshot-meta'));paragraph(section,'原记录条件与基线',metric.conditions+'\n对照：'+metric.baseline);const dl=el('dl');for(const [key,label] of Object.entries(PaperFlowMetricContext.fields))dl.append(el('dt',label),el('dd',PaperFlowMetricContext.display(metric.context[key])));section.append(dl,el('blockquote',metric.quote),safeLink('指标来源 · '+metric.locator,metric.source_url));}
      root.append(section);
    }
    root.append(el('footer','此文件由用户在本机选择内容生成。假设和个人摘录不代表原文结论，全文链接不代表全文已读。文件不包含PDF、账号令牌、研究偏好或未选中的笔记。'));
    return {root,manifest};
  }
  $('snapshot-form').addEventListener('input',()=>{invalidate();$('snapshot-questions').hidden=$('snapshot-mode').value!=='questions';message('选项已改变，请重新生成预览。');});
  $('snapshot-form').onsubmit=async event=>{
    event.preventDefault();invalidate();const serial=generation;message('正在整理所选内容…');
    try{
      const options={title:$('snapshot-title').value.trim(),mode:$('snapshot-mode').value,notes:$('snapshot-notes').checked,metrics:$('snapshot-metrics').checked,questions:[...$('snapshot-question-list').querySelectorAll('input:checked')].map(n=>n.value)};
      if(!options.title)throw Error('请填写页面标题');
      const keys=['research',...(options.notes?['reading']:[]),...(options.metrics?['metrics']:[])],state=Object.fromEntries(keys.map(k=>[k,read(k)]));
      const [items,response]=await Promise.all([PaperFlow.getItems(),fetch(new URL('assets/snapshot-document.css',base))]);if(!response.ok)throw Error('快照样式加载失败，请重试');const css=await response.text();
      if(serial!==generation)return;
      const result=documentBody(options,items,state.research.value,state.reading?.value,state.metrics?.value);
      const doc=document.implementation.createHTMLDocument(options.title);doc.documentElement.lang='zh-CN';const charset=doc.createElement('meta');charset.setAttribute('charset','utf-8');doc.head.prepend(charset);const viewport=doc.createElement('meta');viewport.name='viewport';viewport.content='width=device-width, initial-scale=1';doc.head.append(viewport);
      const policy=doc.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";doc.head.append(policy);const style=doc.createElement('style');style.textContent=css;doc.head.append(style);doc.body.append(result.root.cloneNode(true));
      pending={html:'<!doctype html>\n'+doc.documentElement.outerHTML,raw:Object.fromEntries(keys.map(k=>[k,state[k].raw]))};
      $('snapshot-preview').replaceChildren(result.root);$('snapshot-manifest').textContent=result.manifest;$('snapshot-preview-section').hidden=false;$('snapshot-download').disabled=false;$('snapshot-download').classList.add('button');$('snapshot-prepare').classList.remove('button');
      message('预览已生成。请核对私人内容后下载；尚未上传或发送。');
    }catch(error){if(serial===generation){invalidate();message('未生成快照：'+error.message);}}
  };
  $('snapshot-download').onclick=()=>{
    if(!pending)return;
    try{for(const [k,raw] of Object.entries(pending.raw))if(localStorage.getItem(adapters[k].key)!==raw)throw Error('原记录已改变，请重新生成预览');
      const url=URL.createObjectURL(new Blob([pending.html],{type:'text/html;charset=utf-8'})),a=el('a');a.href=url;a.download='paperflow-snapshot-'+new Date().toISOString().slice(0,10)+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('已发起只读网页下载。确认文件保存后，可离线打开或手动分享。');
    }catch(error){invalidate();message('下载未完成：'+error.message);}
  };
  window.addEventListener('storage',()=>{invalidate();choices();message('原记录已变化，请重新生成预览。');});
  choices();
})();

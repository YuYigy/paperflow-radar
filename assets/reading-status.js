(() => {
  'use strict';
  const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  if(!$('task-status-import'))return;
  const labels={TEXT_EXTRACTED:'文本已提取 · 尚待核对',DRAFT_READY:'草稿已生成 · 尚待核查',FAILED:'本次生成失败',RUNNING:'曾开始处理 · 请在本机确认',UNKNOWN:'状态待确认'};
  let receipt=null,items=null,serial=0;
  const str=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max,date=v=>str(v,60)&&Number.isFinite(Date.parse(v));
  function validate(v){
    if(v?.schema!=='paperflow.reading-status/v1'||!date(v.generated_at)||!Number.isInteger(v.skipped)||v.skipped<0||!Array.isArray(v.requests)||!Array.isArray(v.results)||v.requests.length>2000||v.results.length>2000)throw Error();
    const ids=new Set();
    for(const r of v.requests){const key=r.id+'|'+r.mode;if(!str(r.id,500)||!str(r.title,2000)||!['skim','deep'].includes(r.mode)||r.status!=='imported'||!date(r.imported_at)||!date(r.requested_at)||ids.has(key))throw Error();ids.add(key);}
    for(const r of v.results){if(!/^[a-f0-9]{24}$/.test(r.artifact)||!str(r.record_id,120)||!/^[a-zA-Z0-9-]+$/.test(r.record_id)||!Number.isInteger(r.revision)||r.revision<1||!str(r.title,2000)||!Object.hasOwn(labels,r.status)||!Number.isInteger(r.pages)||r.pages<1||r.pages>200||typeof r.has_note!=='boolean'||!date(r.checked_at)||ids.has(r.artifact))throw Error();ids.add(r.artifact);}
    return v;
  }
  const when=v=>new Date(v).toLocaleString('zh-CN',{hour12:false});
  function relation(r){const item=items?.find(p=>p.record_id===r.record_id);return {item,text:items===null?'公开目录暂不可用，尚未核对修订':!item?'当前公开库无此论文；保留本机结果':item.revision!==r.revision?`旧修订 ${r.revision}；当前为 ${item.revision}，请重新核对`:`对应当前公开修订 ${r.revision}`};}
  function render(){
    if(!receipt)return;
    const list=$('task-status-list');list.replaceChildren();const filter=$('task-status-filter').value,q=$('task-status-search').value.trim().toLocaleLowerCase();
    const results=receipt.results.filter(r=>['all','results','attention'].includes(filter)&&(!q||`${r.title} ${r.record_id} ${r.artifact}`.toLocaleLowerCase().includes(q))&&(filter!=='attention'||['FAILED','RUNNING','UNKNOWN'].includes(r.status)||!relation(r).item||relation(r).item.revision!==r.revision));
    const requests=receipt.requests.filter(r=>['all','requests'].includes(filter)&&(!q||`${r.title} ${r.id}`.toLocaleLowerCase().includes(q)));
    $('task-status-summary').textContent=`本次显示 ${results.length} 份结果、${requests.length} 条请求 · 回执共 ${receipt.results.length} 份结果、${receipt.requests.length} 条请求`;
    for(const r of [...results].sort((a,b)=>Date.parse(b.checked_at)-Date.parse(a.checked_at))){
      const card=el('article');card.className='task-result';card.append(el('span',labels[r.status]),el('h3',r.title));card.firstChild.className='task-phase';
      const rel=relation(r);card.append(el('p',rel.text));const meta=el('p',`${r.pages} 页文本 · 材料时间 ${when(r.checked_at)}`);meta.className='fine';card.append(meta);
      const actions=el('div');actions.className='actions';const reader=el('a','打开精读页 →');reader.href='reader.html';actions.append(reader);if(rel.item){const a=el('a','论文与笔记 →');a.href=`items/${encodeURIComponent(r.record_id)}.html#personal-note`;actions.append(a);}card.append(actions);
      const detail=el('details'),summary=el('summary','如何找到证据包与笔记');detail.append(summary,el('p','在项目 data/private/reading-notes/ 中打开以下结果编号文件夹：'),el('code',r.artifact),el('p','选择其中 reader-packet.json，在精读页查看分页证据。'));
      if(r.has_note)detail.append(el('p','文件夹内还有 browser-import.json。先备份现有笔记，再通过本页“备份与迁移”合并；旧笔记文件不代表本次生成成功。'));
      if(['FAILED','RUNNING','UNKNOWN'].includes(r.status))detail.append(el('p','请在本机检查同目录的 report.json 与运行窗口。网页不会重新运行任务，也不能确认后台是否仍在执行。'));
      card.append(detail);list.append(card);
    }
    for(const r of requests){const card=el('article');card.className='task-result';const badge=el('span',`${r.mode==='deep'?'精读':'略读'}请求 · 已导入本机`);badge.className='task-phase';card.append(badge,el('h3',r.title),el('p','仅确认已进入任务箱，不代表已经执行或完成。'),el('p',`导入时间 ${when(r.imported_at)} · 请求时间 ${when(r.requested_at)}`),el('code',r.id));list.append(card);}
    if(!results.length&&!requests.length)list.append(el('p','没有符合条件的记录。可清空搜索或切换查看范围。'));
  }
  $('task-status-import').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;const run=++serial;
    try{if(file.size>8*1024*1024)throw Error();const incoming=validate(JSON.parse(await file.text()));let publicItems=null;try{publicItems=await PaperFlow.getItems();}catch(_){}if(run!==serial)return;
      receipt=incoming;items=publicItems;$('task-status-content').hidden=false;$('task-status-filter').value='all';$('task-status-search').value='';
      $('task-status-message').textContent=`状态截至 ${when(receipt.generated_at)}，不是实时进度。${receipt.skipped?`本机有 ${receipt.skipped} 个文件未能读取，未计入。`:''}需要更新时重新导出回执。`;render();
    }catch(_){if(run===serial)$('task-status-message').textContent='回执格式无效或文件过大，原有回执与私人数据均保留。';}finally{e.target.value='';}});
  $('task-status-filter').addEventListener('change',render);$('task-status-search').addEventListener('input',render);
  $('task-status-clear').addEventListener('click',()=>{++serial;receipt=null;items=null;$('task-status-list').replaceChildren();$('task-status-content').hidden=true;$('task-status-message').textContent='已关闭回执。阅读清单与笔记未改变。';});
})();

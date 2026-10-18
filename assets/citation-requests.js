(() => {
  'use strict';
  const base=new URL(document.body.dataset.prefix||'./',location.href), key='paperflow:citations:v1:'+base.pathname;
  const schema='paperflow.citation-requests/v1', el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  let state={schema,requests:[]}, blocked=false;
  function valid(value){
    if(value?.schema!==schema||!Array.isArray(value.requests)||value.requests.length>500)throw Error();
    const ids=new Set();
    return {schema,requests:value.requests.map(r=>{
      if(!r||typeof r.id!=='string'||r.id.length>500||!(/^(W\d+|doi:10\.[^\s<>]+|record:[a-zA-Z0-9-]+)$/.test(r.id))||ids.has(r.id)||!['skim','deep'].includes(r.mode)||typeof r.title!=='string'||r.title.length>2000||!Number.isFinite(Date.parse(r.updated_at)))throw Error();
      ids.add(r.id);const url=new URL(r.url);if(url.protocol!=='https:'||url.username||url.password)throw Error();
      return {id:r.id,title:r.title,url:url.href,mode:r.mode,updated_at:r.updated_at,origin:typeof r.origin==='string'?r.origin.slice(0,200):''};
    })};
  }
  function message(text){const p=document.getElementById('citation-request-status');if(p)p.textContent=text;}
  function read(){try{const raw=localStorage.getItem(key);state=raw?valid(JSON.parse(raw)):{schema,requests:[]};blocked=false;}catch(_){blocked=true;message('队列暂时无法读取，原数据保留。请先导出备份检查。');}}
  function save(next){
    if(blocked)return false;
    try{next=valid(next);localStorage.setItem(key,JSON.stringify(next));state=next;render();return true;}catch(_){message('保存失败，请检查浏览器存储空间。');return false;}
  }
  function add(node,mode,origin){read();if(blocked)return false;const requests=state.requests.filter(r=>r.id!==node.id);
    if(requests.length>=500)return false;
    requests.push({id:node.id,title:node.title,url:node.url,mode,origin,updated_at:new Date().toISOString()});return save({schema,requests});
  }
  function render(){
    document.querySelectorAll('[data-citation-queue-count]').forEach(n=>n.textContent=`${state.requests.length} 篇`);
    const list=document.getElementById('citation-request-list');if(!list)return;list.replaceChildren();
    if(blocked){list.append(el('p','队列读取失败；不会覆盖原数据。'));return;}
    if(!state.requests.length)list.append(el('p','还没有引文阅读任务。打开一篇论文的关系图，双击感兴趣的节点开始。'));
    for(const r of [...state.requests].sort((a,b)=>b.updated_at.localeCompare(a.updated_at))){
      const card=el('article');card.className='triage-card';const h=el('h3'),a=el('a',r.title);a.href=r.url;a.rel='noreferrer';h.append(a);
      card.append(h,el('p',`${r.mode==='deep'?'精读':'略读'} · 待处理 · 仅此浏览器`));
      const actions=el('div');actions.className='actions';const toggle=el('button',r.mode==='deep'?'改为略读':'改为精读'),remove=el('button','移出队列');
      toggle.onclick=()=>{read();const current=state.requests.find(x=>x.id===r.id);if(current)add(current,current.mode==='deep'?'skim':'deep',current.origin);};
      remove.onclick=()=>{read();save({schema,requests:state.requests.filter(x=>x.id!==r.id)});};actions.append(toggle,remove);card.append(actions);list.append(card);
    }
  }
  read();render();
  document.getElementById('citation-request-export')?.addEventListener('click',()=>{
    read();let raw;try{raw=blocked?localStorage.getItem(key):JSON.stringify(state,null,2);}catch(_){message('无法访问浏览器存储。');return;}
    const url=URL.createObjectURL(new Blob([raw||''],{type:'application/json'})),a=el('a');a.href=url;a.download=blocked?'paperflow-citation-recovery.txt':'paperflow-citation-requests.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('已导出。将文件拖到本机 import-paper-requests.cmd 接入待处理任务箱。');
  });
  document.getElementById('citation-request-import')?.addEventListener('change',async e=>{try{
    const file=e.target.files[0];if(!file)return;if(file.size>3*1024*1024)throw Error();const incoming=valid(JSON.parse(await file.text()));read();if(blocked)throw Error();
    const merged=new Map(state.requests.map(r=>[r.id,r]));for(const r of incoming.requests)if(!merged.has(r.id)||Date.parse(r.updated_at)>Date.parse(merged.get(r.id).updated_at))merged.set(r.id,r);
    if(!save({schema,requests:[...merged.values()]}))throw Error();message('已合并队列，未执行阅读或上传。');
  }catch(_){message('导入失败：请使用有效队列备份；原数据未更改。');}finally{e.target.value='';}});
  window.addEventListener('storage',e=>{if(e.key===key||e.key===null){read();render();}});
  window.PaperFlowCitationQueue=Object.freeze({add,getState:()=>JSON.parse(JSON.stringify(state))});
})();

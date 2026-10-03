"use strict";
(() => {
  const base=new URL('./',location.href),key='paperflow:visits:v1:'+base.pathname;
  const cards=[...document.querySelectorAll('#today-list .card')], topic=document.getElementById('today-topic');
  const ack=document.getElementById('today-ack');let model,seen=null,blocked=false,view='recommended';
  function readSeen(){try{const raw=localStorage.getItem(key);if(!raw)return null;const value=JSON.parse(raw);if(value.schema!=='paperflow.visits/v1'||!value.records||typeof value.records!=='object'||Array.isArray(value.records)||Object.entries(value.records).some(([id,rev])=>!id||!Number.isInteger(rev)||rev<1))throw Error('invalid');return value;}catch(_){blocked=true;ack.disabled=true;return null;}}
  seen=readSeen();
  function render(){if(!model)return;
    const ranked=model.ranked.filter(r=>!topic.value||cards.find(c=>c.dataset.id===r.record_id)?.dataset.topics.split('|').includes(topic.value));
    const active=r=>{const e=PaperFlow.getReadingEntry(r.record_id);return e&&e.status!=='done';};
    const unread=ranked.filter(r=>{const e=PaperFlow.getReadingEntry(r.record_id);return !e||e.status!=='done'||e.revision!==r.revision;});
    let recommended=unread.slice(0,6);const conference=unread.find(r=>r.kind==='conference');
    if(conference&&recommended.length&&!recommended.some(r=>r.kind==='conference'))recommended=[...unread.slice(0,5),conference];
    const changes=seen?ranked.filter(r=>seen.records[r.record_id]!==r.revision):[];
    const ongoing=ranked.filter(active);
    const group={recommended,changes,continue:ongoing,all:ranked}[view];const show=new Set(group.map(r=>r.record_id));
    for(const card of cards){const row=ranked.find(r=>r.record_id===card.dataset.id);card.hidden=!show.has(card.dataset.id);let hint=card.querySelector('.daily-reason');if(!hint){hint=document.createElement('p');hint.className='daily-reason fine';card.prepend(hint);}hint.textContent=row?row.reason+(seen&&seen.records[row.record_id]!==row.revision?(seen.records[row.record_id]?' · 解读已修订':' · 新增解读'):''):'';}
    document.getElementById('daily-recommend-count').textContent=String(recommended.length);
    document.getElementById('daily-new-count').textContent=seen?String(changes.length):'—';
    document.getElementById('daily-continue-count').textContent=String(ongoing.length);
    document.getElementById('daily-visit-note').textContent=blocked?'访问存储不可用，已保留原记录并停止写入。':seen?'与上次明确确认的版本比较，只在此浏览器保存。':'首次使用，确认本版后开始记录新增与修订。';
    document.getElementById('today-count').textContent=group.length+' 篇';
    document.getElementById('today-empty').hidden=group.length>0;
    document.getElementById('today-empty-note').textContent=view==='changes'&&!seen?'先点击“记为已查看本版更新”，下次即可发现新增与修订。':'可以切换方向或浏览全部候选。';
    for(const b of document.querySelectorAll('[data-today-view]'))b.setAttribute('aria-pressed',String(b.dataset.todayView===view));
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-today-view]');if(button){view=button.dataset.todayView;render();}const tag=event.target.closest('[data-filter-topic]');if(tag){topic.value=tag.dataset.filterTopic;render();}});
  topic.addEventListener('input',render);
  ack.addEventListener('click',()=>{if(blocked||!model)return;const snapshot={schema:'paperflow.visits/v1',records:Object.fromEntries(model.ranked.map(r=>[r.record_id,r.revision]))};try{localStorage.setItem(key,JSON.stringify(snapshot));seen=snapshot;render();}catch(_){blocked=true;ack.disabled=true;render();}});
  window.addEventListener('paperflow:reading-changed',render);
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){seen=readSeen();render();}});
  fetch('data/reading-dashboard.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(value=>{if(value.schema!=='paperflow.reading-dashboard/v1')throw Error();model=value;render();}).catch(()=>{ack.disabled=true;document.getElementById('today-count').textContent='更新提醒暂不可用，以下保留本版阅读候选。';});
})();

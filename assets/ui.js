"use strict";
(() => {
  const base=new URL(document.body.dataset.prefix||'./',location.href),key='paperflow:ui:v1:'+base.pathname;
  const notice=t=>{const node=document.getElementById('app-notice');node.textContent=t;node.hidden=false;};
  let compact=false;try{compact=localStorage.getItem(key)==='compact';}catch(_){}
  const button=document.getElementById('view-density');
  function apply(){document.body.classList.toggle('compact-view',compact);if(button){button.textContent=compact?'舒适阅读':'紧凑浏览';button.setAttribute('aria-pressed',String(compact));}}
  apply();button?.addEventListener('click',()=>{compact=!compact;apply();try{localStorage.setItem(key,compact?'compact':'comfortable');}catch(_){notice('已切换本页显示，浏览器未允许保存偏好。');}});
  const search=document.getElementById('catalog-search')||document.getElementById('search');
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target.closest('input,textarea,select,[contenteditable=true]')&&search){e.preventDefault();search.focus();search.scrollIntoView({block:'center'});}});
  const toolbar=document.querySelector('body[data-page="catalog"] .filter-panel .toolbar, body[data-page="conferences"] .filter-panel .toolbar');
  if(toolbar){toolbar.id='advanced-catalog-controls';const toggle=document.createElement('button');toggle.type='button';toggle.className='advanced-toggle';toggle.textContent='收起进阶筛选';toggle.setAttribute('aria-controls',toolbar.id);toggle.setAttribute('aria-expanded','true');toolbar.before(toggle);toggle.addEventListener('click',()=>{toolbar.hidden=!toolbar.hidden;toggle.textContent=toolbar.hidden?'展开进阶筛选':'收起进阶筛选';toggle.setAttribute('aria-expanded',String(!toolbar.hidden));});}
  const nav=document.querySelector('.site-header nav'),active=nav?.querySelector('[aria-current]');
  if(active&&nav.scrollWidth>nav.clientWidth)nav.scrollLeft+=active.getBoundingClientRect().left-nav.getBoundingClientRect().left-12;
  window.addEventListener('storage',e=>{if(e.key===key){compact=e.newValue==='compact';apply();}});
})();

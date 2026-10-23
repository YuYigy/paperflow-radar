"use strict";
(() => {
  const base=new URL(document.body.dataset.prefix||'./',document.baseURI),key='paperflow:ui:v1:'+base.pathname;
  const notice=t=>{const node=document.getElementById('app-notice');node.textContent=t;node.hidden=false;};
  let compact=false;try{compact=localStorage.getItem(key)==='compact';}catch(_){}
  const button=document.getElementById('view-density');
  function apply(){document.body.classList.toggle('compact-view',compact);if(button){button.textContent=compact?'舒适阅读':'紧凑浏览';button.setAttribute('aria-pressed',String(compact));}}
  apply();button?.addEventListener('click',()=>{compact=!compact;apply();try{localStorage.setItem(key,compact?'compact':'comfortable');}catch(_){notice('已切换本页显示，浏览器未允许保存偏好。');}});
  const search=document.getElementById('catalog-search')||document.getElementById('workspace-search')||document.getElementById('version-search')||document.getElementById('search');
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target.closest('input,textarea,select,[contenteditable=true]')&&search){e.preventDefault();search.focus();search.scrollIntoView({block:'center'});}});
  const savedDisclosure=document.querySelector('.save-search-disclosure');
  if(savedDisclosure&&new URLSearchParams(location.search).has('saved'))savedDisclosure.open=true;
  function updateFilterGroups(reveal=false){
    for(const group of document.querySelectorAll('[data-filter-group]')){
      const count=[...group.querySelectorAll('input,select')].filter(c=>c.value).length;
      const badge=group.querySelector('[data-group-count]');if(badge)badge.textContent=count?count+' 项已选':'';
      if(reveal&&count)group.open=true;
    }
  }
  document.addEventListener('paperflow:catalog-filtered',()=>updateFilterGroups());
  document.addEventListener('paperflow:filters-restored',()=>updateFilterGroups(true));
  document.addEventListener('input',()=>updateFilterGroups());
  document.addEventListener('paperflow:library-filtered',()=>updateFilterGroups());
  const nav=document.querySelector('.site-header nav'),active=nav?.querySelector('[aria-current]');
  if(active&&nav.scrollWidth>nav.clientWidth)nav.scrollLeft+=active.getBoundingClientRect().left-nav.getBoundingClientRect().left-12;
  window.addEventListener('storage',e=>{if(e.key===key){compact=e.newValue==='compact';apply();}});
  const topButton=document.createElement('button');topButton.type='button';topButton.className='back-to-top';topButton.textContent='↑ 顶部';topButton.setAttribute('aria-label','返回页面顶部');topButton.hidden=true;document.body.append(topButton);
  let scrollFrame=0;
  const topState=()=>{scrollFrame=0;topButton.hidden=scrollY<800;};
  addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(topState);},{passive:true});topState();
  topButton.addEventListener('click',()=>{window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});document.querySelector('.skip')?.focus({preventScroll:true});});
  // Keep sticky navigation offsets correct at different zoom levels and wrapped desktop widths.
  const header=document.querySelector('.site-header');
  if(header)new ResizeObserver(()=>{document.documentElement.style.setProperty('--header-offset',innerWidth>760?header.getBoundingClientRect().height+'px':'0px');}).observe(header);
})();

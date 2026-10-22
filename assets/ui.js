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
  const toolbar=document.querySelector('body[data-page="catalog"] .filter-panel .toolbar, body[data-page="conferences"] .filter-panel .toolbar');
  const savedDisclosure=document.querySelector('.save-search-disclosure');
  if(savedDisclosure&&new URLSearchParams(location.search).has('saved'))savedDisclosure.open=true;
  if(toolbar){
    // §2.4: start with useful search controls, disclose secondary filters on demand.
    toolbar.id='advanced-catalog-controls';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='advanced-toggle';toggle.setAttribute('aria-controls',toolbar.id);toolbar.before(toggle);
    const advanced=['year','evidence','presentation','rank','hust','exchange','session','topic','review','period'];
    const params=new URLSearchParams(location.search);toolbar.hidden=!advanced.some(k=>params.get(k));
    const update=()=>{const count=advanced.filter(k=>document.getElementById('catalog-'+k)?.value).length;toggle.textContent=(toolbar.hidden?'更多筛选':'收起筛选')+(count?' · '+count+' 项已选':' · 等级、主题与时间');toggle.setAttribute('aria-expanded',String(!toolbar.hidden));};
    toggle.addEventListener('click',()=>{toolbar.hidden=!toolbar.hidden;update();});
    document.addEventListener('paperflow:catalog-filtered',update);update();
  }
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

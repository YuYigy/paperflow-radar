/* Navigation and attribute discovery only. Existing state schemas and URL filters stay intact. */
(() => {
  'use strict';
  function revealAnchor(){if(location.hash==='#profile'){const panel=document.getElementById('profile-settings');if(panel){panel.open=true;document.getElementById('profile')?.scrollIntoView();}}}
  revealAnchor();window.addEventListener('hashchange',revealAnchor);
  if(document.body.dataset.page==='discovery'&&['#triage','#citation-requests'].includes(location.hash)){
    const root=new URL(document.body.dataset.prefix||'./',document.baseURI);
    location.replace(new URL('workspace/'+location.hash,root));return;
  }
  for(const panel of document.querySelectorAll('.paper-filters')){
    const nav=panel.querySelector('.filter-jump');if(!nav)continue;
    for(const [i,group] of [...panel.querySelectorAll('[data-filter-group]')].entries()){
      group.id ||= 'filter-attribute-'+i;
      const title=group.querySelector('summary>span').firstChild.textContent.trim();
      const button=document.createElement('button');button.type='button';button.textContent=title;button.setAttribute('aria-controls',group.id);
      const sync=()=>button.setAttribute('aria-expanded',String(group.open));sync();group.addEventListener('toggle',sync);
      button.addEventListener('click',()=>{group.open=true;group.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});group.querySelector('select,input')?.focus({preventScroll:true});});nav.append(button);
    }
  }
})();

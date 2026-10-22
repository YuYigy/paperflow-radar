(() => {
  'use strict';
  const detail=document.querySelector('.paper-detail'),content=detail?.querySelector('.detail-content');if(!content)return;
  const toc=[...detail.querySelectorAll('.toc a[href]')].map(link=>({link,section:document.getElementById(link.hash.slice(1))})).filter(x=>x.section);
  const bar=document.createElement('div');bar.className='reading-toolbar';bar.setAttribute('aria-label','正文阅读工具');
  const position=document.createElement('div');position.className='reading-position';const label=document.createElement('span');label.id='reading-position-label';label.textContent='正文浏览位置 0%';
  const progress=document.createElement('progress');progress.max=100;progress.value=0;progress.setAttribute('aria-labelledby',label.id);position.append(label,progress);
  const jumpLabel=document.createElement('label');jumpLabel.className='reading-jump-label';jumpLabel.textContent='跳到';const jump=document.createElement('select');jump.id='reading-jump';jump.setAttribute('aria-label','跳转到论文章节');
  for(const {link,section}of toc)jump.add(new Option(link.textContent,section.id));jumpLabel.append(jump);
  const focus=document.createElement('button');focus.type='button';focus.id='reading-focus';focus.textContent='专注阅读';focus.setAttribute('aria-pressed','false');
  bar.append(position,jumpLabel,focus);detail.querySelector('.detail-layout').before(bar);
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  function moveTo(target){target.scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'start'});}
  jump.addEventListener('change',()=>{const target=document.getElementById(jump.value);if(target){moveTo(target);const url=new URL(location.href);url.hash=target.id;history.replaceState(null,'',url);}});
  focus.addEventListener('click',()=>{const active=document.body.classList.toggle('focus-reading');focus.textContent=active?'退出专注':'专注阅读';focus.setAttribute('aria-pressed',String(active));schedule();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('focus-reading')&&!document.querySelector('dialog[open]')){document.body.classList.remove('focus-reading');focus.textContent='专注阅读';focus.setAttribute('aria-pressed','false');focus.focus();schedule();}});
  let frame=0;
  function update(){
    frame=0;const top=bar.getBoundingClientRect().bottom+24,rect=content.getBoundingClientRect();
    const value=Math.round(Math.max(0,Math.min(100,(top-rect.top)/Math.max(1,rect.height-(innerHeight-top))*100)));
    progress.value=value;label.textContent=`正文浏览位置 ${value}%`;
    const ordered=toc.map(x=>({...x,y:x.section.getBoundingClientRect().top})).sort((a,b)=>a.y-b.y);
    const current=ordered.filter(x=>x.y<=top+12).at(-1)||ordered[0];
    for(const entry of toc){if(entry===undefined)continue;if(entry.section===current?.section)entry.link.setAttribute('aria-current','location');else entry.link.removeAttribute('aria-current');}
    if(current&&document.activeElement!==jump)jump.value=current.section.id;
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
  new ResizeObserver(schedule).observe(content);new ResizeObserver(schedule).observe(detail);schedule();
})();

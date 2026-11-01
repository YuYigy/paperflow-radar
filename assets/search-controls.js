/* §2.1 / §2.8 / §3.6: draft input -> candidate -> one explicit search action.
   Keep existing native selects as the source of truth, and existing URL/storage schemas.
   Color, space, focus and elevation come from the site's light theme tokens. */
'use strict';
(() => {
  const applied=new WeakMap();
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const value=c=>c?(applied.has(c)?applied.get(c):c.value):'';
  const set=(c,v)=>{c.value=v;if(applied.has(c))applied.set(c,v);};
  function popup(input,choices,choose,{empty='没有匹配候选，可直接按原词检索',limit=10,autoFirst=false}={}){
    const wrap=el('div',undefined,'search-combobox');input.replaceWith(wrap);wrap.append(input);
    const list=el('div',undefined,'search-options');list.id=input.id+'-options';list.setAttribute('role','listbox');list.setAttribute('aria-label','匹配候选');list.hidden=true;wrap.append(list);
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');input.autocomplete='off';
    let rows=[],active=-1,opened=false;
    const close=()=>{opened=false;list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
    function pick(i){const row=rows[i];if(!row)return;choose(row);close();input.focus({preventScroll:true});}
    function highlight(i){active=i;for(const [j,node] of [...list.querySelectorAll('[role=option]')].entries())node.setAttribute('aria-selected',String(i===j));const node=list.children[i];if(node&&rows[i]){input.setAttribute('aria-activedescendant',node.id);node.scrollIntoView({block:'nearest'});}}
    function show(){
      const candidates=choices(input.value);rows=candidates.slice(0,limit);list.replaceChildren();active=-1;input.removeAttribute('aria-activedescendant');
      rows.forEach((row,i)=>{const node=el('div',undefined,'search-option');node.id=list.id+'-'+i;node.setAttribute('role','option');node.setAttribute('aria-selected','false');node.append(el('strong',row.label));if(row.detail)node.append(el('small',row.detail));node.addEventListener('mousedown',e=>e.preventDefault());node.addEventListener('click',e=>{e.preventDefault();pick(i);});list.append(node);});
      if(!rows.length)list.append(el('p',empty,'search-option-note'));
      if(candidates.length>limit)list.append(el('p','显示前 '+limit+' 项，请继续输入缩小范围','search-option-note'));
      list.hidden=false;opened=true;input.setAttribute('aria-expanded','true');
      const anchor=(input.closest('.filter-search')||wrap).getBoundingClientRect();
      const viewport=window.visualViewport,top=viewport?.offsetTop||0,bottom=top+(viewport?.height||innerHeight);
      list.classList.toggle('search-options-above',bottom-anchor.bottom<list.offsetHeight+8&&anchor.top-top>list.offsetHeight+8);
      if(autoFirst&&rows.length)highlight(0);
    }
    input.addEventListener('input',e=>{if(!e.isComposing)show();});
    input.addEventListener('compositionend',show);
    input.addEventListener('keydown',e=>{
      if(e.isComposing||e.keyCode===229)return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!opened)show();if(rows.length)highlight((active+(e.key==='ArrowDown'?1:active<0?0:-1)+rows.length)%rows.length);}
      else if(e.key==='Escape'&&opened){e.preventDefault();e.stopPropagation();close();}
      else if(e.key==='Enter'&&opened&&active>=0){e.preventDefault();e.stopImmediatePropagation();pick(active);}
      else if(e.key==='Tab')close();
    });
    wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))close();});
    document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close();});
    return {show,close,refresh:()=>{if(opened)show();}};
  }
  function bind(controls,onSubmit){
    const panel=controls.search.closest('.paper-filters'),texts=['search','author','keyword'].map(k=>controls[k]).filter(Boolean);
    const status=panel.querySelector('[data-search-status]'),button=panel.querySelector('[data-search-submit]');
    let authorIndex=[];
    function dirty(){return texts.some(c=>c.value.trim()!==value(c));}
    function sync(){status.textContent=dirty()?'输入尚未应用，按 Enter 或点击“确定检索”。':'输入匹配候选，确认后检索；其他筛选选中即生效。';}
    function reset(){for(const c of texts)applied.set(c,c.value.trim());sync();}
    function commit(){reset();for(const c of texts)c.dispatchEvent(new Event('paperflow:close-candidates'));onSubmit();}
    reset();button.addEventListener('click',commit);
    for(const c of texts){
      if(c!==controls.keyword){
        const menu=popup(c,q=>q.trim()?authorIndex.filter(a=>PaperAttributes.authorMatch(a.label,q)):[],row=>{c.value=row.label;sync();},{empty:'没有匹配姓名；可输入原词确认检索。英文姓名可连写或交换姓、名顺序。'});
        c.addEventListener('focus',()=>{if(c.value.trim())menu.show();});c.addEventListener('paperflow:close-candidates',menu.close);
      }
      c.addEventListener('input',sync);
      c.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();commit();}});
    }
    const api={reset,commit,sync,setAuthors(papers){const counts=new Map();for(const p of papers)for(const name of new Set(p.authors||[]))counts.set(name,(counts.get(name)||0)+1);authorIndex=[...counts].map(([label,n])=>({label,detail:'作者姓名 · 当前范围 '+n+' 条记录（同名未合并身份）'})).sort((a,b)=>a.label.localeCompare(b.label,'en',{sensitivity:'base'}));}};
    return api;
  }
  function enhanceSelect(select){
    if(!select||select.dataset.searchEnhanced)return;select.dataset.searchEnhanced='true';
    const label=select.closest('label'),input=el('input');input.type='text';input.id=select.id+'-picker';input.className='select-search-input';input.setAttribute('aria-label',label.firstChild.textContent.trim()+'：输入匹配，选择应用');
    select.before(input);select.hidden=true;label.htmlFor=input.id;
    const optionLabel=o=>o.dataset.label||o.textContent;
    const sort=()=>{const old=[...select.options],ordered=[...old].sort((a,b)=>!a.value?-1:!b.value?1:optionLabel(a).localeCompare(optionLabel(b),'en',{sensitivity:'base',numeric:true}));if(ordered.some((o,i)=>o!==old[i])){const v=select.value;select.replaceChildren(...ordered);select.value=v;}};
    let editing=false;
    const sync=()=>{sort();if(!editing)input.value=select.selectedOptions[0]?.textContent||'';input.disabled=select.disabled;};
    const menu=popup(input,q=>[...select.options].filter(o=>!o.hidden&&!o.disabled&&PaperAttributes.norm([optionLabel(o),o.title,o.value].join(' ')).includes(PaperAttributes.norm(q))).map(o=>({label:o.textContent,detail:o.title||'',value:o.value})),row=>{select.value=row.value;editing=false;sync();select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));},{empty:'没有匹配选项，试试缩写或全称。',limit:200,autoFirst:true});
    input.parentElement.classList.add('select-search');
    input.addEventListener('focus',()=>{if(!editing){editing=true;input.value='';input.placeholder='输入缩写或全称';menu.show();}});
    input.addEventListener('click',()=>{if(!editing){editing=true;input.value='';menu.show();}});
    input.addEventListener('blur',()=>{editing=false;sync();});
    input.addEventListener('keydown',e=>{if(e.key==='Escape'){editing=false;sync();menu.close();}});
    select.addEventListener('change',sync);
    new MutationObserver(()=>{sync();menu.refresh();}).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled']});
    for(const name of ['paperflow:catalog-filtered','paperflow:library-filtered','paperflow:filters-restored'])document.addEventListener(name,sync);
    sync();
  }
  window.PaperSearchControls={value,set,bind,enhanceSelect};
  for(const id of ['catalog-venue','venue','explore-venue','catalog-session'])enhanceSelect(document.getElementById(id));
})();

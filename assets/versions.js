"use strict";
(() => {
  const search=document.getElementById('version-search'),kind=document.getElementById('version-kind');
  const cards=[...document.querySelectorAll('.version-relation')].map(node=>({node,text:node.textContent.normalize('NFKC').toLowerCase(),keys:(node.dataset.versionKeys+' '+node.dataset.versionRecords).split(/\s+/)}));
  const updates=[...document.querySelectorAll('.version-update')];let paper='',limit=20;
  function restore(){limit=20;const q=new URLSearchParams(location.search);search.value=q.get('q')||'';kind.value=q.get('kind')||'';if(kind.selectedIndex<0)kind.value='';paper=q.get('paper')||'';render(false);}
  function render(write=true){const terms=search.value.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);let count=0;
    for(const c of cards){c.node.hidden=!!((paper&&!c.keys.includes(paper))||(kind.value&&c.node.dataset.kind!==kind.value)||!terms.every(t=>c.text.includes(t)));if(!c.node.hidden){count++;if(count>limit)c.node.hidden=true;}}
    let shown=0;for(const u of updates){u.hidden=!!((paper&&u.dataset.versionRecord!==paper)||!terms.every(t=>u.textContent.normalize('NFKC').toLowerCase().includes(t)));if(!u.hidden)shown++;}
    document.getElementById('version-updates').hidden=!!(paper||terms.length||kind.value)&&shown===0;
    document.getElementById('version-count').textContent='匹配 '+count+' / '+cards.length+' 条登记关系 · 已显示 '+Math.min(count,limit)+' 条';document.getElementById('version-more').hidden=count<=limit;document.getElementById('version-empty').hidden=count>0;
    document.getElementById('version-context').textContent=paper?'正在查看所选论文的关联记录；清除筛选可返回全部关系。':'';
    if(write){const url=new URL(location.href);for(const [k,v] of [['q',search.value.trim()],['kind',kind.value],['paper',paper]]){if(v)url.searchParams.set(k,v);else url.searchParams.delete(k);}history.replaceState(null,'',url);}
  }
  for(const n of [search,kind])n.addEventListener('input',()=>{limit=20;render();});document.getElementById('version-reset').addEventListener('click',()=>{search.value='';kind.value='';paper='';limit=20;render();});document.getElementById('version-more').addEventListener('click',()=>{limit+=20;render();});window.addEventListener('popstate',restore);restore();
})();

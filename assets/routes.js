/* Directory URLs have real index files. Old bookmarks and storage keys remain valid. */
"use strict";
(() => {
  const originalBase=document.baseURI;
  const baseElement=document.querySelector('base');
  if(baseElement)baseElement.href=originalBase;
  const root=new URL(document.body.dataset.prefix||'./',originalBase);
  const pages=new Set(['today','catalog','conferences','explore','workspace','venues','discovery','research','reader','lab','versions','updates','archive','about']);
  function clean(url){
    if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return url;
    const local=url.pathname.slice(root.pathname.length);
    if(local==='index.html')url.pathname=root.pathname;
    else if(local.endsWith('.html')&&(pages.has(local.slice(0,-5))||/^items\/[\w-]+\.html$/.test(local)))url.pathname=root.pathname+local.slice(0,-5)+'/';
    return url;
  }
  const current=clean(new URL(location.href));
  if(current.href!==location.href)history.replaceState(history.state,'',current);
  function update(a){
    const value=a.getAttribute('href');if(!value)return;
    const url=clean(new URL(value,value.startsWith('#')?location.href:originalBase));
    if(a.href!==url.href)a.href=url.href;
  }
  function scan(node){if(node.nodeType!==1)return;if(node.matches('a[href]'))update(node);node.querySelectorAll('a[href]').forEach(update);}
  scan(document.body);
  new MutationObserver(records=>{for(const r of records){if(r.type==='attributes')update(r.target);else r.addedNodes.forEach(scan);}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
})();

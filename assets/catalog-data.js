/* A shared search request; complete metadata loads only when a reader opens it. */
'use strict';
(() => {
  const base=new URL('data/',new URL(document.body.dataset.prefix||'./',document.baseURI)),chunks=new Map();
  let pending;
  async function json(path,schema){
    const response=await fetch(new URL(path,base));
    if(!response.ok)throw Error('catalog-load');
    const value=await response.json();
    if(value.schema!==schema)throw Error('catalog-schema');
    return value;
  }
  function load(){
    if(!pending)pending=json('catalog-search.json','paperflow.catalog-search/v1').then(data=>{
      data.papers=data.papers.map(p=>({...data.shared[p.venue_key],...p}));
      return data;
    }).catch(error=>{pending=null;throw error;});
    return pending;
  }
  async function attributes(paper){
    const data=await load(),path=data.detail_chunks[paper.detail_chunk];
    if(!path)throw Error('catalog-detail-missing');
    if(!chunks.has(path))chunks.set(path,json(path,'paperflow.catalog-details/v1').catch(error=>{chunks.delete(path);throw error;}));
    const value=(await chunks.get(path)).papers[paper.index_id];
    if(!value)throw Error('catalog-paper-missing');
    return value;
  }
  window.PaperCatalogData={load,attributes};
})();

/* §2.1/§8.4: counts explain choices; recovery names one change and its result.
   Text/action hierarchy uses existing ink/muted/accent and spacing tokens. */
'use strict';
(() => {
  const label=option=>option.dataset.label||(option.dataset.label=option.textContent);
  function values(p,key,today){
    const a=p.attributes;
    const direct={venue:p.venue_key,kind:p.kind,year:String(p.year),evidence:p.has_abstract?'yes':'no',
      presentation:p.presentation_type,rank:p.rank_label,hust:p.hust_rule_grade||'unverified',
      exchange:p.exchange_grade||'unlisted',focus:p.focus_tier||'unrated',session:p.session,review:p.reading_url?'yes':'no'};
    if(key in direct)return [direct[key]];
    if(key==='topic')return p.theme_hints;
    if(key==='keyword_source')return [a.content.author_keywords.length?'author':null,a.content.topic_tags.length?'derived':null].filter(Boolean);
    if(key==='metadata')return [a.provenance.missing.includes('authors')?'missing-author':null,
      a.provenance.missing.includes('author_keywords')?'missing-keywords':null,a.provenance.missing.includes('doi')?'missing-doi':null,
      a.content.direction_basis==='unclassified'?'unclassified':null].filter(Boolean);
    if(key==='period'){
      if(!/^\d{4}-\d\d-\d\d$/.test(p.date)||['publication-year','publication-month'].includes(p.date_basis))return [];
      const age=(today-Date.parse(p.date+'T00:00:00Z'))/86400000;
      return [7,30,90,365].filter(days=>age>=0&&age<days).map(String);
    }
    return [];
  }
  function calculate(papers,filters,controls,eligible){
    const counts={},relaxed={},today=Date.parse(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date())+'T00:00:00Z');
    for(const [key,control] of Object.entries(controls)){
      if(control.tagName!=='SELECT'&&!filters[key])continue;
      const others={...filters,[key]:''},totals=new Map();let total=0;
      for(const p of papers){
        if(!eligible(p)||!PaperFlowDiscovery.match(p,others))continue;
        total++;
        for(const value of new Set(values(p,key,today))){
          if(key==='keyword_source'&&filters.keyword&&!PaperFlowDiscovery.match(p,{...others,keyword_source:value}))continue;
          totals.set(value,(totals.get(value)||0)+1);
        }
      }
      relaxed[key]=total;counts[key]=totals;totals.set('',total);
      if(key==='topic')for(const option of control.options){
        if(option.value&&!totals.has(option.value)){
          let n=0;for(const [topic,count] of totals)if(PaperAttributes.topicMatch([topic],option.value))n+=count;
          // A legacy direction can map to two overlapping categories; count papers once.
          if(n)totals.set(option.value,papers.filter(p=>eligible(p)&&PaperFlowDiscovery.match(p,{...others,topic:option.value})).length);
        }
      }
      if(control.tagName==='SELECT')for(const option of control.options){
        option.value=option.value;
        const n=totals.get(option.value)||0;
        option.textContent=label(option)+' · '+n;
        option.dataset.count=String(n);
      }
    }
    return {counts,relaxed};
  }
  window.PaperCatalogFacets={calculate,label};
})();

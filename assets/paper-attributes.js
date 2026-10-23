/* Shared field-specific search. Author keywords never fall back to title words. */
'use strict';
(() => {
  const norm=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
  const groups=[['硅光','silicon photonics','silicon photonic'],['相干通信','相干','coherent'],['光互连','interconnect'],['共封装','cpo','co-packaged'],['均衡','equalization','equalisation','equalizer'],['光子集成','integrated photonics'],['微波光子','microwave photonics'],['光纤','fiber','fibre'],['光频梳','microcomb','frequency comb'],['空芯光纤','hollow-core','hollow core'],['自由空间光通信','fso','free-space'],['调制器','modulator'],['光收发机','transceiver'],['光网络','optical network']];
  const legacyTopics={'相干传输与光互连':['光通信与光互连'],'硅光与集成器件':['通信光子器件与集成'],'DSP与编码':['DSP、编码与智能算法'],'光网络与交换':['光网络与控制'],'光纤与传感':['光纤与传输介质','光学传感与测量'],'微波与太赫兹光子':['微波与太赫兹光子学'],'自由空间光通信':['自由空间、可见光与空间光通信'],'量子与新型光计算':['量子通信与网络','光计算与交叉光子学'],'其他光子学 / 待归类':['待分类'],'系统与传输':['光通信与光互连'],'收发机、光模块与光互连':['光通信与光互连']};
  const topicMatch=(values,topic)=>(legacyTopics[topic]||[topic]).some(t=>values.includes(t));
  function restoreTopic(select,value){if(legacyTopics[value]&&![...select.options].some(o=>o.value===value))select.add(new Option(value+' · 旧分类兼容',value));select.value=value;}
  function constrainVenues(venue,kind,clear=false){for(const option of venue.options){const mismatch=Boolean(kind&&option.value&&option.dataset.kind!==kind);option.hidden=mismatch;option.disabled=mismatch;if(clear&&mismatch&&option.selected)venue.value='';}}
  function keywordMatch(values,query){
    const text=norm(values.join(' '));
    const phrase=groups.find(g=>g.includes(norm(query)));if(phrase)return phrase.some(v=>text.includes(v));
    return norm(query).split(' ').filter(Boolean).every(t=>(groups.find(g=>g.includes(t))||[t]).some(v=>text.includes(v)));
  }
  function match(a,f){
    if(!a)return ![f.author,f.keyword,f.keyword_source,f.metadata].some(Boolean);
    if(f.author&&![...a.authors,...(a.contributors||[]).map(p=>p.orcid||'')].some(name=>norm(name).includes(norm(f.author))))return false;
    const c=a.content;
    const keywords=f.keyword_source==='author'?c.author_keywords:f.keyword_source==='derived'?c.topic_tags:[...c.author_keywords,...c.topic_tags];
    if(f.keyword&&!keywordMatch(keywords,f.keyword))return false;
    if(f.keyword_source==='author'&&!c.author_keywords.length||f.keyword_source==='derived'&&!c.topic_tags.length)return false;
    const missing=a.provenance.missing;
    if(f.metadata==='missing-author'&&!missing.includes('authors')||f.metadata==='missing-keywords'&&!missing.includes('author_keywords')||f.metadata==='missing-doi'&&!missing.includes('doi')||f.metadata==='unclassified'&&c.direction_basis!=='unclassified')return false;
    return true;
  }
  window.PaperAttributes={match,keywordMatch,norm,topicMatch,restoreTopic,constrainVenues};
})();

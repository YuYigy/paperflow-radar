"use strict";
(() => {
  const $=id=>document.getElementById(id), norm=s=>s.replace(/\s+/g,' ').trim();let packet=null,current=1,quote='',importSerial=0;
  const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  function validate(v){
    const text=(s,max)=>typeof s==='string'&&s.length<=max;
    if(v?.schema!=='paperflow.reader-packet/v1'||!text(v.record_id,128)||!/^[-\w]+$/.test(v.record_id)||!Number.isInteger(v.revision)||v.revision<1||!text(v.title,2000)||!text(v.pdf_sha256,64)||!/^[a-f0-9]{64}$/.test(v.pdf_sha256)||v.figures_verified!==false||v.semantic_reviewed!==false||!Array.isArray(v.pages)||v.pages.length<1||v.pages.length>200)throw Error('证据包格式不正确');
    if(v.pages.some((p,i)=>p.page!==i+1||!text(p.text,1000000))||v.pages.reduce((n,p)=>n+p.text.length,0)>1000000)throw Error('分页文本超出范围');
    if(!Array.isArray(v.claims)||v.claims.length>12||v.claims.some(c=>!text(c.section,30)||!text(c.text,600)||!text(c.quote,350)||norm(c.quote).length<12||!Number.isInteger(c.page)||!v.pages[c.page-1]||!norm(v.pages[c.page-1].text).includes(norm(c.quote))))throw Error('引用与页码不匹配，未载入证据包');
    for(const key of ['limitations','inference'])if(!Array.isArray(v[key])||v[key].length>20||v[key].some(s=>!text(s,600)))throw Error('说明字段不正确');
    return v;
  }
  function renderPage(){if(!packet)return;const page=packet.pages[current-1];$('reader-page').value=String(current);$('reader-prev').disabled=current===1;$('reader-next').disabled=current===packet.pages.length;
    $('reader-selected-quote').hidden=!quote;$('reader-selected-quote').textContent=quote;
    const node=$('reader-text'),search=$('reader-find').value.trim(),content=page.text;node.replaceChildren();
    if(search){const lower=content.toLocaleLowerCase(),needle=search.toLocaleLowerCase();let pos=0,index=lower.indexOf(needle);while(index>=0){node.append(document.createTextNode(content.slice(pos,index)),el('mark',content.slice(index,index+search.length)));pos=index+search.length;index=lower.indexOf(needle,pos);}node.append(document.createTextNode(content.slice(pos)));}else node.textContent=content;
    const count=search?packet.pages.filter(p=>p.text.toLocaleLowerCase().includes(search.toLocaleLowerCase())).length:0;
    $('reader-page-status').textContent=`第 ${current} / ${packet.pages.length} 页 · ${content.trim().length<60?'文字较少，请核对图表或扫描页':'分页提取文本'}${search?' · '+count+' 页匹配搜索':''}`;
  }
  $('reader-import').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;const serial=++importSerial;
    try{if(file.size>8000000)throw Error('证据包超过8 MB');const next=validate(JSON.parse(await file.text()));if(serial!==importSerial)return;
      packet=next;current=1;quote='';$('reader-find').value='';$('reader-title').textContent=packet.title;$('reader-workspace').hidden=false;
      $('reader-page').replaceChildren(...packet.pages.map(p=>new Option('第 '+p.page+' 页',String(p.page))));
      $('reader-claims').replaceChildren();if(!packet.claims.length)$('reader-claims').append(el('p','尚无模型结论，可先逐页核对原文。'));
      for(const c of packet.claims){const box=el('article','');box.className='claim-card';box.append(el('h3',c.section),el('p',c.text));const b=el('button','核对原文 · 第 '+c.page+' 页');b.addEventListener('click',()=>{current=c.page;quote=c.quote;renderPage();$('reader-selected-quote').scrollIntoView({block:'center'});$('reader-text').focus({preventScroll:true});});box.append(b);$('reader-claims').append(box);}
      for(const [id,list] of [['reader-limits',packet.limitations],['reader-inference',packet.inference]])$(id).replaceChildren(...list.map(s=>el('li',s)));
      $('reader-paper-link').hidden=true;$('reader-identity').textContent='正在核对公开论文身份…';renderPage();$('reader-status').textContent='已载入。引用页码已检查，图表与结论语义仍待核查。';
      try{const items=await PaperFlow.getItems();if(serial!==importSerial)return;const item=items.find(i=>i.record_id===packet.record_id);$('reader-identity').textContent=item?(item.revision===packet.revision?'对应当前公开修订 '+packet.revision:'材料基于修订 '+packet.revision+'；公开解读已变更，请重新核对'):'当前公开库无对应论文，保留私有材料；身份待核对';if(item){$('reader-paper-link').href='items/'+encodeURIComponent(item.record_id)+'.html#personal-note';$('reader-paper-link').hidden=false;}}catch(_){if(serial===importSerial)$('reader-identity').textContent='公开目录不可用，尚未核对修订。';}
    }catch(err){$('reader-status').textContent='载入失败：'+err.message+'。原有材料保留。';}finally{e.target.value='';}
  });
  $('reader-page').addEventListener('change',()=>{current=Number($('reader-page').value);quote='';renderPage();});
  for(const [id,delta] of [['reader-prev',-1],['reader-next',1]])$(id).addEventListener('click',()=>{if(packet){current=Math.max(1,Math.min(packet.pages.length,current+delta));quote='';renderPage();}});
  $('reader-find').addEventListener('input',renderPage);$('reader-search-next').addEventListener('click',()=>{if(!packet)return;const q=$('reader-find').value.trim().toLocaleLowerCase();if(!q)return;for(let offset=1;offset<=packet.pages.length;offset++){const pos=(current-1+offset)%packet.pages.length;if(packet.pages[pos].text.toLocaleLowerCase().includes(q)){current=pos+1;quote='';break;}}renderPage();});
})();

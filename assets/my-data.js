'use strict';
(() => {
  if(!document.getElementById('data-center'))return;
  const adapters=window.PaperFlowBackupAdapters,$=id=>document.getElementById(id),schema='paperflow.personal-backup/v1';
  let pending=null;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const message=t=>$('data-status').textContent=t;
  const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  function snapshot(){return Object.fromEntries(Object.entries(adapters).map(([k,a])=>[k,localStorage.getItem(a.key)]));}
  function decode(raw,k){const a=adapters[k];return a.validate(raw===null?a.empty():JSON.parse(raw));}
  function summary(k,v){
    if(k==='research')return `${v.questions.length} 个选题 · ${v.authors.length} 位作者 · ${v.compare.length} 篇对比`;
    if(k==='discovery')return `${v.searches.length} 个检索 · ${v.triage.length} 条筛选`;
    return (v.entries||v.requests).length+' 条记录';
  }
  function refresh(){
    $('data-summary').replaceChildren();
    for(const [k,a] of Object.entries(adapters)){
      const box=el('article','');box.append(el('h3',a.label));
      try{box.append(el('p',summary(k,decode(localStorage.getItem(a.key),k))));}catch(_){box.append(el('p','暂不可读，请保留原数据并检查原入口。'));}
      $('data-summary').append(box);
    }
  }
  function download(data){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=el('a','');a.href=u;a.download='paperflow-all-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  function parse(input){
    let parts;
    if(input?.schema===schema){
      if(!input.sections||Array.isArray(input.sections)||typeof input.sections!=='object'||Object.keys(input.sections).length!==Object.keys(adapters).length)throw Error('完整备份缺少数据分组');
      parts=input.sections;
    }else{const found=Object.entries(adapters).find(([,a])=>a.schema===input?.schema||a.legacySchemas?.includes(input?.schema));if(!found)throw Error('无法识别备份格式');parts={[found[0]]:input};}
    return Object.fromEntries(Object.entries(parts).map(([k,v])=>{if(!Object.hasOwn(adapters,k))throw Error('未知的数据分组');return [k,adapters[k].validate(clone(v))];}));
  }
  function merge(k,current,incoming){
    const next=clone(current);let added=0,updated=0,kept=0;
    const rows=(a,b,id='id')=>{const m=new Map(a.map(v=>[v[id],v]));for(const v of b){const old=m.get(v[id]);if(!old){m.set(v[id],v);added++;}else if(Date.parse(v.updated_at)>Date.parse(old.updated_at)){m.set(v[id],v);updated++;}else kept++;}return [...m.values()];};
    if(k==='research'){
      next.questions=rows(current.questions,incoming.questions);
      if(Date.parse(incoming.profile.updated_at)>Date.parse(current.profile.updated_at)){next.profile=incoming.profile;updated++;}
      next.compare=[...new Set([...current.compare,...incoming.compare])];next.authors=[...new Set([...current.authors,...incoming.authors])];
      added+=next.compare.length-current.compare.length+next.authors.length-current.authors.length;
      if(next.compare.length>4)throw Error('合并后的对比清单超过4篇，请先整理');
    }else if(k==='discovery'){next.searches=rows(current.searches,incoming.searches);next.triage=rows(current.triage,incoming.triage);}
    else{const field=k==='citations'?'requests':'entries';next[field]=rows(current[field],incoming[field],k==='reading'?'record_id':'id');}
    return {value:adapters[k].validate(next),added,updated,kept};
  }
  function cancel(){pending=null;$('data-preview').hidden=true;}
  $('data-export').onclick=()=>{try{const raw=snapshot();download({schema,exported_at:new Date().toISOString(),sections:Object.fromEntries(Object.keys(adapters).map(k=>[k,decode(raw[k],k)]))});message('已发起完整备份下载，请确认文件保存成功。');}catch(_){message('导出未完成：部分存储不可读。请到对应原入口导出恢复文件，未覆盖任何数据。');}};
  $('data-import').onchange=async e=>{
    cancel();try{
      const file=e.target.files[0];if(!file)return;if(file.size>25*1024*1024)throw Error('备份超过25 MB');
      const incoming=parse(JSON.parse(await file.text())),before=snapshot(),after={};$('data-changes').replaceChildren();
      for(const [k,v] of Object.entries(incoming)){
        const result=merge(k,decode(before[k],k),v),raw=JSON.stringify(result.value);
        if(new TextEncoder().encode(raw).length>5*1024*1024)throw Error('单组数据超过5 MB');
        after[k]=raw;$('data-changes').append(el('li',`${adapters[k].label}：新增 ${result.added}，更新 ${result.updated}，保留本机 ${result.kept}。合并后 ${summary(k,result.value)}`));
      }
      pending={before,after};$('data-preview').hidden=false;message('预览已准备，尚未写入。');
    }catch(err){message('无法导入：'+err.message+'。原数据未更改。');}finally{e.target.value='';}
  };
  $('data-cancel').onclick=()=>{cancel();message('已取消，原数据未更改。');};
  $('data-apply').onclick=()=>{
    if(!pending)return;const plan=pending,touched=[];
    try{
      if(JSON.stringify(snapshot())!==JSON.stringify(plan.before))throw Error('本机记录已变化，请重新选择文件预览');
      for(const [k,v] of Object.entries(plan.after)){localStorage.setItem(adapters[k].key,v);touched.push(k);}
      cancel();window.dispatchEvent(new StorageEvent('storage',{key:null}));refresh();message('合并完成。阅读笔记、检索与研究记录已可在原页面继续使用。');
    }catch(err){
      let rollback=true;
      for(const k of touched.reverse()){try{const old=plan.before[k];if(old===null)localStorage.removeItem(adapters[k].key);else localStorage.setItem(adapters[k].key,old);}catch(_){rollback=false;}}
      cancel();refresh();message(rollback?'合并未完成，原数据未更改：'+err.message:'合并中断，部分写入未能恢复。请保留备份并检查各项记录，暂勿重复导入。');
    }
  };
  window.addEventListener('storage',()=>{if(pending){cancel();message('本机记录已变化，请重新选择文件预览。');}refresh();});
  refresh();
})();

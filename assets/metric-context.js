'use strict';
(() => {
  const fields={scope:'统计口径（单通道 / 总计等）',modulation:'调制格式',channels:'通道 / 波长 / 子载波数',baud:'符号率及单位',distance:'传输距离及介质',fec:'FEC 类型、开销与门限',ber:'BER 测量口径',osnr:'OSNR / SNR 及参考带宽',dsp:'均衡器 / DSP 配置',power:'功率 / 能耗统计边界'};
  const empty=()=>Object.fromEntries(Object.keys(fields).map(k=>[k,'']));
  function validate(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(fields,k))||Object.values(value).some(v=>typeof v!=='string'||v.length>300))throw Error('结构化条件格式不正确');
    return {...empty(),...value};
  }
  const missing=v=>!String(v||'').trim()||/^(未知|未填写|未说明|原文未明确|unknown|not reported|n\/a|na|—|-)$/i.test(String(v).trim());
  const display=v=>missing(v)?'未填写 / 未明确':v;
  function status(values){if(values.some(missing))return '待补条件';return new Set(values.map(v=>v.trim().normalize('NFKC').toLowerCase())).size>1?'填写有差异':'填写一致 · 仍需核对';}
  const describe=context=>Object.entries(fields).map(([k,label])=>label+'：'+display(context?.[k])).join('\n');
  window.PaperFlowMetricContext=Object.freeze({fields,empty,validate,missing,display,status,describe});
})();

/* Download-only research exports. Bibliography never contains private notes or AI summaries. */
"use strict";
(() => {
  const base = new URL(document.body.dataset.prefix || './', location.href);
  const singleLine = value => String(value ?? '').replace(/[\r\n\t\u0000-\u001f]+/g, ' ').trim();
  const tex = value => singleLine(value).replace(/[\\{}%&#_$~^]/g, ch => ({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','%':'\\%','&':'\\&','#':'\\#','_':'\\_','$':'\\$','~':'\\textasciitilde{}','^':'\\textasciicircum{}'}[ch]));
  const md = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\\`*_[\]{}#!|]/g,'\\$&');
  const link = value => { try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? '<' + url.href.replace(/</g,'%3C').replace(/>/g,'%3E') + '>' : md(value); } catch (_) { return md(value); } };
  const isPaper = item => item && ['paper','preprint'].includes(item.kind);
  const type = item => item.kind === 'preprint' ? 'preprint' : item.venue_info?.kind || 'unknown';
  const year = item => /^\d{4}(?:-|$)/.test(item.published_at || '') ? item.published_at.slice(0,4) : '';
  const evidence = {'abstract-only':'仅摘要证据','abstract+pdf-link':'摘要与全文链接；全文尚未核查','fulltext-reviewed':'已核查全文','source-only':'仅来源信息'};
  const progress = {queued:'待读',reading:'在读',done:'已读'};
  function bibtex(item) {
    const kind = type(item), entryType = kind === 'journal' ? 'article' : kind === 'conference' ? 'inproceedings' : 'misc';
    const id = String(item.record_id).replace(/[^A-Za-z0-9-]/g, ch => '_' + ch.codePointAt(0).toString(16) + '_');
    const fields = [['title', '{' + tex(item.title) + '}']];
    if (item.authors?.length) fields.push(['author', item.authors.map(a => /\band\b/.test(a) ? '{' + tex(a) + '}' : tex(a)).join(' and ')]);
    if (year(item)) fields.push(['year', year(item)]);
    if (item.venue) fields.push([kind === 'journal' ? 'journal' : kind === 'conference' ? 'booktitle' : 'howpublished', tex(item.venue)]);
    if (item.doi) fields.push(['doi', tex(item.doi)]);
    if (item.source_url) fields.push(['url', tex(item.source_url)]);
    if (kind === 'preprint') fields.push(['note', 'Preprint']);
    return '@' + entryType + '{pf' + year(item) + '_' + id + ',\n' + fields.map(([k,v]) => '  ' + k + ' = {' + v + '}').join(',\n') + '\n}';
  }
  function ris(item) {
    const kind = type(item), lines = [], add = (tag,value) => { const text=singleLine(value); if(text) lines.push(tag + '  - ' + text); };
    // GEN is interpreted as a journal article by some importers; use manuscript for unknown sources.
    add('TY',kind === 'journal' ? 'JOUR' : kind === 'conference' ? 'CONF' : 'MANSCPT');
    add('TI',item.title); for (const author of item.authors || []) add('AU',author);
    if (kind === 'journal') { add('JF',item.venue); add('JA',item.venue_info?.abbr); }
    else if (kind === 'conference') add('T2',item.venue);
    else if (item.venue) add('N1','Source: ' + item.venue);
    add('PY',year(item));
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.published_at || '')) add('DA',item.published_at.replace(/-/g,'/'));
    add('DO',item.doi); add('UR',item.source_url);
    if (kind === 'preprint') add('N1','Preprint');
    lines.push('ER  - '); return lines.join('\r\n');
  }
  function markdown(records, includeNotes) {
    const sections = ['# 知流阅读材料', '包含 ' + records.length + ' 条记录。公开解读与个人记录分开呈现；证据等级不因导出而改变。',
      includeNotes ? '包含导出时已保存的个人笔记与阅读进度；编辑框中尚未保存的草稿不在此文件中。' : '本文件未包含个人笔记或阅读进度。'];
    for (const {item,entry,record_id} of records) {
      sections.push('---', '## ' + md(item?.title_zh || item?.title || '原条目当前不可用 · ' + record_id));
      if (item) {
        sections.push('### 来源与版本', [
          '- 原始题名：' + md(item.title),
          '- 作者：' + md(item.authors?.join(' · ') || '未收录'),
          '- 来源：' + md(item.venue || '未收录'),
          '- 发表日期：' + md(item.published_at || '未收录'),
          '- DOI：' + md(item.doi || '未收录'),
          '- 原始链接：' + link(item.source_url),
          '- 站内解读：' + link(new URL('items/' + encodeURIComponent(item.record_id) + '.html', base).href),
          '- 证据范围：' + md(evidence[item.evidence_status] || item.evidence_status),
          '- 公开解读修订：' + item.revision
        ].join('\n'));
        if (['abstract-only','abstract+pdf-link'].includes(item.evidence_status)) sections.push('仅依据摘要；全文、图表和完整实验条件尚未核查。');
        sections.push('### 中文研究重点', md(item.summary_zh || '暂无中文解读。'));
        if (item.facts?.length) sections.push('### 来源事实与定位', item.facts.map(f => md(f.text) + '\n\n定位：' + md(f.locator) + ' · 来源：' + link(f.source_url)).join('\n\n'));
        if (item.metrics?.length) sections.push('### 已收录指标与条件', item.metrics.map(m => md([m.name,m.value,m.unit].join(' ')) + '\n\n条件：' + md(m.conditions) + '；依据：' + md(m.basis) + '\n\n定位：' + md(m.locator) + ' · 来源：' + link(m.source_url)).join('\n\n'));
        if (item.ai_inference?.length) sections.push('### AI 研究启发（推断，待验证）', item.ai_inference.map(s => '- ' + md(s)).join('\n'));
        if (item.missing_evidence?.length) sections.push('### 待核查证据', item.missing_evidence.map(s => '- ' + md(s)).join('\n'));
      } else sections.push('当前公开库没有这条记录的书目信息，不补猜题名或来源。');
      if (includeNotes && entry) {
        sections.push('### 我的已保存记录（个人笔记）', '阅读进度：' + progress[entry.status] + '；笔记所依据的解读修订：' + entry.revision + '；本机保存时间：' + md(entry.updated_at));
        if (item && entry.revision !== item.revision) sections.push('**注意：笔记基于不同修订的解读，请重新核对证据。**');
        // A variable-length fence preserves notes verbatim without turning their HTML into active markup.
        const note = entry.note || '尚未填写笔记。';
        const length = Math.max(3,...(note.match(/`+/g) || []).map(s => s.length + 1));
        const fence = '`'.repeat(length); sections.push(fence + 'text\n' + note + '\n' + fence);
      }
    }
    return sections.join('\n\n') + '\n';
  }
  function serialize(records, format, includeNotes = false) {
    if (format === 'md') return markdown(records, includeNotes);
    if (!['ris','bib'].includes(format)) throw Error('Unsupported export format');
    return records.filter(r => isPaper(r.item)).map(r => format === 'bib' ? bibtex(r.item) : ris(r.item)).join(format === 'bib' ? '\n\n' : '\r\n\r\n') + (format === 'bib' ? '\n' : '\r\n');
  }
  window.PaperFlowExport = Object.freeze({version:1,serialize});
  for (const host of document.querySelectorAll('[data-paper-export]')) {
    const format = host.querySelector('[data-export-format]'), scope = host.querySelector('[data-export-scope]');
    const notes = host.querySelector('[data-export-notes]'), status = host.querySelector('[data-export-status]');
    const button = host.querySelector('[data-export-download]'), hint = host.querySelector('[data-export-hint]');
    let generation = 0, downloading = false;
    async function collect() {
      const items = new Map((await window.PaperFlow.getItems()).map(item => [item.record_id,item]));
      const includeNotes = format.value === 'md' && notes.checked;
      let entries = [];
      if (!host.dataset.exportRecord || includeNotes) entries = window.PaperFlow.getReadingEntries();
      const byId = new Map(entries.map(entry => [entry.record_id,entry]));
      let ids;
      if (host.dataset.exportRecord) ids = [host.dataset.exportRecord];
      else if (scope.value === 'all') ids = entries.map(e => e.record_id);
      else {
        if (document.getElementById('workspace-list').dataset.loaded !== 'true') throw Error('Workspace not ready');
        ids = [...document.querySelectorAll('.workspace-entry[data-record-id]')].map(el => el.dataset.recordId).filter(id => byId.has(id));
      }
      return ids.map(record_id => ({record_id,item:items.get(record_id) || null,entry:byId.get(record_id) || null}));
    }
    function count(records) {
      const actual = format.value === 'md' ? records.length : records.filter(r => isPaper(r.item)).length;
      return {actual,skipped:records.length-actual};
    }
    async function refresh() {
      if (!host.open || downloading) return;
      const run = ++generation; button.disabled = true;
      notes.closest('label').hidden = format.value !== 'md';
      hint.textContent = format.value === 'md' ? '包含来源、中文解读、证据定位与待核查项。个人记录需勾选；仅导出已保存内容，请先保存编辑中的笔记。' : 'RIS / BibTeX 仅含当前条目的来源书目信息；卷期页码等未收录字段留空，不含中文解读或个人笔记。';
      status.textContent = '正在准备…';
      try {
        const records = await collect(); if (run !== generation) return;
        const {actual,skipped} = count(records);
        status.textContent = actual ? '可导出 ' + actual + ' 条' + (skipped ? '；跳过 ' + skipped + ' 条资讯或来源缺失记录' : '') : '没有可导出的条目，请调整范围或格式。';
        button.disabled = !actual; button.textContent = '下载 ' + ({ris:'RIS',bib:'BibTeX',md:'Markdown'}[format.value]);
      } catch (_) {
        if (run !== generation) return;
        status.textContent = '暂时无法准备导出。请重试；本机笔记未改变。'; button.textContent = '重试导出'; button.disabled = false;
      }
    }
    host.addEventListener('toggle', refresh); format.addEventListener('change',refresh); scope?.addEventListener('change',refresh); notes.addEventListener('change',refresh);
    window.addEventListener('paperflow:workspace-rendered',refresh); window.addEventListener('paperflow:reading-changed',refresh);
    button.addEventListener('click',async () => {
      if (downloading) return;
      downloading = true; ++generation; button.disabled = true;
      let hasRecords = true;
      const controls = [format,scope,notes].filter(Boolean); controls.forEach(control => {control.disabled = true;});
      try {
        const records = await collect(), {actual,skipped} = count(records);
        if (!actual) { hasRecords = false; status.textContent = '没有可导出的条目，请调整范围或格式。'; return; }
        const text = serialize(records,format.value,notes.checked);
        const mime = {md:'text/markdown;charset=utf-8',bib:'application/x-bibtex;charset=utf-8',ris:'application/x-research-info-systems;charset=utf-8'}[format.value];
        const url = URL.createObjectURL(new Blob([text],{type:mime})), anchor = document.createElement('a');
        anchor.href = url; anchor.download = 'paperflow-' + (format.value === 'md' ? 'reading' : 'references') + '-' + new Date().toISOString().slice(0,10) + '.' + format.value;
        document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
        status.textContent = '已生成 ' + actual + ' 条记录的下载文件' + (skipped ? '；跳过 ' + skipped + ' 条资讯或来源缺失记录' : '') + '。';
      } catch (_) { status.textContent = '导出失败，请重试；本机笔记未改变。'; }
      finally {
        downloading = false; button.disabled = !hasRecords;
        button.textContent = '下载 ' + ({ris:'RIS',bib:'BibTeX',md:'Markdown'}[format.value]);
        controls.forEach(control => {control.disabled = false;});
      }
    });
  }
})();

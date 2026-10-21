/* Local reading repository + versioned extension surface. No credentials or remote writes. */
"use strict";
(() => {
  const base = new URL(document.body.dataset.prefix || './', location.href);
  const key = 'paperflow:reading:v1:' + base.pathname;
  const schema = 'paperflow.reading-workspace/v1';
  const states = {queued: '待读', reading: '在读', done: '已读'};
  const empty = () => ({schema, entries: []});
  let blocked = false, timer, itemsPromise, activeStatus = 'all';
  function notify(text) {
    const el = document.getElementById('app-notice');
    el.textContent = text; el.hidden = false;
    clearTimeout(timer); timer = setTimeout(() => { el.hidden = true; }, 7000);
  }
  function validate(data) {
    if (!data || data.schema !== schema || !Array.isArray(data.entries) || data.entries.length > 2000 || Object.keys(data).some(k => !['schema', 'entries'].includes(k))) throw Error('format');
    const seen = new Set();
    for (const e of data.entries) {
      if (!e || Object.keys(e).sort().join(',') !== 'note,record_id,revision,status,updated_at' ||
          typeof e.record_id !== 'string' || !e.record_id || e.record_id.length > 128 || seen.has(e.record_id) ||
          !Number.isInteger(e.revision) || e.revision < 1 || !Object.hasOwn(states, e.status) ||
          typeof e.note !== 'string' || e.note.length > 20000 || typeof e.updated_at !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(e.updated_at) || !Number.isFinite(Date.parse(e.updated_at)) ||
          new Date(e.updated_at.slice(0,10) + 'T00:00:00Z').toISOString().slice(0,10) !== e.updated_at.slice(0,10)) throw Error('entry');
      seen.add(e.record_id);
    }
    return data;
  }
  function read() {
    try { const raw = localStorage.getItem(key); return raw ? validate(JSON.parse(raw)) : empty(); }
    catch (_) { blocked = true; notify('无法读取阅读存储，已停止写入以保留原数据。请检查浏览器存储权限或恢复备份。'); return empty(); }
  }
  function write(data) {
    if (blocked) { notify('阅读存储不可用，未保存。原始数据保持不变。'); return false; }
    try {
      validate(data);
      const serialized = JSON.stringify(data);
      if (new TextEncoder().encode(serialized).length > 5 * 1024 * 1024) throw Error('size');
      localStorage.setItem(key, serialized);
    }
    catch (_) { notify('保存失败：请检查浏览器存储空间或权限，并保留编辑中的笔记。'); return false; }
    syncButtons(); window.dispatchEvent(new CustomEvent('paperflow:reading-changed', {detail: {version: 1}}));
    return true;
  }
  function getEntry(id) { return read().entries.find(e => e.record_id === id); }
  function update(id, revision, changes) {
    const data = read(), old = data.entries.find(e => e.record_id === id);
    const entry = {...(old || {record_id:id, revision, status:'queued', note:''}), ...changes, updated_at:new Date().toISOString()};
    data.entries = [...data.entries.filter(e => e.record_id !== id), entry];
    return write(data);
  }
  function syncButtons() {
    const saved = new Set(read().entries.map(e => e.record_id));
    for (const button of document.querySelectorAll('[data-save]')) {
      const yes = saved.has(button.dataset.save);
      button.textContent = yes ? '已加入阅读' : '加入阅读'; button.setAttribute('aria-pressed', String(yes));
    }
  }
  function getItems() {
    if (!itemsPromise) itemsPromise = fetch(new URL('data/items.json', base)).then(r => {
      if (!r.ok) throw Error('load'); return r.json();
    }).catch(e => { itemsPromise = null; throw e; });
    return itemsPromise;
  }
  function el(tag, text, className) {
    const node = document.createElement(tag); if (text !== undefined) node.textContent = text;
    if (className) node.className = className; return node;
  }
  function download(data) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'}));
    const link = el('a'); link.href = url; link.download = 'paperflow-reading-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let renderNumber = 0;
  const workspaceSearch = document.getElementById('workspace-search');
  const workspaceSort = document.getElementById('workspace-sort');
  function resetFilters() {
    activeStatus = 'all'; workspaceSearch.value = '';
    renderWorkspace(); workspaceSearch.focus();
  }
  workspaceSearch?.addEventListener('input', renderWorkspace);
  workspaceSort?.addEventListener('change', renderWorkspace);
  document.getElementById('workspace-reset')?.addEventListener('click', resetFilters);
  async function renderWorkspace() {
    const list = document.getElementById('workspace-list'); if (!list) return;
    const thisRender = ++renderNumber;
    try {
      const items = new Map((await getItems()).map(i => [i.record_id, i]));
      if (thisRender !== renderNumber) return;
      const entries = read().entries;
      const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase();
      const terms = normalize(workspaceSearch.value).trim().split(/\s+/).filter(Boolean);
      const title = entry => { const item = items.get(entry.record_id); return item?.title_zh || item?.title || entry.record_id; };
      const published = entry => Date.parse(items.get(entry.record_id)?.published_at) || 0;
      const filtered = entries.filter(entry => {
        if (activeStatus !== 'all' && activeStatus !== entry.status) return false;
        const item = items.get(entry.record_id);
        const text = normalize([entry.record_id, entry.note, item?.title, item?.title_zh, ...(item?.authors || []), item?.doi, item?.venue, item?.venue_info?.abbr, ...(item?.topics || [])].join(' '));
        return terms.every(term => text.includes(term));
      }).sort((a,b) => {
        if (workspaceSort.value === 'published') { const delta = published(b) - published(a); if (delta) return delta; }
        if (workspaceSort.value === 'title') { const delta = title(a).localeCompare(title(b), 'zh-CN'); if (delta) return delta; }
        return Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.record_id.localeCompare(b.record_id);
      });
      for (const button of document.querySelectorAll('[data-workspace-filter]')) {
        const state = button.dataset.workspaceFilter;
        button.setAttribute('aria-pressed', String(state === activeStatus));
        const count = entries.filter(entry => state === 'all' || entry.status === state).length;
        button.replaceChildren(document.createTextNode(state === 'all' ? '全部' : states[state]), el('span', String(count), 'workspace-filter-count'));
      }
      document.getElementById('workspace-reset').hidden = !terms.length && activeStatus === 'all';
      document.getElementById('workspace-count').textContent = `${filtered.length} / ${entries.length} 篇`;
      list.replaceChildren();
      if (!filtered.length) {
        const box = el('section', undefined, 'empty-state');
        if (blocked) {
          box.append(el('h2', '暂时无法读取本机清单'), el('p', '原始数据已保留。请检查浏览器存储权限；恢复备份前先保留原始存储。'));
        } else if (entries.length) {
          box.append(el('h2', '当前条件下没有论文'), el('p', '试试更短的关键词，或清除筛选查看已有的 ' + entries.length + ' 篇论文。'));
          const reset = el('button', '查看全部阅读', 'button'); reset.type = 'button'; reset.addEventListener('click', resetFilters); box.append(reset);
        } else {
          box.append(el('h2', '给下一次阅读留一个位置'), el('p', '在论文库点击“加入阅读”，就能在这里安排进度、记录问题与证据。已有备份可在下方“备份与迁移”中导入。'));
          const a = el('a', '浏览论文库', 'button'); a.href = new URL('index.html#research', base); box.append(a);
        }
        list.append(box);
      }
      for (const entry of filtered) {
        const item = items.get(entry.record_id), article = el('article', undefined, 'workspace-entry');
        const heading = el('h2');
        if (item) { const a = el('a', item.title_zh || item.title); a.href = new URL('items/' + encodeURIComponent(item.record_id) + '.html#personal-note', base); heading.append(a); }
        else heading.textContent = '原条目当前不可用 · ' + entry.record_id;
        const meta = el('div', undefined, 'workspace-entry-meta');
        const badge = el('span', states[entry.status], 'workspace-state'); badge.dataset.state = entry.status; meta.append(badge);
        if (item) meta.append(el('span', [item.venue_info?.abbr || item.venue, item.published_at].filter(Boolean).join(' · ')));
        meta.append(el('span', '本机修改 ' + new Date(entry.updated_at).toLocaleString('zh-CN')));
        article.append(meta, heading);
        if (item?.authors?.length) article.append(el('p', item.authors.slice(0,3).join(' · ') + (item.authors.length > 3 ? ' 等' : ''), 'fine workspace-authors'));
        if (item && entry.revision !== item.revision) article.append(el('p', '论文已更新；这份笔记基于较早版本，请重新核对证据。', 'notice'));
        if (!item) article.append(el('p', '保留原笔记；该条目可能已撤下或来自另一份公开库。', 'fine'));
        if (entry.note) {
          if (entry.note.length > 240 || entry.note.split('\n').length > 5) {
            const preview = el('details', undefined, 'workspace-note-preview');
            preview.append(el('summary', '展开阅读笔记 · ' + entry.note.length.toLocaleString('zh-CN') + ' 字符'), el('pre', entry.note));
            article.append(preview);
          } else article.append(el('pre', entry.note, 'workspace-note-preview'));
        }
        const actions = el('div', undefined, 'actions'), select = el('select');
        if (item) { const resume = el('a', entry.note ? '继续阅读与笔记 →' : '打开论文并记录 →', 'workspace-resume'); resume.href = new URL('items/' + encodeURIComponent(item.record_id) + '.html#personal-note', base); actions.append(resume); }
        select.setAttribute('aria-label', '修改阅读状态：' + (item?.title_zh || item?.title || entry.record_id));
        for (const [value,label] of Object.entries(states)) { const option = el('option',label); option.value = value; select.append(option); }
        select.value = entry.status;
        select.addEventListener('change', () => { if (!update(entry.record_id, entry.revision, {status:select.value})) select.value = entry.status; });
        const remove = el('button', '移出清单'); remove.type = 'button';
        remove.addEventListener('click', () => {
          const data = read(); const current = data.entries.find(e => e.record_id === entry.record_id);
          if (current?.note && !confirm('移出清单也会删除这篇的本机笔记。请确认已导出需要保留的内容。')) return;
          data.entries = data.entries.filter(e => e.record_id !== entry.record_id);
          if (write(data)) notify('已移出阅读清单');
        });
        actions.append(select, remove); article.append(actions); list.append(article);
      }
    } catch (_) {
      if (thisRender !== renderNumber) return;
      list.replaceChildren(el('p','论文目录加载失败，已有本机笔记未受影响。可导出备份，或重试加载。'));
      const retry = el('button', '重新加载'); retry.addEventListener('click',renderWorkspace); list.append(retry);
    }
  }
  document.addEventListener('click', event => {
    const save = event.target.closest('[data-save]');
    if (save) {
      if (getEntry(save.dataset.save)) { notify('已在阅读清单中，可到阅读工作台管理。'); return; }
      if (update(save.dataset.save, Number(save.dataset.revision), {})) notify('已加入阅读清单');
    }
    const filter = event.target.closest('[data-workspace-filter]');
    if (filter) {
      activeStatus = filter.dataset.workspaceFilter;
      for (const button of document.querySelectorAll('[data-workspace-filter]')) button.setAttribute('aria-pressed', String(button === filter));
      renderWorkspace();
    }
  });
  const editor = document.querySelector('[data-note-editor]');
  let dirty = false;
  if (editor) {
    const id = editor.dataset.noteEditor, note = document.getElementById('reading-note'), status = document.getElementById('reading-status');
    const feedback = document.getElementById('note-feedback'), save = document.getElementById('save-note');
    const versionFeedback = document.getElementById('note-version-feedback');
    const counter = document.getElementById('note-length');
    let baseline, baselineNote = '', baselineStatus = 'queued', externalChange = false;
    function showFeedback(message, state) { feedback.textContent = message; feedback.dataset.state = state; }
    function showLength() { counter.textContent = note.value.length.toLocaleString('zh-CN') + ' / 20,000 字符'; }
    function loadEditor() {
      const entry = getEntry(id); baseline = entry?.updated_at;
      note.value = entry?.note || ''; status.value = entry?.status || 'queued';
      baselineNote = note.value; baselineStatus = status.value; dirty = false; externalChange = false;
      versionFeedback.textContent = entry && entry.revision !== Number(editor.dataset.revision) ? '笔记基于旧版论文，请核查变化。' : '';
      versionFeedback.hidden = !versionFeedback.textContent;
      showLength();
      showFeedback(blocked ? '本机存储不可用，请先复制保留笔记。' : entry ? '已保存到当前浏览器' : '尚未保存；写好后点击保存笔记。', blocked ? 'error' : entry ? 'saved' : 'idle');
    }
    loadEditor();
    function changed() {
      dirty = note.value !== baselineNote || status.value !== baselineStatus; showLength();
      showFeedback(externalChange ? '其他标签页已修改此记录；保存时将核对冲突。' : dirty ? '有未保存的修改' : baseline ? '已保存到当前浏览器' : '尚未保存；写好后点击保存笔记。', externalChange ? 'conflict' : dirty ? 'dirty' : baseline ? 'saved' : 'idle');
    }
    note.addEventListener('input', changed); status.addEventListener('change', changed);
    save.addEventListener('click', () => {
      const current = getEntry(id);
      if (current?.updated_at !== baseline && (current?.note !== note.value || current?.status !== status.value) && !confirm('此记录已在其他操作中更新或移除。是否用当前编辑内容保存？')) {
        externalChange = true; showFeedback('已保留当前草稿，尚未覆盖其他修改。', 'conflict'); return;
      }
      if (update(id, Number(editor.dataset.revision), {note:note.value, status:status.value})) {
        loadEditor(); notify('笔记已保存到本机');
      } else showFeedback('保存失败，草稿仍在编辑框中。请先复制保留，再检查浏览器存储。', 'error');
    });
    editor.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.isComposing && event.key.toLowerCase() === 's') { event.preventDefault(); save.click(); }
    });
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      if (!dirty) loadEditor();
      else if (getEntry(id)?.updated_at !== baseline) { externalChange = true; changed(); }
    });
  }
  document.getElementById('export-workspace')?.addEventListener('click', () => {
    const data = read(); if (!blocked) download(data);
  });
  document.getElementById('import-workspace')?.addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw Error('size');
      const incoming = validate(JSON.parse(await file.text()));
      const current = read(), merged = new Map(current.entries.map(e => [e.record_id,e]));
      for (const e of incoming.entries) {
        const old = merged.get(e.record_id);
        if (!old || Date.parse(e.updated_at) > Date.parse(old.updated_at)) merged.set(e.record_id,e);
      }
      if (write({schema, entries:[...merged.values()]})) notify('备份已合并，较新的笔记已保留');
    } catch (_) { notify('导入失败：需要有效的知流阅读备份（不超过 5 MB），原数据未更改。'); }
    event.target.value = '';
  });
  window.addEventListener('paperflow:reading-changed', renderWorkspace);
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { syncButtons(); renderWorkspace(); window.dispatchEvent(new Event('paperflow:reading-changed')); } });
  // Extensions are shipped as reviewed same-origin assets, never loaded from a query URL.
  const extensionNames = new Set();
  window.PaperFlow = Object.freeze({
    version: 1, getItems, getReadingEntry: getEntry,
    registerTool({id, slot, label, onActivate}) {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(id) || extensionNames.has(id) || !['paper.detail.tools','reading.workspace.tools'].includes(slot) || typeof label !== 'string' || !label.trim() || typeof onActivate !== 'function') throw Error('Invalid PaperFlow tool');
      extensionNames.add(id);
      for (const host of document.querySelectorAll('[data-extension-slot]')) {
        if (host.dataset.extensionSlot !== slot) continue;
        const button = el('button', label); button.type = 'button';
        button.addEventListener('click', async () => {
          button.disabled = true;
          try { await onActivate({recordId:host.dataset.recordId || null, host, apiVersion:1}); }
          catch (_) { notify('该工具运行失败；已有阅读记录未被自动修改。'); }
          finally { button.disabled = false; }
        }); host.append(button);
      }
    }
  });
  syncButtons(); renderWorkspace(); window.dispatchEvent(new Event('paperflow:ready'));
})();

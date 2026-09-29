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
  async function renderWorkspace() {
    const list = document.getElementById('workspace-list'); if (!list) return;
    const thisRender = ++renderNumber;
    try {
      const items = new Map((await getItems()).map(i => [i.record_id, i]));
      if (thisRender !== renderNumber) return;
      const entries = read().entries.sort((a,b) => b.updated_at.localeCompare(a.updated_at));
      const filtered = entries.filter(e => activeStatus === 'all' || activeStatus === e.status);
      document.getElementById('workspace-count').textContent = `${filtered.length} / ${entries.length} 篇`;
      list.replaceChildren();
      if (!filtered.length) {
        const box = el('section', undefined, 'empty-state'); box.append(el('h2', '给下一次阅读留一个位置'), el('p', '在论文库点击“加入阅读”，或切换阅读状态查看已有记录。'));
        const a = el('a', '浏览论文库', 'button'); a.href = new URL('index.html#research', base); box.append(a); list.append(box);
      }
      for (const entry of filtered) {
        const item = items.get(entry.record_id), article = el('article', undefined, 'workspace-entry');
        const heading = el('h2');
        if (item) { const a = el('a', item.title_zh || item.title); a.href = new URL('items/' + encodeURIComponent(item.record_id) + '.html#personal-note', base); heading.append(a); }
        else heading.textContent = '原条目当前不可用 · ' + entry.record_id;
        article.append(heading, el('p', states[entry.status] + ' · 本机修改 ' + new Date(entry.updated_at).toLocaleString('zh-CN'), 'fine'));
        if (item && entry.revision !== item.revision) article.append(el('p', '论文已更新；这份笔记基于较早版本，请重新核对证据。', 'notice'));
        if (!item) article.append(el('p', '保留原笔记；该条目可能已撤下或来自另一份公开库。', 'fine'));
        if (entry.note) article.append(el('pre', entry.note));
        const actions = el('div', undefined, 'actions'), select = el('select');
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
    let baseline;
    function loadEditor() {
      const entry = getEntry(id); baseline = entry?.updated_at;
      note.value = entry?.note || ''; status.value = entry?.status || 'queued';
      document.getElementById('note-feedback').textContent = entry && entry.revision !== Number(editor.dataset.revision) ? '笔记基于旧版论文，请核查变化。' : '';
    }
    loadEditor();
    note.addEventListener('input', () => { dirty = true; }); status.addEventListener('change', () => { dirty = true; });
    document.getElementById('save-note').addEventListener('click', () => {
      const current = getEntry(id);
      if (current?.updated_at !== baseline && current?.note !== note.value && !confirm('此笔记已在其他操作中更新。是否用当前编辑内容覆盖？')) return;
      if (update(id, Number(editor.dataset.revision), {note:note.value, status:status.value})) {
        dirty = false; baseline = getEntry(id)?.updated_at;
        document.getElementById('note-feedback').textContent = '已保存到当前浏览器'; notify('笔记已保存到本机');
      }
    });
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    window.addEventListener('storage', event => { if (event.key === key && !dirty) loadEditor(); });
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

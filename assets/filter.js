"use strict";
(() => {
  const controls = Object.fromEntries(["search", "topic", "venue", "grade", "focus", "kind", "period", "sort"].map(id => [id, document.getElementById(id)]));
  const cards = Array.from(document.querySelectorAll(".card"));
  const container = document.querySelector(".cards");
  const reset = document.getElementById("reset-filters");
  const active = document.getElementById("active-filters");
  const normalize = text => text.normalize("NFKC").toLowerCase().replace(/[‐‑–—]/g, "-").replace(/\s+/g, " ").trim();
  const groups = [
    ["相干", "coherent"], ["硅光", "silicon photonics", "silicon photonic"],
    ["自由空间", "free-space", "free space", "fso"], ["数字信号处理", "dsp", "digital signal processing"],
    ["光互连", "optical interconnect", "photonic interconnect"], ["微波光子", "microwave photonics", "microwave-photonics"],
    ["光网络", "optical network", "optical networks"], ["光纤", "fiber", "fibre"],
    ["集成光子", "integrated photonics", "integrated photonic"], ["量子", "quantum"],
    ["波束", "beam steering", "beamforming", "beam steerer"], ["预印本", "preprint"],
    ["布里渊", "brillouin", "sbs"], ["光通信", "optical communication", "optical communications"]
  ];
  const contains = (text, term) => {
    if (/^[a-z0-9]{1,4}$/.test(term)) return new RegExp("(^|[^a-z0-9])" + term + "($|[^a-z0-9])").test(text);
    return text.includes(term);
  };
  const searchText = new Map(cards.map(card => {
    const text = normalize(card.dataset.search);
    const extra = groups.filter(group => group.some(word => contains(text, word))).flat();
    return [card, text + " " + extra.join(" ")];
  }));
  const labels = {search: "搜索", topic: "方向", venue: "刊会", grade: "学会等级", focus: "关注级", kind: "类型", period: "时间", sort: "排序"};
  function isActive(id) { return controls[id].value !== (id === "sort" ? "date" : ""); }
  function readUrl() {
    const params = new URLSearchParams(location.search);
    for (const [id, control] of Object.entries(controls)) {
      const value = params.get(id === "search" ? "q" : id) || (id === "sort" ? "date" : "");
      control.value = value;
      if (id !== "search" && control.selectedIndex < 0) control.value = id === "sort" ? "date" : "";
    }
  }
  function filterCards(updateUrl = true) {
    const today = new Date().toLocaleDateString("sv-SE", {timeZone: "Asia/Shanghai"});
    const todayMs = Date.parse(today + "T00:00:00Z");
    const query = normalize(controls.search.value);
    const terms = (query.match(/"[^"]+"|\S+/g) || []).map(term => term.replace(/^"|"$/g, ""));
    let visible = 0;
    const matches = card => {
      const d = card.dataset;
      const date = /^\d{4}-\d{2}-\d{2}/.test(d.date) ? Date.parse(d.date.slice(0, 10) + "T00:00:00Z") : NaN;
      return terms.every(term => contains(searchText.get(card), term)) &&
        (!controls.topic.value || d.topics.split("|").includes(controls.topic.value)) &&
        ["venue", "grade", "focus", "kind"].every(id => !controls[id].value || d[id] === controls[id].value) &&
        (!controls.period.value || (date <= todayMs && date >= todayMs - (Number(controls.period.value) - 1) * 86400000));
    };
    for (const card of cards) { card.hidden = !matches(card); if (!card.hidden) visible++; }
    const order = controls.sort.value;
    const sorted = cards.slice().sort((a, b) => {
      const rank = order === "grade" ? Number(a.dataset.rankOrder) - Number(b.dataset.rankOrder) : order === "focus" ? Number(a.dataset.focusOrder) - Number(b.dataset.focusOrder) : 0;
      return rank || b.dataset.date.localeCompare(a.dataset.date) || cards.indexOf(a) - cards.indexOf(b);
    });
    for (const card of sorted) container.append(card);
    document.getElementById("count").textContent = `${visible} / ${cards.length} 条`;
    document.getElementById("empty").hidden = visible !== 0;
    active.replaceChildren();
    for (const [id, control] of Object.entries(controls)) {
      if (!isActive(id)) continue;
      const chip = document.createElement("button"); chip.type = "button";
      const text = id === "search" ? control.value : control.options[control.selectedIndex].text;
      chip.textContent = labels[id] + "：" + text + " ×";
      chip.setAttribute("aria-label", "移除" + labels[id] + "筛选：" + text);
      chip.addEventListener("click", () => { control.value = id === "sort" ? "date" : ""; filterCards(); });
      active.append(chip);
    }
    reset.hidden = !Object.keys(controls).some(isActive);
    for (const button of document.querySelectorAll("[data-filter-topic]")) button.setAttribute("aria-pressed", String(button.dataset.filterTopic === controls.topic.value));
    if (updateUrl) {
      const url = new URL(location.href);
      for (const [id, control] of Object.entries(controls)) {
        const key = id === "search" ? "q" : id;
        if (isActive(id)) url.searchParams.set(key, control.value); else url.searchParams.delete(key);
      }
      history.replaceState(null, "", url);
    }
  }
  for (const control of Object.values(controls)) control.addEventListener("input", () => filterCards());
  reset.addEventListener("click", () => { for (const [id, control] of Object.entries(controls)) control.value = id === "sort" ? "date" : ""; filterCards(); controls.search.focus(); });
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-filter-topic]");
    if (button) { controls.topic.value = button.dataset.filterTopic; filterCards(); }
  });
  window.addEventListener("popstate", () => { readUrl(); filterCards(false); });
  readUrl(); filterCards(false);
})();

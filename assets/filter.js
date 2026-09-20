"use strict";
const search = document.querySelector("#search");
const topic = document.querySelector("#topic");
const kind = document.querySelector("#kind");
const period = document.querySelector("#period");
const reset = document.querySelector("#reset-filters");
function filterCards() {
  const today = new Date().toLocaleDateString("sv-SE", {timeZone: "Asia/Shanghai"});
  const todayMs = Date.parse(today + "T00:00:00Z");
  let visible = 0;
  for (const card of document.querySelectorAll(".card")) {
    const match = card.dataset.search.toLowerCase().includes(search.value.trim().toLowerCase()) &&
      (!topic.value || card.dataset.topics.split("|").includes(topic.value)) &&
      (!kind.value || card.dataset.kind === kind.value) &&
      (!period.value || (/^\d{4}-\d{2}-\d{2}/.test(card.dataset.date) && Date.parse(card.dataset.date.slice(0,10)+"T00:00:00Z") <= todayMs && Date.parse(card.dataset.date.slice(0,10)+"T00:00:00Z") >= todayMs - (Number(period.value)-1)*86400000));
    card.hidden = !match;
    if (match) visible++;
  }
  document.querySelector("#count").textContent = `${visible} 条`;
  document.querySelector("#empty").hidden = visible !== 0;
  reset.hidden = ![search, topic, kind, period].some(c => c.value);
}
for (const control of [search, topic, kind, period]) control.addEventListener("input", filterCards);

reset.addEventListener("click", () => { for (const control of [search, topic, kind, period]) control.value = ""; filterCards(); search.focus(); });

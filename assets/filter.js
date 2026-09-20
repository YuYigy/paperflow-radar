"use strict";
const search = document.querySelector("#search");
const topic = document.querySelector("#topic");
const kind = document.querySelector("#kind");
function filterCards() {
  let visible = 0;
  for (const card of document.querySelectorAll(".card")) {
    const match = card.dataset.search.toLowerCase().includes(search.value.trim().toLowerCase()) &&
      (!topic.value || card.dataset.topics.split("|").includes(topic.value)) &&
      (!kind.value || card.dataset.kind === kind.value);
    card.hidden = !match;
    if (match) visible++;
  }
  document.querySelector("#count").textContent = `${visible} 条`;
  document.querySelector("#empty").hidden = visible !== 0;
}
for (const control of [search, topic, kind]) control.addEventListener("input", filterCards);

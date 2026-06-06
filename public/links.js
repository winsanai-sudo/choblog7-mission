const linkState = {
  links: [],
  group: "all",
  week: "all",
  currentWeek: null,
};

const groupFilters = document.getElementById("groupFilters");
const weekFilters = document.getElementById("weekFilters");
const linkList = document.getElementById("linkList");
const emptyState = document.getElementById("emptyState");
const currentWeekNote = document.getElementById("currentWeekNote");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderFilters() {
  const groupOptions = [
    { value: "all", label: "전체" },
    { value: "junior", label: "주니어" },
    { value: "senior", label: "시니어" },
  ];
  groupFilters.innerHTML = groupOptions
    .map((group) => {
      const active = linkState.group === group.value ? "active" : "";
      return `<button class="${active}" type="button" data-group="${group.value}">${group.label}</button>`;
    })
    .join("");

  const filters = ["all", 1, 2, 3, 4, 5];
  weekFilters.innerHTML = filters
    .map((week) => {
      const isCurrent = Number(week) === Number(linkState.currentWeek);
      const label = week === "all" ? "전체" : `${week}주차${isCurrent ? " · 이번" : ""}`;
      const active = String(linkState.week) === String(week) ? "active" : "";
      const current = isCurrent ? "current" : "";
      return `<button class="${active} ${current}" type="button" data-week="${week}">${label}</button>`;
    })
    .join("");

  currentWeekNote.textContent = linkState.currentWeek ? `현재 강조 주차는 ${linkState.currentWeek}주차입니다.` : "";
}

function renderLinks() {
  const rows = linkState.links.filter((link) => {
    const groupMatches = linkState.group === "all" || link.group === linkState.group;
    const weekMatches = linkState.week === "all" || String(link.week) === String(linkState.week);
    return groupMatches && weekMatches;
  });

  emptyState.classList.toggle("hidden", rows.length > 0);
  linkList.innerHTML = rows
    .map(
      (link) => `
        <article class="link-card">
          <div>
            <span>${link.group === "senior" ? "시니어" : "주니어"} · ${link.week}주차</span>
            <h2>${escapeHtml(link.name)}</h2>
            <p>${escapeHtml(link.submittedAt)}</p>
          </div>
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">방문하기</a>
        </article>
      `,
    )
    .join("");
}

groupFilters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-group]");
  if (!button) return;
  linkState.group = button.dataset.group;
  renderFilters();
  renderLinks();
});

weekFilters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-week]");
  if (!button) return;
  linkState.week = button.dataset.week;
  renderFilters();
  renderLinks();
});

async function loadLinks() {
  const response = await fetch("/api/links");
  const data = await response.json();
  linkState.currentWeek = data.currentWeek || null;
  if (linkState.currentWeek) linkState.week = String(linkState.currentWeek);
  linkState.links = data.links || [];
  renderFilters();
  renderLinks();
}

loadLinks();

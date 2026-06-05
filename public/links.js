const linkState = {
  links: [],
  week: "all",
};

const weekFilters = document.getElementById("weekFilters");
const linkList = document.getElementById("linkList");
const emptyState = document.getElementById("emptyState");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderFilters() {
  const filters = ["all", 1, 2, 3, 4, 5];
  weekFilters.innerHTML = filters
    .map((week) => {
      const label = week === "all" ? "전체" : `${week}주차`;
      const active = String(linkState.week) === String(week) ? "active" : "";
      return `<button class="${active}" type="button" data-week="${week}">${label}</button>`;
    })
    .join("");
}

function renderLinks() {
  const rows = linkState.week === "all"
    ? linkState.links
    : linkState.links.filter((link) => String(link.week) === String(linkState.week));

  emptyState.classList.toggle("hidden", rows.length > 0);
  linkList.innerHTML = rows
    .map(
      (link) => `
        <article class="link-card">
          <div>
            <span>${link.week}주차</span>
            <h2>${escapeHtml(link.name)}</h2>
            <p>${escapeHtml(link.submittedAt)}</p>
          </div>
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">방문하기</a>
        </article>
      `,
    )
    .join("");
}

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
  linkState.links = data.links || [];
  renderFilters();
  renderLinks();
}

loadLinks();

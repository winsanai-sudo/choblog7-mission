const SENIOR_NAMES = [
  "본식", "김민호", "보미", "원표", "식훈", "재웅", "민하", "진성", "신영", "아영", "유진", "설지",
  "귀선", "은주", "기호", "동휘", "이민호", "세완", "영운", "인영", "해룡", "유진", "문수", "승빈", "룡수", "미정",
];

const JUNIOR_NAMES = [
  "상윤", "현선", "소연", "영유", "김종민", "은영", "은진", "모리", "장윤", "윤정", "백화", "신선미",
  "보현", "원우", "윤선미", "이종민", "현주", "예희", "재근", "수아", "정원", "명화", "하나", "민종",
  "혜원", "혜빈", "룡수",
];

const DEMO_SENIOR_NAMES = [
  "피타고라스", "페르마", "오일러", "가우스", "리만", "뉴턴", "라이프니츠", "데카르트", "파스칼", "라플라스",
  "라그랑주", "푸리에", "코시", "갈루아", "힐베르트", "칸토어", "라마누잔", "튜링", "노이만", "러셀",
  "베르누이", "아벨", "야코비", "뫼비우스", "클라인", "민코프스키",
];

const DEMO_JUNIOR_NAMES = [
  "유클리드", "아르키메데스", "탈레스", "아폴로니우스", "히파티아", "피보나치", "카르다노", "네이피어", "베이즈",
  "소피 제르맹", "에미 뇌터", "러브레이스", "부울", "벤다이어그램", "포앵카레", "체비쇼프", "마르코프", "괴델",
  "콜모고로프", "에르되시", "나시", "만델브로트", "와일스", "테렌스 타오", "메리 카트라이트", "코발레프스카야", "바이어슈트라스",
];

function isDemoSite() {
  return window.location.hostname.includes("choblog7-demo");
}

function getNamesForGroup(group) {
  if (isDemoSite()) {
    return group === "senior" ? DEMO_SENIOR_NAMES : DEMO_JUNIOR_NAMES;
  }
  return group === "senior" ? SENIOR_NAMES : JUNIOR_NAMES;
}

const state = {
  group: "junior",
  participant: null,
  selectedWeek: 1,
  masterPassword: "",
  summary: null,
  masterData: null,
  nameSearch: "",
  adminSearch: "",
};

const $ = (id) => document.getElementById(id);

const els = {
  loginForm: $("loginForm"),
  masterLoginForm: $("masterLoginForm"),
  juniorButton: $("juniorButton"),
  seniorButton: $("seniorButton"),
  nameSearchInput: $("nameSearchInput"),
  nameList: $("nameList"),
  nameInput: $("nameInput"),
  phoneInput: $("phoneInput"),
  masterPasswordInput: $("masterPasswordInput"),
  participantArea: $("participantArea"),
  masterArea: $("masterArea"),
  welcomeTitle: $("welcomeTitle"),
  logoutButton: $("logoutButton"),
  weekTabs: $("weekTabs"),
  mission1Form: $("mission1Form"),
  mission2Form: $("mission2Form"),
  postUrlInput: $("postUrlInput"),
  likedCheck: $("likedCheck"),
  stayedCheck: $("stayedCheck"),
  commentCheck: $("commentCheck"),
  neighborCheck: $("neighborCheck"),
  mission1Status: $("mission1Status"),
  mission2Status: $("mission2Status"),
  refreshMasterButton: $("refreshMasterButton"),
  downloadCsvButton: $("downloadCsvButton"),
  resetButton: $("resetButton"),
  currentWeekSelect: $("currentWeekSelect"),
  saveCurrentWeekButton: $("saveCurrentWeekButton"),
  statsArea: $("statsArea"),
  adminSearchInput: $("adminSearchInput"),
  participantTable: $("participantTable"),
  submissionTable: $("submissionTable"),
  toast: $("toast"),
  successModal: $("successModal"),
  successWeekLabel: $("successWeekLabel"),
  fireworksCanvas: $("fireworksCanvas"),
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 2600);
}

async function api(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "요청을 처리하지 못했습니다.");
  return data;
}

function credentials() {
  return {
    group: state.participant.group,
    name: state.participant.name,
    phone: state.participant.phone,
  };
}

function renderNameList() {
  const names = getNamesForGroup(state.group);
  const query = state.nameSearch.trim().toLowerCase();
  const filteredNames = query ? names.filter((name) => name.toLowerCase().includes(query)) : names;
  const selectedName = els.nameInput.value;
  els.nameList.innerHTML = "";

  if (selectedName && !names.includes(selectedName)) {
    els.nameInput.value = "";
  }

  if (!filteredNames.length) {
    els.nameList.innerHTML = `<p class="empty-list">검색된 이름이 없습니다.</p>`;
    return;
  }

  filteredNames.forEach((name, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.dataset.name = name;
    button.dataset.index = String(index);
    if (name === selectedName) button.classList.add("selected");
    button.addEventListener("click", () => {
      els.nameInput.value = name;
      els.nameList.querySelectorAll("button").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    });
    els.nameList.appendChild(button);
  });
}

function selectGroup(group) {
  state.group = group;
  state.nameSearch = "";
  els.nameSearchInput.value = "";
  els.nameInput.value = "";
  els.juniorButton.classList.toggle("active", group === "junior");
  els.seniorButton.classList.toggle("active", group === "senior");
  renderNameList();
}

function renderWeekTabs() {
  els.weekTabs.innerHTML = "";
  for (let week = 1; week <= 5; week += 1) {
    const weekSummary = state.summary && state.summary.weeks.find((item) => item.week === week);
    const button = document.createElement("button");
    button.type = "button";
    button.className = week === state.selectedWeek ? "active" : "";
    button.textContent = `${week}주차 ${weekSummary && weekSummary.success ? "완료" : ""}`;
    button.addEventListener("click", () => {
      state.selectedWeek = week;
      renderParticipant();
    });
    els.weekTabs.appendChild(button);
  }
}

function setMissionStatus(element, done, doneText, emptyText) {
  element.textContent = done ? doneText : emptyText;
  element.className = done ? "status done" : "status";
}

function renderParticipant() {
  els.participantArea.classList.remove("hidden");
  els.masterArea.classList.add("hidden");
  els.welcomeTitle.textContent = `${state.participant.name}님 미션 제출`;
  renderWeekTabs();

  const week = state.summary.weeks.find((item) => item.week === state.selectedWeek);
  setMissionStatus(els.mission1Status, week.mission1, "미션1 제출 완료", "아직 제출 전입니다.");
  setMissionStatus(els.mission2Status, week.mission2, "미션2 제출 완료", "아직 제출 전입니다.");

  els.mission1Form.querySelector("button").disabled = week.mission1;
  els.mission2Form.querySelector("button").disabled = week.mission2;
  els.postUrlInput.value = week.mission1Url || "";
}

function renderMaster(data) {
  state.masterData = data;
  els.masterArea.classList.remove("hidden");
  els.participantArea.classList.add("hidden");
  if (data.settings && data.settings.currentWeek) {
    els.currentWeekSelect.value = String(data.settings.currentWeek);
  }

  const query = state.adminSearch.trim().toLowerCase();
  const matchesSearch = (item) => {
    if (!query) return true;
    return `${item.name || ""} ${item.phone || ""} ${formatPhone(item.phone || "")}`.toLowerCase().includes(query);
  };
  const participants = data.participants.filter(matchesSearch);
  const submissions = data.submissions.filter(matchesSearch);

  els.statsArea.innerHTML = data.weekStats
    .map(
      (stat) => `
        <div class="stat">
          <span>${stat.week}주차 성공률</span>
          <strong>${stat.successRate}%</strong>
          <div class="stat-bar" aria-hidden="true"><i style="width: ${stat.successRate}%"></i></div>
          <small>${stat.successCount}/${stat.totalParticipants}명 성공</small>
        </div>
      `,
    )
    .join("");

  els.participantTable.innerHTML = participants.length
    ? participants
        .map((participant) => {
          const weekCells = participant.weeks
            .map((week) => {
              const label = week.success ? "성공" : `${week.mission1 ? "1" : "-"} / ${week.mission2 ? "2" : "-"}`;
              const lateLabel = week.late ? `<small class="late-label">늦은 제출</small>` : "";
              return `<td><span class="badge ${week.success ? "ok" : "no"} ${week.late ? "late" : ""}">${label}</span>${lateLabel}</td>`;
            })
            .join("");
          return `
            <tr>
              <td>${participant.group === "senior" ? "시니어" : "주니어"}</td>
              <td>${escapeHtml(participant.name)}</td>
              <td>${escapeHtml(formatPhone(participant.phone))}</td>
              ${weekCells}
              <td><strong>${participant.completedWeeks}/5</strong></td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="9">아직 참가자 데이터가 없습니다.</td></tr>`;

  els.submissionTable.innerHTML = submissions.length
    ? submissions
        .map(
          (submission) => `
            <tr>
              <td>${escapeHtml(submission.submittedAt)}</td>
              <td>${escapeHtml(submission.name)}</td>
              <td class="${(submission.submittedDuringWeek || submission.week) > submission.week ? "late-cell" : ""}">
                ${submission.week}주차
                ${(submission.submittedDuringWeek || submission.week) > submission.week ? `<small>${submission.submittedDuringWeek}주차에 제출</small>` : ""}
              </td>
              <td>${submission.mission === "mission1" ? "미션1" : "미션2"}</td>
              <td>${formatDetailsHtml(submission)}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="5">아직 제출 데이터가 없습니다.</td></tr>`;
}

function getSelectedWeekSummary() {
  return state.summary.weeks.find((item) => item.week === state.selectedWeek);
}

function maybeCelebrate(previousWeek, nextSummary) {
  const nextWeek = nextSummary.weeks.find((item) => item.week === state.selectedWeek);
  if (nextWeek && nextWeek.success && previousWeek && !previousWeek.success) {
    launchSuccess(state.selectedWeek);
  }
}

function launchSuccess(week) {
  els.successWeekLabel.textContent = `${week}주차 미션 성공!!`;
  els.successModal.classList.remove("hidden");
  runFireworks();
  window.clearTimeout(launchSuccess.timer);
  launchSuccess.timer = window.setTimeout(() => {
    els.successModal.classList.add("hidden");
  }, 3400);
}

function runFireworks() {
  const canvas = els.fireworksCanvas;
  const context = canvas.getContext("2d");
  const rect = els.successModal.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ["#00f5ff", "#ff4fd8", "#a3ff12", "#ffd166", "#ffffff"];
  const particles = [];
  for (let burst = 0; burst < 7; burst += 1) {
    const x = 80 + Math.random() * Math.max(120, rect.width - 160);
    const y = 80 + Math.random() * Math.max(80, rect.height * 0.45);
    for (let index = 0; index < 38; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 70 + Math.random() * 35,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  let frame = 0;
  function draw() {
    context.clearRect(0, 0, rect.width, rect.height);
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.035;
      particle.life -= 1.5;
      context.globalAlpha = Math.max(particle.life / 90, 0);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;
    frame += 1;
    if (frame < 95) requestAnimationFrame(draw);
  }
  draw();
}

function formatDetailsHtml(submission) {
  if (submission.mission === "mission1") {
    const url = submission.details.postUrl || "";
    return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>` : "블로그 작성 완료";
  }
  return ["체류1분이상", "좋아요", "서이추", "비밀댓글"]
    .filter((label, index) => {
      const keys = ["stayedOverOneMinute", "liked", "neighborRequest", "secretComment"];
      return submission.details[keys[index]];
    })
    .join(", ");
}

function formatPhone(phone) {
  if (phone.length === 11) return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
  return phone;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function weekStatusLabel(week) {
  if (week.success) return week.late ? "성공(늦은 제출)" : "성공";
  if (week.mission1 && week.mission2) return "성공";
  if (week.mission1) return "미션1만";
  if (week.mission2) return "미션2만";
  return "미제출";
}

function csvEscape(value) {
  const text = String(value || "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv() {
  const data = state.masterData;
  if (!data || !data.participants) {
    showToast("먼저 마스터 계정으로 접속해주세요.");
    return;
  }

  const headers = [
    "구분",
    "이름",
    "휴대폰번호",
    "성공주차수",
    "1주차상태",
    "1주차블로그URL",
    "2주차상태",
    "2주차블로그URL",
    "3주차상태",
    "3주차블로그URL",
    "4주차상태",
    "4주차블로그URL",
    "5주차상태",
    "5주차블로그URL",
  ];

  const rows = data.participants.map((participant) => {
    const weekCells = participant.weeks.flatMap((week) => [weekStatusLabel(week), week.mission1Url || ""]);
    return [
      participant.group === "senior" ? "시니어" : "주니어",
      participant.name,
      formatPhone(participant.phone),
      `${participant.completedWeeks}/5`,
      ...weekCells,
    ];
  });

  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `choblog7-missions-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSV 다운로드를 시작했습니다.");
}

els.juniorButton.addEventListener("click", () => selectGroup("junior"));
els.seniorButton.addEventListener("click", () => selectGroup("senior"));

els.nameSearchInput.addEventListener("input", () => {
  state.nameSearch = els.nameSearchInput.value;
  renderNameList();
});

els.adminSearchInput.addEventListener("input", () => {
  state.adminSearch = els.adminSearchInput.value;
  if (state.masterData) renderMaster(state.masterData);
});

els.downloadCsvButton.addEventListener("click", downloadCsv);

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!els.nameInput.value) {
    showToast("명단에서 이름을 선택해주세요.");
    return;
  }

  try {
    const data = await api("/api/login", {
      group: state.group,
      name: els.nameInput.value,
      phone: els.phoneInput.value,
    });
    state.participant = data.participant;
    state.summary = data.summary;
    localStorage.setItem("choblog7Participant", JSON.stringify(state.participant));
    renderParticipant();
    showToast(`${state.participant.name}님, 접속되었습니다.`);
  } catch (error) {
    showToast(error.message);
  }
});

els.masterLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.masterPassword = els.masterPasswordInput.value;
  try {
    const data = await api("/api/master", { password: state.masterPassword });
    renderMaster(data);
    showToast("마스터 현황을 불러왔습니다.");
  } catch (error) {
    showToast(error.message);
  }
});

els.mission1Form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const previousWeek = getSelectedWeekSummary();
  try {
    const data = await api("/api/submit", {
      ...credentials(),
      week: state.selectedWeek,
      mission: "mission1",
      details: { postUrl: els.postUrlInput.value },
    });
    state.summary = data.summary;
    renderParticipant();
    maybeCelebrate(previousWeek, data.summary);
    showToast(data.message);
  } catch (error) {
    els.mission1Status.textContent = error.message;
    els.mission1Status.className = "status warn";
    showToast(error.message);
  }
});

els.mission2Form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const previousWeek = getSelectedWeekSummary();
  const allChecked = els.stayedCheck.checked && els.likedCheck.checked && els.neighborCheck.checked && els.commentCheck.checked;
  if (!allChecked) {
    showToast("미션2 항목 4가지를 모두 체크해주세요.");
    return;
  }

  try {
    const data = await api("/api/submit", {
      ...credentials(),
      week: state.selectedWeek,
      mission: "mission2",
      details: {
        stayedOverOneMinute: els.stayedCheck.checked,
        liked: els.likedCheck.checked,
        neighborRequest: els.neighborCheck.checked,
        secretComment: els.commentCheck.checked,
      },
    });
    state.summary = data.summary;
    renderParticipant();
    maybeCelebrate(previousWeek, data.summary);
    showToast(data.message);
  } catch (error) {
    els.mission2Status.textContent = error.message;
    els.mission2Status.className = "status warn";
    showToast(error.message);
  }
});

els.logoutButton.addEventListener("click", () => {
  localStorage.removeItem("choblog7Participant");
  state.participant = null;
  state.summary = null;
  els.participantArea.classList.add("hidden");
  showToast("로그아웃되었습니다.");
});

els.refreshMasterButton.addEventListener("click", async () => {
  try {
    const data = await api("/api/master", { password: state.masterPassword });
    renderMaster(data);
    showToast("새로고침 완료");
  } catch (error) {
    showToast(error.message);
  }
});

els.saveCurrentWeekButton.addEventListener("click", async () => {
  try {
    const data = await api("/api/current-week", {
      password: state.masterPassword,
      currentWeek: els.currentWeekSelect.value,
    });
    renderMaster(data);
    showToast(data.message);
  } catch (error) {
    showToast(error.message);
  }
});

els.resetButton.addEventListener("click", async () => {
  const confirmed = window.confirm("모든 참가자와 제출 데이터를 삭제하고 처음부터 다시 시작할까요?");
  if (!confirmed) return;
  try {
    const data = await api("/api/reset", { password: state.masterPassword });
    localStorage.removeItem("choblog7Participant");
    state.participant = null;
    state.summary = null;
    renderMaster(await api("/api/master", { password: state.masterPassword }));
    showToast(data.message);
  } catch (error) {
    showToast(error.message);
  }
});

async function restoreLogin() {
  const saved = localStorage.getItem("choblog7Participant");
  if (!saved) return;
  try {
    const participant = JSON.parse(saved);
    const data = await api("/api/login", participant);
    state.participant = data.participant;
    state.summary = data.summary;
    renderParticipant();
  } catch {
    localStorage.removeItem("choblog7Participant");
  }
}

selectGroup("junior");
restoreLogin();

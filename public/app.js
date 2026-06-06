const SENIOR_NAMES = [
  "본식", "김민호", "보미", "원표", "식훈", "재웅", "민하", "진성", "신영", "아영", "유진", "설지",
  "귀선", "은주", "기호", "동휘", "이민호", "세완", "영운", "인영", "해룡", "유진", "문수", "승빈", "룡수", "미정",
];

const JUNIOR_NAMES = [
  "상윤", "현선", "소연", "영유", "김종민", "은영", "은진", "모리", "장윤", "윤정", "백화", "신선미",
  "보현", "원우", "윤선미", "이종민", "현주", "예희", "재근", "수아", "정원", "명화", "하나", "민종",
  "혜원", "혜빈", "룡수",
];

const state = {
  group: "junior",
  participant: null,
  selectedWeek: 1,
  masterPassword: "",
  summary: null,
};

const $ = (id) => document.getElementById(id);

const els = {
  loginForm: $("loginForm"),
  masterLoginForm: $("masterLoginForm"),
  juniorButton: $("juniorButton"),
  seniorButton: $("seniorButton"),
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
  resetButton: $("resetButton"),
  currentWeekSelect: $("currentWeekSelect"),
  saveCurrentWeekButton: $("saveCurrentWeekButton"),
  statsArea: $("statsArea"),
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
  const names = state.group === "senior" ? SENIOR_NAMES : JUNIOR_NAMES;
  els.nameList.innerHTML = "";
  els.nameInput.value = "";

  names.forEach((name, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.dataset.name = name;
    button.dataset.index = String(index);
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
  els.masterArea.classList.remove("hidden");
  els.participantArea.classList.add("hidden");
  if (data.settings && data.settings.currentWeek) {
    els.currentWeekSelect.value = String(data.settings.currentWeek);
  }

  els.statsArea.innerHTML = data.weekStats
    .map(
      (stat) => `
        <div class="stat">
          <span>${stat.week}주차 성공률</span>
          <strong>${stat.successRate}%</strong>
          <small>${stat.successCount}/${stat.totalParticipants}명 성공</small>
        </div>
      `,
    )
    .join("");

  els.participantTable.innerHTML = data.participants.length
    ? data.participants
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

  els.submissionTable.innerHTML = data.submissions.length
    ? data.submissions
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

els.juniorButton.addEventListener("click", () => selectGroup("junior"));
els.seniorButton.addEventListener("click", () => selectGroup("senior"));

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

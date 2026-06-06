const state = {
  student: null,
  slots: [],
  reservation: null,
  settings: null,
  adminPassword: "",
};

const $ = (id) => document.getElementById(id);

const els = {
  studentLoginForm: $("studentLoginForm"),
  studentNameInput: $("studentNameInput"),
  studentPhoneInput: $("studentPhoneInput"),
  reservationArea: $("reservationArea"),
  studentWelcome: $("studentWelcome"),
  periodText: $("periodText"),
  studentLogoutButton: $("studentLogoutButton"),
  myReservationBox: $("myReservationBox"),
  myReservationText: $("myReservationText"),
  cancelReservationButton: $("cancelReservationButton"),
  scheduleGrid: $("scheduleGrid"),
  adminLoginForm: $("adminLoginForm"),
  adminPasswordInput: $("adminPasswordInput"),
  adminPanel: $("adminPanel"),
  startDateInput: $("startDateInput"),
  savePeriodButton: $("savePeriodButton"),
  refreshAdminButton: $("refreshAdminButton"),
  resetSeminarButton: $("resetSeminarButton"),
  adminSummary: $("adminSummary"),
  adminReservationTable: $("adminReservationTable"),
  seminarToast: $("seminarToast"),
};

function showToast(message) {
  els.seminarToast.textContent = message;
  els.seminarToast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.seminarToast.classList.add("hidden"), 2800);
}

async function api(path, payload = null) {
  const options = payload
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    : { method: "GET" };
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "요청을 처리하지 못했습니다.");
  return data;
}

function studentCredentials() {
  return {
    name: state.student.name,
    phone: state.student.phone,
  };
}

function setPublicState(data) {
  state.slots = data.slots || [];
  state.settings = data.settings || null;
  state.reservation = data.reservation || null;
}

function formatPeriod(settings) {
  if (!settings) return "상담 기간을 불러오는 중입니다.";
  const start = new Date(`${settings.startDate}T00:00:00+09:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + settings.days - 1);
  const formatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  return `${formatter.format(start)} ~ ${formatter.format(end)} · 오전 11시부터 오후 5시까지`;
}

function renderReservationArea() {
  if (!state.student) return;
  els.reservationArea.classList.remove("hidden");
  els.studentWelcome.textContent = `${state.student.name}님 상담 시간 선택`;
  els.periodText.textContent = formatPeriod(state.settings);

  if (state.reservation) {
    els.myReservationBox.classList.remove("hidden");
    els.myReservationText.textContent = `${state.reservation.dateLabel} ${state.reservation.start}~${state.reservation.end}`;
  } else {
    els.myReservationBox.classList.add("hidden");
    els.myReservationText.textContent = "";
  }

  renderSchedule();
}

function renderSchedule() {
  const byDate = new Map();
  state.slots.forEach((slot) => {
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date).push(slot);
  });

  els.scheduleGrid.innerHTML = Array.from(byDate.entries())
    .map(([date, slots]) => {
      const dateLabel = slots[0] ? slots[0].dateLabel : date;
      const buttons = slots
        .map((slot) => {
          const className = slot.mine ? "mine" : slot.booked ? "booked" : "";
          const label = slot.mine ? "내 예약" : slot.booked ? "예약마감" : "예약가능";
          return `
            <button class="${className}" type="button" data-slot-id="${slot.id}" ${slot.booked && !slot.mine ? "disabled" : ""}>
              <strong>${slot.label}</strong>
              <span>${label}</span>
            </button>
          `;
        })
        .join("");
      return `
        <article class="day-card">
          <h3>${dateLabel}</h3>
          <div class="slot-list">${buttons}</div>
        </article>
      `;
    })
    .join("");
}

function renderAdmin(data) {
  els.adminPanel.classList.remove("hidden");
  els.startDateInput.value = data.settings.startDate;
  const totalSlots = data.slots.length;
  const reserved = data.reservations.length;
  els.adminSummary.innerHTML = `
    <article><span>상담 기간</span><strong>${formatPeriod(data.settings)}</strong></article>
    <article><span>예약 현황</span><strong>${reserved}/${totalSlots}</strong></article>
    <article><span>남은 칸</span><strong>${Math.max(totalSlots - reserved, 0)}</strong></article>
  `;

  els.adminReservationTable.innerHTML = data.reservations.length
    ? data.reservations
        .map(
          (reservation) => `
            <tr>
              <td>${escapeHtml(formatDateLabel(reservation.date))}</td>
              <td>${escapeHtml(`${reservation.start}~${reservation.end}`)}</td>
              <td>${escapeHtml(reservation.name)}</td>
              <td>${escapeHtml(formatPhone(reservation.phone))}</td>
              <td>${escapeHtml(reservation.createdAt)}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="5">아직 예약된 상담이 없습니다.</td></tr>`;
}

function formatDateLabel(dateValue) {
  const date = new Date(`${dateValue}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(date);
}

function formatPhone(phone) {
  const numbers = String(phone || "");
  if (numbers.length === 11) return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  return numbers;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.studentLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api("/api/seminar/login", {
      name: els.studentNameInput.value,
      phone: els.studentPhoneInput.value,
    });
    state.student = data.student;
    setPublicState(data);
    localStorage.setItem("seminarStudent", JSON.stringify(state.student));
    renderReservationArea();
    showToast(data.message);
  } catch (error) {
    showToast(error.message);
  }
});

els.scheduleGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-slot-id]");
  if (!button || !state.student) return;
  if (state.reservation && !button.classList.contains("mine")) {
    showToast("기존 예약을 취소하고 시간변경을 해주세요");
    return;
  }
  if (button.classList.contains("mine")) {
    showToast("이미 선택한 상담 시간입니다.");
    return;
  }

  try {
    const data = await api("/api/seminar/book", {
      ...studentCredentials(),
      slotId: button.dataset.slotId,
    });
    setPublicState(data);
    renderReservationArea();
    showToast(data.message);
  } catch (error) {
    showToast(error.message);
    if (state.student) {
      const data = await api("/api/seminar/login", studentCredentials());
      setPublicState(data);
      renderReservationArea();
    }
  }
});

els.cancelReservationButton.addEventListener("click", async () => {
  if (!state.student) return;
  try {
    const data = await api("/api/seminar/cancel", studentCredentials());
    setPublicState(data);
    renderReservationArea();
    showToast(data.message);
  } catch (error) {
    showToast(error.message);
  }
});

els.studentLogoutButton.addEventListener("click", () => {
  localStorage.removeItem("seminarStudent");
  state.student = null;
  state.reservation = null;
  els.reservationArea.classList.add("hidden");
  showToast("로그아웃되었습니다.");
});

els.adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.adminPassword = els.adminPasswordInput.value;
  try {
    const data = await api("/api/seminar/admin", { password: state.adminPassword });
    renderAdmin(data);
    showToast("관리자 예약 현황을 불러왔습니다.");
  } catch (error) {
    showToast(error.message);
  }
});

els.savePeriodButton.addEventListener("click", async () => {
  try {
    const data = await api("/api/seminar/settings", {
      password: state.adminPassword,
      startDate: els.startDateInput.value,
    });
    renderAdmin(data);
    showToast(data.message);
  } catch (error) {
    showToast(error.message);
  }
});

els.refreshAdminButton.addEventListener("click", async () => {
  try {
    const data = await api("/api/seminar/admin", { password: state.adminPassword });
    renderAdmin(data);
    showToast("새로고침 완료");
  } catch (error) {
    showToast(error.message);
  }
});

els.resetSeminarButton.addEventListener("click", async () => {
  const confirmed = window.confirm("모든 상담 예약 데이터를 초기화할까요?");
  if (!confirmed) return;
  try {
    const data = await api("/api/seminar/reset", { password: state.adminPassword });
    els.adminPanel.classList.add("hidden");
    localStorage.removeItem("seminarStudent");
    state.student = null;
    state.reservation = null;
    els.reservationArea.classList.add("hidden");
    showToast(data.message);
  } catch (error) {
    showToast(error.message);
  }
});

async function restoreStudent() {
  const saved = localStorage.getItem("seminarStudent");
  if (!saved) return;
  try {
    const student = JSON.parse(saved);
    const data = await api("/api/seminar/login", student);
    state.student = data.student;
    setPublicState(data);
    renderReservationArea();
  } catch {
    localStorage.removeItem("seminarStudent");
  }
}

restoreStudent();

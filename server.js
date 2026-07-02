const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "choblog7";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const SUPABASE_STATE_TABLE = process.env.SUPABASE_STATE_TABLE || "choblog7_state";
const MISSION_STATE_KEY = process.env.MISSION_STATE_KEY || "mission";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const SEMINAR_DB_PATH = path.join(DATA_DIR, "seminar.json");
const MISSION_WEEKS = [1, 2, 3, 4, 5, 6];
const EXAM_WEEK = 6;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function emptyDb() {
  return { participants: [], submissions: [], progress: [], settings: { currentWeek: 1 } };
}

function normalizeDb(db) {
  const normalized = db && typeof db === "object" ? db : emptyDb();
  if (!Array.isArray(normalized.participants)) normalized.participants = [];
  if (!Array.isArray(normalized.submissions)) normalized.submissions = [];
  if (!Array.isArray(normalized.progress)) normalized.progress = [];
  if (!normalized.settings) normalized.settings = { currentWeek: 1 };
  if (!normalized.settings.currentWeek) normalized.settings.currentWeek = 1;
  return normalized;
}

function useSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function toDateInputValue(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function emptySeminarDb() {
  return {
    students: [],
    reservations: [],
    settings: {
      startDate: toDateInputValue(new Date()),
      days: 7,
      startHour: 11,
      endHour: 17,
      intervalMinutes: 20,
    },
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) writeDb(emptyDb());
}

function ensureSeminarDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SEMINAR_DB_PATH)) writeSeminarDb(emptySeminarDb());
}

function readDb() {
  ensureDb();
  return normalizeDb(JSON.parse(fs.readFileSync(DB_PATH, "utf8")));
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase 저장소 오류: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function readMissionDb() {
  if (!useSupabase()) return readDb();

  const rows = await supabaseRequest(`${SUPABASE_STATE_TABLE}?key=eq.${encodeURIComponent(MISSION_STATE_KEY)}&select=data&limit=1`);
  if (rows.length && rows[0].data) return normalizeDb(rows[0].data);

  const initialDb = readDb();
  await writeMissionDb(initialDb);
  return initialDb;
}

function readSeminarDb() {
  ensureSeminarDb();
  const db = JSON.parse(fs.readFileSync(SEMINAR_DB_PATH, "utf8"));
  if (!db.settings) db.settings = emptySeminarDb().settings;
  if (!Array.isArray(db.students)) db.students = [];
  if (!Array.isArray(db.reservations)) db.reservations = [];
  return db;
}

function writeDb(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

async function writeMissionDb(db) {
  const normalized = normalizeDb(db);
  if (!useSupabase()) {
    writeDb(normalized);
    return;
  }

  await supabaseRequest(`${SUPABASE_STATE_TABLE}?on_conflict=key`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      key: MISSION_STATE_KEY,
      data: normalized,
      updated_at: new Date().toISOString(),
    }),
  });
}

function writeSeminarDb(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SEMINAR_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("요청 데이터가 너무 큽니다."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON 형식이 올바르지 않습니다."));
      }
    });
  });
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function normalizeGroup(group) {
  return group === "senior" ? "senior" : "junior";
}

function participantId(name, phone) {
  return crypto.createHash("sha256").update(`${name}|${phone}`).digest("hex").slice(0, 16);
}

function isSundayInKorea(now = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(now);
  return weekday === "Sun";
}

function getKoreaTimestamp() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function formatKoreanDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function validateWeek(week) {
  const value = Number(week);
  return MISSION_WEEKS.includes(value) ? value : null;
}

function missionWeekLabel(week) {
  return Number(week) === EXAM_WEEK ? "시험기간" : `${week}주차`;
}

function validateDateInput(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.href;
  } catch {
    return "";
  }
}

function getParticipant(db, name, phone, group) {
  let participant = db.participants.find((item) => item.name === name && item.phone === phone);
  if (!participant) {
    participant = {
      id: participantId(name, phone),
      name,
      phone,
      group: normalizeGroup(group),
      createdAt: getKoreaTimestamp(),
    };
    db.participants.push(participant);
  } else if (!participant.group || participant.group !== normalizeGroup(group)) {
    participant.group = normalizeGroup(group);
  }
  return participant;
}

function findSubmission(submissions, participantIdValue, week, mission) {
  return submissions.find(
    (item) => item.participantId === participantIdValue && item.week === week && item.mission === mission,
  );
}

function findProgress(progressRows, participantIdValue, week) {
  return progressRows.find((item) => item.participantId === participantIdValue && item.week === week);
}

function getProgress(db, participant, week) {
  let progress = findProgress(db.progress, participant.id, week);
  if (!progress) {
    progress = {
      id: crypto.randomUUID(),
      participantId: participant.id,
      name: participant.name,
      phone: participant.phone,
      group: participant.group,
      week,
      mission1Url: "",
      mission2Details: {
        stayedOverOneMinute: false,
        liked: false,
        neighborRequest: false,
        secretComment: false,
      },
      updatedAt: getKoreaTimestamp(),
    };
    db.progress.push(progress);
  }
  progress.name = participant.name;
  progress.phone = participant.phone;
  progress.group = participant.group;
  return progress;
}

function summarizeParticipant(participant, submissions, currentWeek = 1, progressRows = []) {
  const weeks = MISSION_WEEKS.map((week) => {
    const mission1 = findSubmission(submissions, participant.id, week, "mission1");
    const mission2 = findSubmission(submissions, participant.id, week, "mission2");
    const progress = findProgress(progressRows, participant.id, week);
    const mission2Details = mission2
      ? mission2.details
      : progress && progress.mission2Details
        ? progress.mission2Details
        : {
            stayedOverOneMinute: false,
            liked: false,
            neighborRequest: false,
            secretComment: false,
          };
    return {
      week,
      label: missionWeekLabel(week),
      mission1: Boolean(mission1),
      mission1Url: mission1 ? mission1.details.postUrl : progress ? progress.mission1Url || "" : "",
      mission1SubmittedAt: mission1 ? mission1.submittedAt : "",
      mission1SubmittedDuringWeek: mission1 ? mission1.submittedDuringWeek || week : null,
      mission1Late: Boolean(mission1 && (mission1.submittedDuringWeek || week) > week),
      mission2: Boolean(mission2),
      mission2Details,
      mission2SubmittedAt: mission2 ? mission2.submittedAt : "",
      mission2SubmittedDuringWeek: mission2 ? mission2.submittedDuringWeek || week : null,
      mission2Late: Boolean(mission2 && (mission2.submittedDuringWeek || week) > week),
      success: Boolean(mission1 && mission2),
      late: Boolean(
        (mission1 && (mission1.submittedDuringWeek || week) > week) ||
        (mission2 && (mission2.submittedDuringWeek || week) > week),
      ),
      currentWeek,
    };
  });

  return {
    ...participant,
    group: participant.group || "junior",
    completedWeeks: weeks.filter((week) => week.success).length,
    weeks,
  };
}

function buildWeekStats(participants) {
  const totalParticipants = participants.length;
  return MISSION_WEEKS.map((week, index) => {
    const successCount = participants.filter((participant) => participant.weeks[index].success).length;
    return {
      week,
      label: missionWeekLabel(week),
      successCount,
      totalParticipants,
      successRate: totalParticipants ? Math.round((successCount / totalParticipants) * 100) : 0,
    };
  });
}

function looksBrokenName(name) {
  const text = String(name || "").trim();
  return !text || text === "??" || text.includes("�") || /^\?+$/.test(text);
}

function findDisplayParticipant(participants, item) {
  const matches = participants.filter(
    (person) =>
      (item.participantId && person.id === item.participantId) ||
      (item.phone && person.phone === item.phone),
  );
  return matches.find((person) => !looksBrokenName(person.name)) || matches[0] || null;
}

function buildLinkRows(db) {
  return db.submissions
    .filter((item) => item.mission === "mission1" && item.details && item.details.postUrl)
    .slice()
    .map((item) => {
      const participant = findDisplayParticipant(db.participants, item);
      const participantName = participant && !looksBrokenName(participant.name) ? participant.name : "";
      const fallbackName = "이름 확인 필요";
      const name = participantName || (looksBrokenName(item.name) ? fallbackName : item.name);
      const group = participant && participant.group ? participant.group : item.group;
      return {
        name,
        group: normalizeGroup(group),
        week: item.week,
        url: item.details.postUrl,
        submittedAt: item.submittedAt,
      };
    })
    .sort((a, b) => a.week - b.week || String(a.name || "").localeCompare(String(b.name || ""), "ko"));
}

function seminarStudentId(name, phone) {
  return crypto.createHash("sha256").update(`seminar|${name}|${phone}`).digest("hex").slice(0, 16);
}

function getSeminarStudent(db, name, phone) {
  let student = db.students.find((item) => item.name === name && item.phone === phone);
  if (!student) {
    student = {
      id: seminarStudentId(name, phone),
      name,
      phone,
      createdAt: getKoreaTimestamp(),
    };
    db.students.push(student);
  }
  return student;
}

function minutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildSeminarSlots(settings, reservations, studentId = null) {
  const slots = [];
  const startMinutes = settings.startHour * 60;
  const endMinutes = settings.endHour * 60;
  for (let dayIndex = 0; dayIndex < settings.days; dayIndex += 1) {
    const date = addDays(settings.startDate, dayIndex);
    for (let minutes = startMinutes; minutes < endMinutes; minutes += settings.intervalMinutes) {
      const start = minutesToTime(minutes);
      const end = minutesToTime(minutes + settings.intervalMinutes);
      const slotId = `${date}_${start}`;
      const reservation = reservations.find((item) => item.slotId === slotId);
      slots.push({
        id: slotId,
        date,
        dateLabel: formatKoreanDate(date),
        start,
        end,
        label: `${start}~${end}`,
        booked: Boolean(reservation),
        mine: Boolean(studentId && reservation && reservation.studentId === studentId),
      });
    }
  }
  return slots;
}

function findActiveSeminarReservation(db, studentId) {
  return db.reservations.find((item) => item.studentId === studentId);
}

function sanitizeSeminarReservation(reservation) {
  if (!reservation) return null;
  return {
    id: reservation.id,
    slotId: reservation.slotId,
    date: reservation.date,
    dateLabel: formatKoreanDate(reservation.date),
    start: reservation.start,
    end: reservation.end,
    name: reservation.name,
    createdAt: reservation.createdAt,
  };
}

function buildSeminarPublicPayload(db, studentId = null) {
  const ownReservation = studentId ? findActiveSeminarReservation(db, studentId) : null;
  return {
    ok: true,
    settings: db.settings,
    slots: buildSeminarSlots(db.settings, db.reservations, studentId),
    reservation: sanitizeSeminarReservation(ownReservation),
  };
}

async function handleApi(req, res, pathname) {
  try {
    if (pathname === "/api/seminar/public" && req.method === "GET") {
      const db = readSeminarDb();
      return sendJson(res, 200, buildSeminarPublicPayload(db));
    }

    if (pathname === "/api/seminar/login" && req.method === "POST") {
      const body = await readBody(req);
      const name = normalizeName(body.name);
      const phone = normalizePhone(body.phone);
      if (!name || phone.length < 8) {
        return sendJson(res, 400, { ok: false, message: "학생 이름과 휴대폰번호를 확인해주세요." });
      }
      const db = readSeminarDb();
      const student = getSeminarStudent(db, name, phone);
      writeSeminarDb(db);
      return sendJson(res, 200, {
        ...buildSeminarPublicPayload(db, student.id),
        student,
        message: `${student.name}님, 상담 예약 화면에 접속했습니다.`,
      });
    }

    if (pathname === "/api/seminar/book" && req.method === "POST") {
      const body = await readBody(req);
      const name = normalizeName(body.name);
      const phone = normalizePhone(body.phone);
      const slotId = String(body.slotId || "").trim();
      if (!name || phone.length < 8 || !slotId) {
        return sendJson(res, 400, { ok: false, message: "예약 정보가 올바르지 않습니다." });
      }

      const db = readSeminarDb();
      const student = getSeminarStudent(db, name, phone);
      const existingReservation = findActiveSeminarReservation(db, student.id);
      if (existingReservation) {
        writeSeminarDb(db);
        return sendJson(res, 409, { ok: false, message: "기존 예약을 취소하고 시간변경을 해주세요" });
      }

      const slots = buildSeminarSlots(db.settings, db.reservations, student.id);
      const slot = slots.find((item) => item.id === slotId);
      if (!slot) {
        return sendJson(res, 400, { ok: false, message: "선택할 수 없는 상담 시간입니다." });
      }
      if (slot.booked) {
        return sendJson(res, 409, { ok: false, message: "이미 다른 학생이 예약한 시간입니다." });
      }

      const reservation = {
        id: crypto.randomUUID(),
        studentId: student.id,
        name: student.name,
        phone: student.phone,
        slotId: slot.id,
        date: slot.date,
        start: slot.start,
        end: slot.end,
        createdAt: getKoreaTimestamp(),
      };
      db.reservations.push(reservation);
      writeSeminarDb(db);
      return sendJson(res, 200, {
        ...buildSeminarPublicPayload(db, student.id),
        student,
        message: `${slot.dateLabel} ${slot.start}~${slot.end} 상담 예약이 완료되었습니다.`,
      });
    }

    if (pathname === "/api/seminar/cancel" && req.method === "POST") {
      const body = await readBody(req);
      const name = normalizeName(body.name);
      const phone = normalizePhone(body.phone);
      if (!name || phone.length < 8) {
        return sendJson(res, 400, { ok: false, message: "학생 이름과 휴대폰번호를 확인해주세요." });
      }

      const db = readSeminarDb();
      const student = getSeminarStudent(db, name, phone);
      const beforeCount = db.reservations.length;
      db.reservations = db.reservations.filter((item) => item.studentId !== student.id);
      writeSeminarDb(db);
      return sendJson(res, 200, {
        ...buildSeminarPublicPayload(db, student.id),
        student,
        message: beforeCount === db.reservations.length ? "취소할 예약이 없습니다." : "기존 상담 예약이 취소되었습니다.",
      });
    }

    if (pathname === "/api/seminar/admin" && req.method === "POST") {
      const body = await readBody(req);
      if (String(body.password || "") !== MASTER_PASSWORD) {
        return sendJson(res, 401, { ok: false, message: "관리자 비밀번호가 올바르지 않습니다." });
      }
      const db = readSeminarDb();
      return sendJson(res, 200, {
        ok: true,
        settings: db.settings,
        slots: buildSeminarSlots(db.settings, db.reservations),
        reservations: db.reservations
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
      });
    }

    if (pathname === "/api/seminar/settings" && req.method === "POST") {
      const body = await readBody(req);
      if (String(body.password || "") !== MASTER_PASSWORD) {
        return sendJson(res, 401, { ok: false, message: "관리자 비밀번호가 올바르지 않습니다." });
      }
      const startDate = validateDateInput(body.startDate);
      if (!startDate) {
        return sendJson(res, 400, { ok: false, message: "상담 시작 날짜를 선택해주세요." });
      }
      const db = readSeminarDb();
      db.settings.startDate = startDate;
      writeSeminarDb(db);
      return sendJson(res, 200, {
        ok: true,
        message: `${formatKoreanDate(startDate)}부터 7일간 상담 기간으로 설정했습니다.`,
        settings: db.settings,
        slots: buildSeminarSlots(db.settings, db.reservations),
        reservations: db.reservations
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
      });
    }

    if (pathname === "/api/seminar/reset" && req.method === "POST") {
      const body = await readBody(req);
      if (String(body.password || "") !== MASTER_PASSWORD) {
        return sendJson(res, 401, { ok: false, message: "관리자 비밀번호가 올바르지 않습니다." });
      }
      writeSeminarDb(emptySeminarDb());
      return sendJson(res, 200, { ok: true, message: "상담 예약 데이터가 초기화되었습니다." });
    }

    if (pathname === "/api/links" && req.method === "GET") {
      const db = await readMissionDb();
      return sendJson(res, 200, { ok: true, currentWeek: db.settings.currentWeek, links: buildLinkRows(db) });
    }

    if (pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);
      const name = normalizeName(body.name);
      const phone = normalizePhone(body.phone);
      const group = normalizeGroup(body.group);
      if (!name || phone.length < 8) {
        return sendJson(res, 400, { ok: false, message: "이름과 휴대폰번호를 확인해주세요." });
      }

      const db = await readMissionDb();
      const participant = getParticipant(db, name, phone, group);
      await writeMissionDb(db);
      return sendJson(res, 200, {
        ok: true,
        participant,
        summary: summarizeParticipant(participant, db.submissions, db.settings.currentWeek, db.progress),
        canSubmitMission1Today: isSundayInKorea(),
      });
    }

    if (pathname === "/api/progress" && req.method === "POST") {
      const body = await readBody(req);
      const name = normalizeName(body.name);
      const phone = normalizePhone(body.phone);
      const group = normalizeGroup(body.group);
      const week = validateWeek(body.week);

      if (!name || phone.length < 8 || !week) {
        return sendJson(res, 400, { ok: false, message: "저장 정보가 올바르지 않습니다." });
      }

      const db = await readMissionDb();
      const participant = getParticipant(db, name, phone, group);
      const progress = getProgress(db, participant, week);

      if (body.details && Object.prototype.hasOwnProperty.call(body.details, "postUrl")) {
        progress.mission1Url = normalizeUrl(body.details.postUrl) || String(body.details.postUrl || "").trim();
      }

      if (body.details && body.details.mission2Details) {
        progress.mission2Details = {
          stayedOverOneMinute: Boolean(body.details.mission2Details.stayedOverOneMinute),
          liked: Boolean(body.details.mission2Details.liked),
          neighborRequest: Boolean(body.details.mission2Details.neighborRequest),
          secretComment: Boolean(body.details.mission2Details.secretComment),
        };
      }

      progress.updatedAt = getKoreaTimestamp();
      await writeMissionDb(db);
      return sendJson(res, 200, {
        ok: true,
        message: "진행 상태가 저장되었습니다.",
        summary: summarizeParticipant(participant, db.submissions, db.settings.currentWeek, db.progress),
      });
    }

    if (pathname === "/api/submit" && req.method === "POST") {
      const body = await readBody(req);
      const name = normalizeName(body.name);
      const phone = normalizePhone(body.phone);
      const group = normalizeGroup(body.group);
      const week = validateWeek(body.week);
      const mission = body.mission === "mission1" || body.mission === "mission2" ? body.mission : null;

      if (!name || phone.length < 8 || !week || !mission) {
        return sendJson(res, 400, { ok: false, message: "제출 정보가 올바르지 않습니다." });
      }

      const db = await readMissionDb();
      const participant = getParticipant(db, name, phone, group);
      const existingSubmission = findSubmission(db.submissions, participant.id, week, mission);

      let details;
      if (mission === "mission1") {
        const postUrl = normalizeUrl(body.details && body.details.postUrl);
        if (!postUrl) {
          return sendJson(res, 400, { ok: false, message: "올바른 블로그 주소를 입력해주세요." });
        }
        details = { postUrl };
      } else {
        details = {
          stayedOverOneMinute: Boolean(body.details && body.details.stayedOverOneMinute),
          liked: Boolean(body.details && body.details.liked),
          neighborRequest: Boolean(body.details && body.details.neighborRequest),
          secretComment: Boolean(body.details && body.details.secretComment),
        };
      }

      const sameDetails = existingSubmission && JSON.stringify(existingSubmission.details || {}) === JSON.stringify(details);
      if (sameDetails) {
        await writeMissionDb(db);
        return sendJson(res, 409, { ok: false, message: `${week}주차 미션은 이미 제출 하였습니다` });
      }

      const progress = getProgress(db, participant, week);
      if (mission === "mission1") progress.mission1Url = details.postUrl;
      if (mission === "mission2") progress.mission2Details = details;
      progress.updatedAt = getKoreaTimestamp();

      const submission =
        existingSubmission ||
        {
          id: crypto.randomUUID(),
          participantId: participant.id,
          name: participant.name,
          phone: participant.phone,
          group: participant.group,
          week,
          mission,
          submittedDuringWeek: db.settings.currentWeek,
          submittedAt: getKoreaTimestamp(),
        };

      submission.name = participant.name;
      submission.phone = participant.phone;
      submission.group = participant.group;
      submission.details = details;
      if (existingSubmission) submission.updatedAt = getKoreaTimestamp();

      if (!existingSubmission) db.submissions.push(submission);
      await writeMissionDb(db);
      return sendJson(res, 200, {
        ok: true,
        message: existingSubmission ? "수정 완료되었습니다." : "미션 완료가 저장되었습니다.",
        submission,
        summary: summarizeParticipant(participant, db.submissions, db.settings.currentWeek, db.progress),
      });
    }

    if (pathname === "/api/master" && req.method === "POST") {
      const body = await readBody(req);
      if (String(body.password || "") !== MASTER_PASSWORD) {
        return sendJson(res, 401, { ok: false, message: "마스터 비밀번호가 올바르지 않습니다." });
      }

      const db = await readMissionDb();
      const participants = db.participants.map((participant) =>
        summarizeParticipant(participant, db.submissions, db.settings.currentWeek, db.progress),
      );
      return sendJson(res, 200, {
        ok: true,
        settings: db.settings,
        participants,
        submissions: db.submissions.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
        links: buildLinkRows(db),
        weekStats: buildWeekStats(participants),
      });
    }

    if (pathname === "/api/current-week" && req.method === "POST") {
      const body = await readBody(req);
      if (String(body.password || "") !== MASTER_PASSWORD) {
        return sendJson(res, 401, { ok: false, message: "마스터 비밀번호가 올바르지 않습니다." });
      }
      const currentWeek = validateWeek(body.currentWeek);
      if (!currentWeek) {
        return sendJson(res, 400, { ok: false, message: "현재 진행 기간을 1주차부터 시험기간 사이로 선택해주세요." });
      }
      const db = await readMissionDb();
      db.settings.currentWeek = currentWeek;
      await writeMissionDb(db);
      const participants = db.participants.map((participant) =>
        summarizeParticipant(participant, db.submissions, db.settings.currentWeek, db.progress),
      );
      return sendJson(res, 200, {
        ok: true,
        message: `${missionWeekLabel(currentWeek)}을 현재 진행 기간으로 설정했습니다.`,
        settings: db.settings,
        participants,
        submissions: db.submissions.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
        links: buildLinkRows(db),
        weekStats: buildWeekStats(participants),
      });
    }

    if (pathname === "/api/reset" && req.method === "POST") {
      const body = await readBody(req);
      if (String(body.password || "") !== MASTER_PASSWORD) {
        return sendJson(res, 401, { ok: false, message: "마스터 비밀번호가 올바르지 않습니다." });
      }
      await writeMissionDb(emptyDb());
      return sendJson(res, 200, { ok: true, message: "모든 데이터가 초기화되었습니다." });
    }

    sendJson(res, 404, { ok: false, message: "API를 찾을 수 없습니다." });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error.message || "서버 오류가 발생했습니다." });
  }
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

ensureDb();

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      handleApi(req, res, url.pathname);
      return;
    }
    serveStatic(req, res, url.pathname);
  })
  .listen(PORT, () => {
    console.log(`초블7기 미션 사이트가 실행되었습니다: http://localhost:${PORT}`);
    console.log(`마스터 기본 비밀번호: ${MASTER_PASSWORD}`);
  });

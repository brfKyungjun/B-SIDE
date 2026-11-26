// 사람, 날짜, 휴가 결재 흐름, 주간보고 규칙. 화면 없이 테스트할 수 있게 분리했다.
// 데이터 모양: { leaves: [...], reports: [...], meetings: [...] } 를 localStorage 한 키에 저장.

export const PEOPLE = [
  { id: "min", name: "김민서", team: "플랫폼팀", role: "팀원" },
  { id: "yoon", name: "이서윤", team: "플랫폼팀", role: "팀원" },
  { id: "lead", name: "박도현", team: "플랫폼팀", role: "팀장" },
  { id: "jun", name: "한지우", team: "서비스팀", role: "팀원" },
  { id: "sol", name: "정유진", team: "서비스팀", role: "팀장" },
  { id: "admin", name: "오수현", team: "경영지원팀", role: "관리자" },
];
export const person = id => PEOPLE.find(p => p.id === id);
export const TEAMS = ["플랫폼팀", "서비스팀", "경영지원팀"];
export const DEMO_USERS = ["min", "lead", "admin"]; // 헤더 '시연 역할' 버튼
export const LEAVE_TYPES = ["연차", "오전 반차", "오후 반차"];
export const STORAGE_KEY = "brframe-groupware-flow-v1";
// stage 0 → 1 → 2. 2가 되면 캘린더와 알림 메일함에 나타난다.
export const STAGES = ["팀장 승인 대기", "관리자 승인 대기", "최종 승인"];

// ===== 날짜 ("YYYY-MM-DD" 문자열로 다룬다) =====
const fmt = d => [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n, i) => (i ? String(n).padStart(2, "0") : n)).join("-");
export const toDate = s => new Date(s + "T12:00:00"); // 정오로 잡아 시간대 경계 문제를 피한다
export const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return fmt(d); };
export const weekStart = s => addDays(s, -((toDate(s).getDay() + 6) % 7)); // 월요일
export const monthStart = (s, offset) => { const d = toDate(s); d.setDate(1); d.setMonth(d.getMonth() + offset); return fmt(d); };
export const shortDate = s => s.slice(5).replace("-", "."); // "11.28"
export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
const uid = () => crypto.randomUUID();
export const covers = (item, day) => item.start <= day && item.end >= day;

// ===== 권한 =====
// 관리자는 모든 사람, 그 외에는 같은 팀만 본다.
export const canSeePerson = (viewer, id) => viewer.role === "관리자" || viewer.team === person(id)?.team;
// 팀원은 자기 신청, 팀장은 팀 신청, 관리자는 팀장 승인이 끝난 신청부터 본다.
export const canSeeLeave = (viewer, leave) =>
  viewer.role === "팀원" ? viewer.id === leave.who
    : viewer.role === "팀장" ? canSeePerson(viewer, leave.who)
      : leave.stage >= 1;
export const canApprove = (viewer, leave) =>
  (viewer.role === "팀장" && viewer.team === person(leave.who).team && leave.stage === 0 && viewer.id !== leave.who) ||
  (viewer.role === "관리자" && leave.stage === 1);
export const visibleReports = (db, viewer) =>
  db.reports.filter(r => (viewer.role === "팀원" ? r.who === viewer.id : canSeePerson(viewer, r.who)));

// ===== 시연 데이터 (오늘 날짜 기준으로 만든다) =====
export function seed(day = today()) {
  const leave = (id, who, offset, type, stage) => ({
    id, who, start: addDays(day, offset), end: addDays(day, offset), type,
    reason: "개인 일정", stage, created: day, decided: stage === 2 ? day : null,
  });
  return {
    leaves: [
      leave("l1", "min", 2, "연차", 0),
      leave("l2", "jun", 3, "연차", 1),
      leave("l3", "yoon", 0, "오후 반차", 2),
      leave("l4", "jun", -2, "연차", 2),
      leave("l5", "min", -4, "오전 반차", 2),
    ],
    reports: [
      { id: "r1", who: "yoon", date: day, done: "캘린더 화면 설계와 모바일 레이아웃 검토를 완료했습니다.", next: "팀별 일정 필터 사용성을 점검합니다.", issue: "" },
      { id: "r2", who: "jun", date: day, done: "고객 문의 유형을 정리하고 테스트 시나리오를 작성했습니다.", next: "운영팀과 시나리오를 검토합니다.", issue: "검토 일정 조율 필요" },
    ],
    meetings: [
      { id: "m1", who: "lead", date: day, title: "플랫폼팀 스프린트 리뷰" },
      { id: "m2", who: "sol", date: addDays(day, 1), title: "서비스팀 운영 회의" },
      { id: "m3", who: "lead", date: addDays(day, -6), title: "주간 업무 회의" },
    ],
  };
}

// ===== 바꾸는 동작 (새 db를 돌려주고, 규칙 위반이면 throw) =====
export function approve(db, viewer, id) {
  const leave = db.leaves.find(l => l.id === id);
  if (!leave || !canApprove(viewer, leave)) throw Error("이 요청은 현재 역할에서 승인할 수 없습니다.");
  return {
    ...db,
    leaves: db.leaves.map(l => (l.id === id ? { ...l, stage: l.stage + 1, ...(l.stage === 1 ? { decided: today() } : {}) } : l)),
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function addLeave(db, viewer, form) {
  if (
    viewer.role !== "팀원" ||
    !LEAVE_TYPES.includes(form.type) ||
    !DATE.test(form.start) || !DATE.test(form.end) ||
    form.end < form.start ||
    (form.type !== "연차" && form.start !== form.end) // 반차는 하루만
  ) throw Error("휴가 종류와 기간을 확인해 주세요.");
  // 연차는 무엇과도 겹칠 수 없고, 반차는 같은 날 같은 반차만 막는다 (오전 + 오후는 허용).
  if (db.leaves.some(l => l.who === viewer.id && form.start <= l.end && form.end >= l.start &&
    (l.type === "연차" || form.type === "연차" || l.type === form.type)))
    throw Error("같은 기간에 겹치는 휴가 신청이 있습니다.");
  return { ...db, leaves: [{ ...form, id: uid(), who: viewer.id, stage: 0, created: today(), decided: null }, ...db.leaves] };
}

// 한 사람당 한 주에 한 건. 같은 주에 다시 내면 덮어쓴다.
export function saveReport(db, viewer, form) {
  if (viewer.role !== "팀원" || !form.done.trim() || !form.next.trim()) throw Error("이번 주 업무와 다음 주 계획을 입력해 주세요.");
  const prev = db.reports.find(r => r.who === viewer.id && weekStart(r.date) === weekStart(form.date));
  return { ...db, reports: [{ ...form, who: viewer.id, id: prev?.id || uid() }, ...db.reports.filter(r => r.id !== prev?.id)] };
}

// ===== 읽기 =====
// 캘린더에는 최종 승인된 휴가와 회의만 나온다.
export function calendarItems(db, viewer) {
  return [
    ...db.leaves.filter(l => l.stage === 2 && canSeePerson(viewer, l.who))
      .map(l => ({ id: l.id, who: l.who, start: l.start, end: l.end, kind: "leave", title: person(l.who).name + " " + l.type })),
    ...db.meetings.filter(m => canSeePerson(viewer, m.who)).map(m => ({ ...m, start: m.date, end: m.date, kind: "meeting" })),
  ];
}

// 최종 승인 알림 메일 받는 사람: 신청자, 그 팀 팀장, 관리자
export const recipients = leave => [...new Set([
  leave.who,
  PEOPLE.find(p => p.role === "팀장" && p.team === person(leave.who).team)?.id,
  "admin",
].filter(Boolean))];
export const mailFor = (db, viewer) =>
  db.leaves.filter(l => l.stage === 2 && recipients(l).includes(viewer.id)).sort((a, b) => b.decided.localeCompare(a.decided));

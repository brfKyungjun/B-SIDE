// ===== 사람 =====
const TEAM = "해외사업팀";
const PEOPLE = {
  pjh: { name: "박지훈", role: "팀장" },
  jde: { name: "정다은", role: "팀원" },
  osr: { name: "오세린", role: "팀원" },
  hdy: { name: "한도윤", role: "팀원" },
  kmj: { name: "김민재", role: "팀원" },
};
const ALL = Object.keys(PEOPLE);

// ===== 저장소 (브라우저 localStorage) =====
// 휴가 신청 레코드 하나가 전자결재와 일정을 잇는다.
// 필드: 신청자, 종류, 날짜, 사유, 결재자, 상태 ("대기" → "승인됨" | "반려됨")
// 상태가 "승인됨"인 레코드가 그대로 팀 일정 항목이 된다.
const KEY = "brgw";
function seed() {
  return {
    leaves: [
      { id: "L1", 신청자: "jde", 종류: "연차", 날짜: "2026-12-03", 사유: "개인 일정", 결재자: "pjh", 상태: "대기", 신청일: "2026-11-25", 처리일: "", 반려사유: "" },
      { id: "L2", 신청자: "hdy", 종류: "반차", 날짜: "2026-11-27", 사유: "병원", 결재자: "pjh", 상태: "승인됨", 신청일: "2026-11-20", 처리일: "2026-11-20", 반려사유: "" },
      { id: "L3", 신청자: "osr", 종류: "연차", 날짜: "2026-12-01", 사유: "가족 행사", 결재자: "pjh", 상태: "승인됨", 신청일: "2026-11-18", 처리일: "2026-11-19", 반려사유: "" },
      { id: "L4", 신청자: "kmj", 종류: "연차", 날짜: "2026-12-04", 사유: "개인 일정", 결재자: "pjh", 상태: "승인됨", 신청일: "2026-11-21", 처리일: "2026-11-21", 반려사유: "" },
    ],
    events: [
      { date: "2026-12-03", start: "14:00", end: "15:00", title: "주간 해외사업 회의", where: "회의실 3", who: ALL },
    ],
    tasks: [
      { id: "T1", owner: "pjh", kind: "결재", title: "12월 해외 출장비 정산", from: "kmj", since: "2026-11-24", done: false },
      { id: "T2", owner: "pjh", kind: "협조", title: "베트남 바이어 견적서 검토", from: "osr", since: "2026-11-26", done: false },
      { id: "T3", owner: "jde", kind: "협조", title: "12월 수출 선적 일정표 확인", from: "pjh", since: "2026-11-26", done: false },
    ],
    seen: [], // 신청자가 이미 본 결재 결과 (도장 애니메이션은 처음 한 번만)
  };
}
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { return seed(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
}

// ponytail: 오늘 일정은 매일 같은 샘플. 일정 기능이 붙으면 db.events에서 읽는다.
const DAILY = [
  { start: "09:30", end: "10:00", title: "팀 데일리", where: "회의실 3", who: ALL },
  { start: "11:00", end: "12:00", title: "베트남 바이어 화상 미팅", where: "Teams", who: ["pjh", "osr"] },
  { start: "13:30", end: "15:00", title: "수출 서류 검토", where: "자리", who: ["jde"] },
  { start: "16:00", end: "16:30", title: "1:1 면담", where: "회의실 5", who: ["pjh", "jde"] },
];

// ===== 날짜 도우미 =====
const WD = "일월화수목금토";
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const md = s => { const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
const short = s => { const d = parse(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const wd = s => WD[parse(s).getDay()];
const hrs = t => { const [h, m] = t.split(":").map(Number); return h + m / 60; };
const TODAY = ymd(new Date());
const ago = s => {
  const n = Math.round((parse(TODAY) - parse(s)) / 864e5);
  return n <= 0 ? "오늘" : n === 1 ? "어제" : `${n}일 전`;
};
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const nameOf = id => esc(PEOPLE[id]?.name ?? id);
const $ = id => document.getElementById(id);

// ===== 상태 =====
let db = load();
let me = (() => { try { return sessionStorage.getItem("brgw.me"); } catch { return null; } })() || "jde";
let justApproved = null;

const approvedOn = date => db.leaves.filter(l => l.날짜 === date && l.상태 === "승인됨");
const queueFor = id => [
  ...db.leaves.filter(l => l.결재자 === id && l.상태 === "대기").map(l => ({ kind: "leave", item: l })),
  ...db.tasks.filter(t => t.owner === id && !t.done).map(t => ({ kind: "task", item: t })),
];
const todayEvents = () =>
  [...DAILY, ...db.events.filter(e => e.date === TODAY)]
    .filter(e => e.who.includes(me))
    .sort((a, b) => hrs(a.start) - hrs(b.start));

// ===== 그리기 =====
function render() {
  const q = queueFor(me);
  document.querySelectorAll(".switch button").forEach(b => b.setAttribute("aria-pressed", b.dataset.user === me));
  $("badge").textContent = q.length || "";
  renderHead(q);
  renderMine();
  renderQueue(q);
  renderBand();
  renderDay();
}

function renderHead(q) {
  $("dateline").textContent = `${md(TODAY)} ${wd(TODAY)}요일, ${TEAM}`;
  const last = db.leaves.filter(l => l.신청자 === me).at(-1);
  let h;
  if (PEOPLE[me].role === "팀원" && last) {
    const w = `${md(last.날짜)} ${last.종류}`;
    h = last.상태 === "대기" ? `${w}가 ${nameOf(last.결재자)} 팀장 결재를 기다리고 있습니다`
      : last.상태 === "승인됨" ? `${w}가 승인됐습니다` : `${w}가 반려됐습니다`;
  } else {
    h = q.length ? `처리할 일이 ${q.length}건 있습니다` : "처리할 일을 모두 마쳤습니다";
  }
  $("headline").textContent = h;

  const count = k => q.filter(x => (x.kind === "leave" ? "결재" : x.item.kind) === k).length;
  const parts = [["결재", count("결재")], ["협조", count("협조")], ["오늘 일정", todayEvents().length]]
    .filter(([, n]) => n).map(([k, n]) => `${k} ${n}건`);
  $("summary").textContent = parts.join(", ") || "오늘은 잡힌 일정이 없습니다";
}

function renderMine() {
  const box = $("mine");
  box.hidden = PEOPLE[me].role !== "팀원";
  if (box.hidden) return;
  const mine = db.leaves.filter(l => l.신청자 === me).reverse();
  $("leaves").innerHTML = mine.length ? mine.map(rowMine).join("")
    : `<li class="empty">신청한 휴가가 없습니다. 휴가 신청에서 날짜와 종류를 고르면 팀장에게 바로 올라갑니다.</li>`;

  const unseen = mine.filter(l => l.상태 !== "대기" && !db.seen.includes(l.id));
  if (unseen.length) { db.seen.push(...unseen.map(l => l.id)); save(); }
}

function rowMine(l) {
  const approver = nameOf(l.결재자);
  const fresh = l.상태 !== "대기" && !db.seen.includes(l.id) ? " fresh" : "";
  let cell, status, cls = "";
  if (l.상태 === "승인됨") {
    cell = `<span class="seal${fresh}">${approver}</span>`;
    status = `${md(l.처리일)} 승인. 팀 일정 ${md(l.날짜)}에 올라갔습니다. <button type="button" class="linkish" data-go="team">팀 일정 보기</button>`;
    cls = "done";
  } else if (l.상태 === "반려됨") {
    cell = `<span class="seal square${fresh}">반려</span>`;
    status = `반려 사유: ${esc(l.반려사유)}`;
    cls = "no";
  } else {
    cell = `<span class="wait">대기</span>`;
    status = `${approver} 팀장 결재를 기다리는 중입니다. ${ago(l.신청일)} 신청했습니다.`;
  }
  return `<li>
    <div>
      <div class="what">${esc(l.종류)} ${md(l.날짜)} ${wd(l.날짜)}요일</div>
      <div class="meta">하루, 사유 ${esc(l.사유)}</div>
      <p class="status ${cls}">${status}</p>
    </div>
    <table class="sign" aria-label="결재란">
      <tr><th>신청</th><th>팀장</th></tr>
      <tr><td><span class="signature">${nameOf(l.신청자)}</span></td><td>${cell}</td></tr>
      <tr><td>${short(l.신청일)}</td><td>${l.처리일 ? short(l.처리일) : "&nbsp;"}</td></tr>
    </table>
  </li>`;
}

function renderQueue(q) {
  $("queue").innerHTML = q.length
    ? q.map(x => (x.kind === "leave" ? rowLeave(x.item) : rowTask(x.item))).join("")
    : `<li class="empty">처리할 일이 없습니다.</li>`;
}

const approveButtons = `<button type="button" class="btn primary" data-act="approve">승인</button><button type="button" class="btn" data-act="reject">반려</button>`;

function rowLeave(l) {
  const evs = db.events.filter(e => e.date === l.날짜);
  const others = approvedOn(l.날짜).filter(x => x.신청자 !== l.신청자);
  const evText = evs.length
    ? evs.map(e => `${esc(e.start)} ${esc(e.title)}${e.who.includes(l.신청자) ? ` (${nameOf(l.신청자)} 참석 예정)` : ""}`).join(", ")
    : "회의 없음";
  const offText = others.length ? others.map(x => `${nameOf(x.신청자)} ${x.종류}`).join(", ") + " 휴가" : "다른 휴가자 없음";
  return `<li data-kind="leave" data-id="${esc(l.id)}">
    <span class="kind leave">휴가</span>
    <div><strong>${esc(l.종류)} ${md(l.날짜)} (${wd(l.날짜)})</strong><span class="meta">${nameOf(l.신청자)}, 사유 ${esc(l.사유)}, ${ago(l.신청일)} 신청</span></div>
    <div class="actions">${approveButtons}</div>
    <p class="peek"><b>그날 팀 일정</b> ${evText}. ${offText}.</p>
  </li>`;
}

function rowTask(t) {
  const acts = t.kind === "결재" ? approveButtons : `<button type="button" class="btn primary" data-act="confirm">확인</button>`;
  return `<li data-kind="task" data-id="${esc(t.id)}">
    <span class="kind">${esc(t.kind)}</span>
    <div><strong>${esc(t.title)}</strong><span class="meta">${nameOf(t.from)}, ${ago(t.since)} 요청</span></div>
    <div class="actions">${acts}</div>
  </li>`;
}

function renderBand() {
  const t = parse(TODAY);
  const d = new Date(t);
  d.setDate(t.getDate() - ((t.getDay() + 6) % 7)); // 이번 주 월요일
  const days = [];
  for (; days.length < 10; d.setDate(d.getDate() + 1)) if (d.getDay() % 6) days.push(ymd(d));
  $("range").textContent = `${short(days[0])} ~ ${short(days.at(-1))}, 승인된 휴가만 보입니다`;

  const colCls = (s, i) => [i === 5 && "wk", s === TODAY && "today-col"].filter(Boolean).join(" ");
  const head = days.map((s, i) => {
    const n = parse(s).getDate();
    const ev = db.events.find(e => e.date === s);
    return `<th class="${colCls(s, i)}${s === TODAY ? " today" : ""}"><span class="d">${n === 1 ? short(s) : n}</span>${wd(s)}${ev ? `<span class="ev">${parseInt(ev.start)}시 회의</span>` : ""}</th>`;
  }).join("");
  const body = ALL.map(p => `<tr><th class="${p === me ? "me" : ""}">${nameOf(p)}</th>${days.map((s, i) => {
    const l = approvedOn(s).find(x => x.신청자 === p);
    return `<td class="${colCls(s, i)}">${l ? `<span class="off${l.id === justApproved ? " just" : ""}">${esc(l.종류)}</span>` : ""}</td>`;
  }).join("")}</tr>`).join("");
  $("band").innerHTML = `<thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody>`;
}

function renderDay() {
  const FIRST = 9, LAST = 18;
  const hour = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hour"));
  const off = approvedOn(TODAY).find(l => l.신청자 === me);
  let html = off ? `<div class="allday">종일 ${esc(off.종류)}</div>` : "";
  html += `<div class="hours">`;
  for (let h = FIRST; h < LAST; h++) html += `<div class="hour" data-h="${h}:00"></div>`;
  for (const e of todayEvents()) {
    const s = hrs(e.start), len = hrs(e.end) - s;
    html += `<div class="event${len < 0.75 ? " short" : ""}" style="top:${(s - FIRST) * hour}px;height:${len * hour - 2}px"><b>${esc(e.title)}</b><span>${esc(e.where)}</span></div>`;
  }
  const now = new Date(), t = now.getHours() + now.getMinutes() / 60;
  if (t >= FIRST && t <= LAST) html += `<div class="now" style="top:${(t - FIRST) * hour}px" aria-label="현재 시각"></div>`;
  $("day").innerHTML = html + `</div>`;
}

// ===== 동작 =====
const toastEl = $("toast");
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function finish(li, kind, id, result, reason = "") {
  let msg;
  if (kind === "leave") {
    const l = db.leaves.find(x => x.id === id);
    Object.assign(l, { 상태: result, 처리일: TODAY, 반려사유: reason });
    if (result === "승인됨") {
      justApproved = id;
      msg = `승인했습니다. 팀 일정 ${md(l.날짜)}에 ${nameOf(l.신청자)} ${l.종류}가 올라갔습니다.`;
    } else {
      msg = `반려했습니다: ${nameOf(l.신청자)} ${l.종류} ${md(l.날짜)}`;
    }
  } else {
    const t = db.tasks.find(x => x.id === id);
    t.done = true;
    msg = `${{ 승인됨: "승인", 반려됨: "반려", 확인: "확인" }[result]}했습니다: ${t.title}`;
  }
  save();
  toast(msg);
  li.classList.add("gone");
  setTimeout(render, 250);
}

$("queue").addEventListener("click", e => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const li = btn.closest("li");
  const { kind, id } = li.dataset;
  const act = btn.dataset.act;
  if (act === "reject") {
    li.classList.add("rejecting");
    li.insertAdjacentHTML("beforeend", `<form class="reject">
      <label>반려 사유<textarea name="reason" rows="1" required></textarea></label>
      <button type="submit" class="btn danger" disabled>반려</button>
      <button type="button" class="btn" data-act="cancel">취소</button>
    </form>`);
    li.querySelector("textarea").focus();
  } else if (act === "cancel") {
    li.classList.remove("rejecting");
    li.querySelector(".reject").remove();
  } else {
    finish(li, kind, id, act === "approve" ? "승인됨" : "확인");
  }
});
$("queue").addEventListener("input", e => {
  if (e.target.name === "reason") e.target.form.querySelector("[type=submit]").disabled = !e.target.value.trim();
});
$("queue").addEventListener("submit", e => {
  e.preventDefault();
  const reason = e.target.reason.value.trim();
  if (!reason) return;
  const li = e.target.closest("li");
  finish(li, li.dataset.kind, li.dataset.id, "반려됨", reason);
});

$("leaves").addEventListener("click", e => {
  if (!e.target.closest("[data-go]")) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("team").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
});

document.querySelector(".switch").addEventListener("click", e => {
  const b = e.target.closest("button[data-user]");
  if (!b || b.dataset.user === me) return;
  me = b.dataset.user;
  try { sessionStorage.setItem("brgw.me", me); } catch {}
  justApproved = null;
  location.hash = "#home";
  render();
});

$("reset").addEventListener("click", () => {
  if (!confirm("시연 데이터를 처음 상태로 되돌립니다.")) return;
  db = seed();
  save();
  justApproved = null;
  render();
  toast("시연 데이터를 처음 상태로 되돌렸습니다.");
});

// 다른 창(예: 팀장 창)에서 바뀐 내용을 바로 반영
addEventListener("storage", e => {
  if (e.key !== KEY) return;
  db = load();
  render();
});

// ===== 화면 전환 (#home, #approval ...) =====
function route() {
  const id = location.hash.slice(1) || "home";
  document.querySelectorAll("main > section").forEach(s => (s.hidden = s.id !== id));
  document.querySelectorAll(".side a").forEach(a => {
    if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
addEventListener("hashchange", route);
route();
render();

import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  PEOPLE, person, TEAMS, DEMO_USERS, LEAVE_TYPES, STORAGE_KEY, STAGES,
  toDate, addDays, weekStart, monthStart, shortDate, today, covers,
  canSeePerson, canSeeLeave, canApprove, visibleReports,
  seed, approve, addLeave, saveReport, calendarItems, recipients, mailFor,
} from "./flow.js";

const ICONS = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  calendar: "M4 6h16v15H4z M4 10h16 M8 3v5 M16 3v5",
  file: "M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6",
  check: "m4 12 5 5L20 6",
  inbox: "M3 7l3-4h12l3 4v13H3z M3 13h5l2 3h4l2-3h5",
  mail: "M3 5h18v14H3z M3 6l9 7 9-7",
  spark: "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z",
  clock: "M12 2a10 10 0 1 0 .1 0 M12 6v6l4 2",
  team: "M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M1 20a7 7 0 0 1 14 0 M16 4a4 4 0 0 1 0 7 M17 14a6 6 0 0 1 5 6",
  plus: "M12 5v14 M5 12h14",
  left: "m15 5-7 7 7 7",
  right: "m9 5 7 7-7 7",
  close: "m5 5 14 14 M19 5 5 19",
  send: "m3 3 18 9-18 9 4-9z M7 12h14",
  menu: "M3 6h18 M3 12h18 M3 18h18",
};

function Icon({ n, s = 18 }) {
  return (
    <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[n]} />
    </svg>
  );
}

const MENU = [
  ["home", "grid", "대시보드"],
  ["cal", "calendar", "캘린더"],
  ["approval", "inbox", "연차 · 결재"],
  ["reports", "file", "주간보고"],
  ["mail", "mail", "알림 메일함"],
];
const TRAIL = { 팀원: "나의 업무", 팀장: "팀 업무", 관리자: "전사 업무" };
const WEEKDAYS_EN = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const loadDb = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : seed();
};
const longDate = s => toDate(s).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
const period = l => (l.start === l.end ? shortDate(l.start) : shortDate(l.start) + " – " + shortDate(l.end));

function StageBadge({ stage }) {
  return <span className={"badge b" + stage}>{STAGES[stage]}</span>;
}

function BoxHead({ title, subtitle, children }) {
  return (
    <div className="boxhead">
      <div>
        <h2>{title}</h2>
        {subtitle && <small>{subtitle}</small>}
      </div>
      {children}
    </div>
  );
}

function Modal({ title, close, children }) {
  const ref = useRef();
  useEffect(() => { ref.current.showModal(); }, []);
  return (
    <dialog ref={ref} onCancel={close} onClick={e => { e.target === ref.current && close(); }}>
      <div className="dialoginner">
        <BoxHead title={title}>
          <button className="square" onClick={close} aria-label="닫기"><Icon n="close" /></button>
        </BoxHead>
        {children}
      </div>
    </dialog>
  );
}

function App() {
  const [db, setDb] = useState(() => { try { return loadDb(); } catch { return seed(); } });
  const [me, setMe] = useState("min");
  const [page, setPage] = useState("home");
  const [modal, setModal] = useState(null); // { kind: day|leave|report|request|read, s: 날짜, id }
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState("");
  const now = today();
  const [month, setMonth] = useState(monthStart(now, 0));
  const [week, setWeek] = useState(weekStart(now));
  const [teamFilter, setTeamFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");

  const user = person(me);
  const isMember = user.role === "팀원";
  const isAdmin = user.role === "관리자";
  const myPeople = PEOPLE.filter(p => canSeePerson(user, p.id));
  const myLeaves = db.leaves.filter(l => canSeeLeave(user, l));
  const toApprove = myLeaves.filter(l => canApprove(user, l));
  const reports = visibleReports(db, user);
  const mail = mailFor(db, user);
  const items = calendarItems(db, user);
  const matchFilter = who => (!teamFilter || person(who).team === teamFilter) && (!personFilter || who === personFilter);
  const shownItems = items.filter(x => matchFilter(x.who));
  const offToday = items.filter(x => x.kind === "leave" && covers(x, now));
  // 팀원: 아직 진행 중인 내 신청, 팀장/관리자: 내가 승인할 요청
  const pending = isMember ? myLeaves.filter(l => l.stage !== 2) : toApprove;
  const weekReports = reports.filter(r => weekStart(r.date) === week);

  // 다른 탭(예: 팀장 탭)에서 바뀐 내용을 바로 반영
  useEffect(() => {
    function onStorage(e) {
      if (e.key === STORAGE_KEY && e.newValue) try { setDb(JSON.parse(e.newValue)); } catch {}
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  function open(m) { setError(""); setModal(m); }
  function go(p) { setMenuOpen(false); setPage(p); setModal(null); window.scrollTo({ top: 0 }); }
  function switchUser(id) {
    setMe(id); setPage("home"); setTeamFilter(""); setPersonFilter("");
    setWeek(weekStart(now)); setMonth(monthStart(now, 0));
    setModal(null); setError(""); setToast("");
    setChatOpen(false); setChat([]); setQuestion(""); setMenuOpen(false);
  }
  // 저장소에서 최신 값을 다시 읽어 바꾼 뒤 저장. 규칙 위반이면 대화상자에 오류를 띄운다.
  function commit(change, message) {
    try {
      const next = change(loadDb());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setDb(next); setModal(null); setError(""); setToast(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }
  function approveLeave(id) {
    commit(d => approve(d, user, id), isAdmin
      ? "최종 승인했습니다. 캘린더와 데모 메일함에 반영했습니다."
      : "팀장 승인이 완료되어 관리자 결재함으로 이동했습니다.");
  }

  function renderFilters() {
    return (
      <div className="filters">
        {isAdmin && (
          <select aria-label="팀 필터" value={teamFilter} onChange={e => { setTeamFilter(e.target.value); setPersonFilter(""); }}>
            <option value="">모든 팀</option>
            {TEAMS.map(t => <option key={t}>{t}</option>)}
          </select>
        )}
        <select aria-label="인원 필터" value={personFilter} onChange={e => setPersonFilter(e.target.value)}>
          <option value="">전체 인원</option>
          {myPeople.filter(p => !teamFilter || p.team === teamFilter).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    );
  }

  function renderCalendar() {
    const first = toDate(month);
    const gridStart = addDays(month, -first.getDay());
    const lastDate = toDate(addDays(monthStart(month, 1), -1)).getDate();
    const cells = Math.ceil((first.getDay() + lastDate) / 7) * 7;
    return (
      <section className="box">
        <BoxHead title={isAdmin ? "전사 캘린더" : "팀 캘린더"} subtitle={isAdmin ? "모든 팀의 확정 일정" : user.team + "의 확정 일정"}>
          {renderFilters()}
        </BoxHead>
        <div className="month">
          <b>{first.getFullYear()}년 {first.getMonth() + 1}월</b>
          <div>
            <button className="square" aria-label="이전 달" onClick={() => setMonth(monthStart(month, -1))}><Icon n="left" s={15} /></button>
            <button onClick={() => setMonth(monthStart(now, 0))}>오늘</button>
            <button className="square" aria-label="다음 달" onClick={() => setMonth(monthStart(month, 1))}><Icon n="right" s={15} /></button>
          </div>
        </div>
        <div className="calendar">
          {"일월화수목금토".split("").map(w => <div className="weekday" key={w}>{w}</div>)}
          {Array.from({ length: cells }, (_, i) => {
            const day = addDays(gridStart, i);
            const list = shownItems.filter(x => covers(x, day));
            return (
              <button key={day} className={"day " + (day.slice(0, 7) !== month.slice(0, 7) ? "out " : "") + (day === now ? "now" : "")}
                aria-label={day + " 일정 " + list.length + "건"} onClick={() => open({ kind: "day", s: day })}>
                <span>{toDate(day).getDate()}</span>
                {list.slice(0, 2).map(x => <small className={x.kind} key={x.id}>{x.title}</small>)}
                {list.length > 2 && <em>+{list.length - 2}</em>}
              </button>
            );
          })}
        </div>
        <footer>
          <span className="dot leave" />{" 휴가·반차 "}<span className="dot meeting" />{" 팀 일정 "}
          <span className="tip">날짜를 눌러 상세 보기</span>
        </footer>
      </section>
    );
  }

  function renderRequestRows(list) {
    return list.length ? list.map(l => (
      <button className="row" key={l.id} onClick={() => open({ kind: "request", id: l.id })}>
        <span className="avatar">{person(l.who).name[0]}</span>
        <span className="grow">
          <b>{person(l.who).name} · {l.type}</b>
          <small>{period(l)}{"　"}{person(l.who).team}</small>
        </span>
        <StageBadge stage={l.stage} />
      </button>
    )) : <div className="empty">현재 처리할 신청이 없습니다.</div>;
  }

  // compact: 대시보드 카드(3건까지), 아니면 연차·결재 메뉴 전체 목록
  function renderRequests(compact) {
    const list = compact ? pending : myLeaves;
    return (
      <section className="box">
        <BoxHead
          title={compact ? (isMember ? "내 결재 현황" : "승인 요청함") : "연차 · 결재"}
          subtitle={isMember ? "신청 건을 눌러 진행 단계를 확인하세요." : isAdmin ? "팀장 승인을 마친 요청을 확인합니다." : "우리 팀의 연차와 반차를 확인합니다."}>
          {compact
            ? <button onClick={() => go("approval")}>전체 보기</button>
            : isMember && <button className="blue" onClick={() => open({ kind: "leave", s: now })}>연차 신청</button>}
        </BoxHead>
        {renderRequestRows(compact
          ? list.slice(0, 3)
          // 내가 승인할 건을 위로, 그다음 최근 신청 순
          : [...list].sort((a, b) => Number(canApprove(user, b)) - Number(canApprove(user, a)) || b.created.localeCompare(a.created)))}
      </section>
    );
  }

  function renderWorkStatus() {
    return (
      <section className="box">
        <BoxHead title="오늘의 근무 상태" subtitle={longDate(now)} />
        <div className="persons">
          {myPeople.map(p => {
            const off = offToday.filter(x => x.who === p.id);
            return (
              <div key={p.id}>
                <span>{p.name} <small>{p.team}</small></span>
                <span className={"badge " + (off.length ? "b1" : "b2")}>
                  {off.length ? off.map(x => x.title.slice(p.name.length + 1).replace(/^연차$/, "휴가중")).join(" · ") : "근무중"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  function renderReports() {
    const list = weekReports.filter(r => matchFilter(r.who));
    const ofTeam = team => list.filter(r => person(r.who).team === team);
    return (
      <section className="box">
        <BoxHead title={isMember ? "내 주간보고" : isAdmin ? "팀별 주간보고" : "팀원 주간보고"}>
          {isMember ? <button className="blue" onClick={() => open({ kind: "report", s: week })}>주간보고 작성</button> : renderFilters()}
        </BoxHead>
        <div className="month">
          <b>{shortDate(week)} – {shortDate(addDays(week, 6))}</b>
          <div>
            <button aria-label="이전 주" onClick={() => setWeek(addDays(week, -7))}>‹</button>
            <button onClick={() => setWeek(weekStart(now))}>이번 주</button>
            <button aria-label="다음 주" onClick={() => setWeek(addDays(week, 7))}>›</button>
          </div>
        </div>
        {(isAdmin ? TEAMS.filter(t => !teamFilter || teamFilter === t) : [user.team]).map(team => (
          <section className="group" key={team}>
            <h3>{team} <small>{ofTeam(team).length}건</small></h3>
            {ofTeam(team).map(r => (
              <button className="row" key={r.id} onClick={() => open({ kind: isMember ? "report" : "read", s: r.date, id: r.id })}>
                <span className="avatar">{person(r.who).name[0]}</span>
                <span className="grow">
                  <b>{person(r.who).name}의 주간보고</b>
                  <small>{r.done}</small>
                </span>
                <Icon n="right" s={15} />
              </button>
            ))}
            {!ofTeam(team).length && <p className="empty">이 주에 제출된 보고서가 없습니다.</p>}
          </section>
        ))}
      </section>
    );
  }

  function renderMail() {
    return (
      <section className="box">
        <BoxHead title="최종 승인 알림" subtitle="시연용 메일함 · 최종 승인 시 신청자와 결재자에게 자동 생성됩니다." />
        {mail.length ? mail.map(l => (
          <details className="letter" key={l.id}>
            <summary>
              <Icon n="mail" />
              <b>{person(l.who).name}님의 {l.type}가 승인되었습니다.</b>
              <small>{period(l)}</small>
            </summary>
            <p>받는 사람{"　"}{recipients(l).map(id => person(id).name).join(", ")}</p>
            <p>{l.start} ~ {l.end} · {person(l.who).team} 캘린더 등록 완료</p>
            <p>처리일{"　"}{l.decided}</p>
          </details>
        )) : <p className="empty">받은 승인 알림이 없습니다.</p>}
      </section>
    );
  }

  // AI 채팅: 시연용 키워드 응답. 현재 역할이 볼 수 있는 데이터만 읽는다.
  function ask(q) {
    if (!q.trim()) return;
    let a;
    if (/결재|승인|요청/.test(q)) {
      a = (isMember ? "진행 중인 내 신청" : "지금 승인할 요청") + "은 " + pending.length + "건입니다. " +
        pending.slice(0, 4).map(l => person(l.who).name + " " + period(l) + " " + l.type + " · " + STAGES[l.stage]).join(" / ");
    } else if (/보고/.test(q)) {
      a = "이번 주 제출된 주간보고는 " + reports.filter(r => weekStart(r.date) === weekStart(now)).length +
        "건입니다. 주간보고 메뉴에서 작성 내용과 다음 주 계획을 확인하세요.";
    } else if (/휴가|반차|일정|캘린더|근무/.test(q)) {
      a = "오늘 일정은 " + (items.filter(x => covers(x, now)).map(x => x.title).join(", ") || "없음") + "입니다.";
    } else {
      a = "현재 역할의 오늘 일정, 결재 현황, 이번 주 보고서를 조회할 수 있어요. 아래 질문을 선택해 주세요.";
    }
    setChat([...chat, { q, a }]);
    setQuestion("");
  }

  const closeModal = () => open(null);
  const request = modal?.kind === "request" ? myLeaves.find(l => l.id === modal.id) : null;
  const readReport = modal?.kind === "read" ? reports.find(r => r.id === modal.id) : null;
  const pageTitle = MENU.find(m => m[0] === page)[2];

  return (
    <>
      <header>
        <div className="headerbrand">
          <span className="mark" aria-hidden="true"><i /><i /></span>
          <b>BRFrame</b>
          <span className="brandsep" />
          Workspace
        </div>
        <div className="switch">
          <small>시연 역할</small>
          {DEMO_USERS.map(id => (
            <button aria-pressed={me === id} key={id} onClick={() => switchUser(id)}>{person(id).role}</button>
          ))}
        </div>
      </header>

      <div className="layout">
        <aside className={menuOpen ? "show" : ""}>
          <div className="sidetop">
            <strong>업무 워크스페이스</strong>
            <button className="mobile" onClick={() => setMenuOpen(false)}>닫기</button>
          </div>
          <nav>
            {MENU.map(([id, icon, label]) => (
              <button key={id} className={page === id ? "sel" : ""} onClick={() => go(id)}>
                <Icon n={icon} />{label}
                {id === "approval" && pending.length > 0 && <sup>{pending.length}</sup>}
              </button>
            ))}
          </nav>
          <div className="profile">
            <span className="avatar">{user.name[0]}</span>
            <div>
              <b>{user.name}</b>
              <small>{user.team} · {user.role}</small>
            </div>
          </div>
        </aside>

        <main>
          <button className="mobile" onClick={() => setMenuOpen(true)}><Icon n="menu" />{" 업무 메뉴"}</button>
          <div className="trail">{TRAIL[user.role]} <span>/</span> {pageTitle}</div>

          {page === "home" ? (
            <>
              <section className="hero">
                <div>
                  <span className="eyebrow">{now.replaceAll("-", ".")}{"　"}{WEEKDAYS_EN[toDate(now).getDay()]}</span>
                  <h1>{user.role} <em>대시보드</em></h1>
                  <p>
                    {user.name}님, {isMember ? "나의 신청과 팀 일정을 확인하세요."
                      : isAdmin ? "전사 일정과 최종 승인 요청을 확인하세요." : "팀원들의 일정과 승인 요청을 확인하세요."}
                  </p>
                </div>
                <div className="heroActions">
                  {isMember ? (
                    <>
                      <button onClick={() => open({ kind: "leave", s: now })}><Icon n="plus" />연차 신청</button>
                      <button onClick={() => open({ kind: "report", s: now })}><Icon n="file" />주간보고 작성</button>
                    </>
                  ) : (
                    <button onClick={() => go("approval")}><Icon n="inbox" />승인 요청 확인</button>
                  )}
                </div>
              </section>
              <div className="stats">
                {[
                  [isMember ? "진행 중인 신청" : "승인할 요청", pending.length, "건", "inbox", "approval"],
                  ["오늘 휴가·반차", new Set(offToday.map(x => x.who)).size, "명", "team", "cal"],
                  ["이번 주 보고서", reports.filter(r => weekStart(r.date) === weekStart(now)).length, "건", "file", "reports"],
                ].map(([label, count, unit, icon, target]) => (
                  <button key={label} onClick={() => go(target)}>
                    <span className="statIcon"><Icon n={icon} /></span>
                    <span>{label}<strong>{count}<small>{unit}</small></strong></span>
                  </button>
                ))}
              </div>
              <div className="dashboard">
                <div>{renderCalendar()}</div>
                <div className="stack">
                  {renderRequests(true)}
                  {renderWorkStatus()}
                </div>
              </div>
            </>
          ) : (
            <>
              <h1 className="pagetitle">{pageTitle}</h1>
              {page === "cal" ? renderCalendar()
                : page === "approval" ? renderRequests(false)
                  : page === "reports" ? renderReports()
                    : renderMail()}
            </>
          )}
        </main>
      </div>

      {toast && <div role="status" className="toast">{toast}</div>}

      {modal && (
        <Modal
          title={{ day: longDate(modal.s || now), leave: "연차 신청", report: "주간보고 작성", request: "결재 진행 내역", read: "주간보고 상세" }[modal.kind]}
          close={closeModal}>
          {modal.kind === "day" && (
            <>
              <div className="dayList">
                {shownItems.filter(x => covers(x, modal.s)).map(x => (
                  <p key={x.id}><span className={"dot " + x.kind} /> {x.title} <small>{person(x.who).team}</small></p>
                ))}
                {!shownItems.some(x => covers(x, modal.s)) && <p>등록된 일정이 없습니다.</p>}
              </div>
              <div className="quick">
                {isMember ? (
                  <>
                    <button className="blue" onClick={() => open({ kind: "leave", s: modal.s })}>연차 신청</button>
                    <button onClick={() => open({ kind: "report", s: modal.s })}>주간보고 작성</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => go("approval")}>결재함 보기</button>
                    <button onClick={() => { setWeek(weekStart(modal.s)); go("reports"); }}>이 주의 보고서 보기</button>
                  </>
                )}
              </div>
            </>
          )}

          {modal.kind === "leave" && (
            <LeaveForm s={modal.s}
              onSave={form => commit(d => addLeave(d, user, form), "신청을 제출했습니다. 팀장 결재함에서 확인할 수 있습니다.")} />
          )}

          {modal.kind === "report" && (
            <ReportForm s={modal.s}
              prev={reports.find(r => r.who === me && weekStart(r.date) === weekStart(modal.s))}
              onSave={form => {
                commit(d => saveReport(d, user, form), "주간보고를 저장했습니다. 팀장과 관리자가 확인할 수 있습니다.") && setWeek(weekStart(form.date));
              }} />
          )}

          {request && (
            <>
              <div className="sheetTitle">
                <h3>{person(request.who).name} · {request.type}</h3>
                <StageBadge stage={request.stage} />
              </div>
              <p className="sheetData">{request.start} ~ {request.end}{"　"}{person(request.who).team}</p>
              {request.reason && <p className="reason">{request.reason}</p>}
              <ol className="flow">
                {["연차 신청", "팀장 승인", "관리자 최종 승인", "캘린더 공표 · 알림 메일 생성"].map((step, i) => {
                  const done = request.stage === 2 || i <= request.stage;
                  return (
                    <li className={done ? "done" : i === request.stage + 1 ? "current" : ""} key={step}>
                      <span>{done ? "✓" : i + 1}</span>
                      <div>{step}</div>
                    </li>
                  );
                })}
              </ol>
              {canApprove(user, request) && (
                <button className="blue wide" onClick={() => approveLeave(request.id)}>{isAdmin ? "최종 승인" : "팀장 승인"}</button>
              )}
              {request.stage === 2 && (
                <button className="wide" onClick={() => {
                  setMonth(monthStart(request.start, 0)); setTeamFilter(""); setPersonFilter(request.who); go("cal");
                }}>확정된 일정 보기</button>
              )}
            </>
          )}

          {readReport && (
            <>
              <p className="sheetData">
                {person(readReport.who).name} · {person(readReport.who).team} · {shortDate(weekStart(readReport.date))} 주간
              </p>
              {[["이번 주 업무", readReport.done], ["다음 주 계획", readReport.next], ["이슈 및 요청", readReport.issue || "없음"]].map(([h, text]) => (
                <section className="read" key={h}>
                  <h3>{h}</h3>
                  <p>{text}</p>
                </section>
              ))}
            </>
          )}

          {error && <p role="alert" className="error">{error}</p>}
        </Modal>
      )}

      {chatOpen && (
        <section className="chat">
          <BoxHead title="AI 업무 도우미" subtitle="시연용 · 현재 역할의 업무 데이터 조회">
            <button aria-label="채팅 닫기" onClick={() => setChatOpen(false)}>×</button>
          </BoxHead>
          <div className="history" ref={el => { el && (el.scrollTop = el.scrollHeight); }}>
            {chat.length === 0 ? <p>어떤 업무를 확인할까요?</p> : chat.map((c, i) => (
              <div key={i}>
                <p className="question">{c.q}</p>
                <p>{c.a}</p>
              </div>
            ))}
          </div>
          <div className="suggest">
            {["오늘 일정", "결재 현황", "주간보고"].map(q => <button key={q} onClick={() => ask(q)}>{q}</button>)}
          </div>
          <form className="ask" onSubmit={e => { e.preventDefault(); ask(question); }}>
            <input aria-label="업무 질문" placeholder="궁금한 업무를 입력하세요" value={question} onChange={e => setQuestion(e.target.value)} />
            <button className="blue" aria-label="질문 보내기"><Icon n="send" /></button>
          </form>
        </section>
      )}
      <button className="fab" aria-expanded={chatOpen} onClick={() => setChatOpen(!chatOpen)}><Icon n="spark" /> AI 채팅</button>
    </>
  );
}

function LeaveForm({ s, onSave }) {
  const [type, setType] = useState("연차");
  const [start, setStart] = useState(s);
  const [end, setEnd] = useState(s);
  return (
    <form className="entry" onSubmit={e => {
      e.preventDefault();
      onSave({ type, start, end: type === "연차" ? end : start, reason: e.currentTarget.reason.value.trim() });
    }}>
      <label>휴가 종류
        <select value={type} onChange={e => setType(e.target.value)}>
          {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <div className="dates">
        <label>시작일
          <input required type="date" value={start} onChange={e => { setStart(e.target.value); e.target.value > end && setEnd(e.target.value); }} />
        </label>
        {type === "연차" && (
          <label>종료일
            <input required type="date" min={start} value={end} onChange={e => setEnd(e.target.value)} />
          </label>
        )}
      </div>
      <label>사유 (선택)
        <textarea name="reason" maxLength="500" placeholder="결재자에게 전달할 내용" />
      </label>
      <p className="hint">팀장과 관리자가 차례로 승인하면 팀 캘린더와 알림 메일함에 반영됩니다.</p>
      <button className="blue wide">신청 제출</button>
    </form>
  );
}

function ReportForm({ s, prev, onSave }) {
  return (
    <form className="entry" onSubmit={e => {
      e.preventDefault();
      onSave({ ...Object.fromEntries(new FormData(e.currentTarget)), date: s });
    }}>
      <p className="sheetData">보고 기간{"　"}{weekStart(s)} ~ {addDays(weekStart(s), 6)}</p>
      {[["done", "이번 주 업무"], ["next", "다음 주 계획"], ["issue", "이슈 및 요청 (선택)"]].map(([name, label]) => (
        <label key={name}>{label}
          <textarea required={name !== "issue"} name={name} maxLength="3000" defaultValue={prev?.[name] || ""} />
        </label>
      ))}
      <button className="blue wide">{prev ? "수정 저장" : "보고서 제출"}</button>
    </form>
  );
}

createRoot(document.querySelector("#root")).render(<App />);

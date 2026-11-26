import { test } from "node:test";
import assert from "node:assert/strict";
import { person, seed, approve, addLeave, saveReport, calendarItems, mailFor, canSeeLeave, weekStart } from "./flow.js";

const [min, lead, admin, sol] = ["min", "lead", "admin", "sol"].map(person);
const DAY = "2026-11-26"; // 목요일

test("연차 신청 → 팀장 승인 → 관리자 최종 승인 → 캘린더, 메일", () => {
  let db = addLeave(seed(DAY), min, { type: "연차", start: "2026-12-03", end: "2026-12-04", reason: "" });
  const id = db.leaves[0].id;
  assert.equal(db.leaves[0].stage, 0);
  assert.ok(!canSeeLeave(admin, db.leaves[0]), "관리자는 팀장 승인 전 건을 못 본다");
  assert.throws(() => approve(db, admin, id), /승인할 수 없습니다/);
  assert.throws(() => approve(db, sol, id), /승인할 수 없습니다/, "다른 팀 팀장");

  db = approve(db, lead, id);
  assert.equal(db.leaves[0].stage, 1);
  assert.equal(db.leaves[0].decided, null);
  assert.ok(!calendarItems(db, min).some(x => x.id === id), "최종 승인 전엔 캘린더에 없다");

  db = approve(db, admin, id);
  assert.equal(db.leaves[0].stage, 2);
  assert.ok(db.leaves[0].decided);
  assert.ok(calendarItems(db, min).some(x => x.id === id && x.title === "김민서 연차"));
  assert.ok(!calendarItems(db, sol).some(x => x.id === id), "다른 팀 캘린더엔 안 보인다");
  for (const u of [min, lead, admin]) assert.ok(mailFor(db, u).some(l => l.id === id));
  assert.ok(!mailFor(db, sol).some(l => l.id === id));
});

test("휴가 신청 검증", () => {
  const db = seed(DAY); // 김민서: 11/28 연차, 11/22 오전 반차
  const ask = form => addLeave(db, min, { reason: "", ...form });
  assert.throws(() => ask({ type: "오전 반차", start: "2026-12-01", end: "2026-12-02" }), /종류와 기간/, "반차는 하루만");
  assert.throws(() => ask({ type: "연차", start: "2026-12-02", end: "2026-12-01" }), /종류와 기간/);
  assert.throws(() => addLeave(db, lead, { type: "연차", start: "2026-12-01", end: "2026-12-01" }), /종류와 기간/, "팀원만 신청");
  assert.throws(() => ask({ type: "오후 반차", start: "2026-11-28", end: "2026-11-28" }), /겹치는/, "연차와 겹침");
  assert.throws(() => ask({ type: "오전 반차", start: "2026-11-22", end: "2026-11-22" }), /겹치는/, "같은 반차");
  ask({ type: "오후 반차", start: "2026-11-22", end: "2026-11-22" }); // 오전 + 오후는 허용
});

test("주간보고는 한 주에 한 건, 다시 내면 덮어쓴다", () => {
  let db = saveReport(seed(DAY), min, { date: DAY, done: "A", next: "B", issue: "" });
  db = saveReport(db, min, { date: "2026-11-24", done: "A2", next: "B2", issue: "" });
  const mine = db.reports.filter(r => r.who === "min" && weekStart(r.date) === weekStart(DAY));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].done, "A2");
  assert.throws(() => saveReport(db, min, { date: DAY, done: " ", next: "B", issue: "" }), /입력해 주세요/);
});

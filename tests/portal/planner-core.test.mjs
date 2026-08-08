import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCodexHandoff,
  filterItems,
  normalizeDraft,
  summarizeStatuses
} from "../../portal/planner-core.mjs";

const sample = {
  targetRepo: "english-pattern-lab",
  title: "  Retry pattern review  ",
  rawIdea: "Keep patterns visible in the next session.",
  userValue: "The learner can reuse accepted expressions.",
  scope: "- show three patterns\ntrack one retry",
  doneWhen: "pattern appears in retry\nreview event is visible",
  constraints: "no microphone\nno paid API"
};

const target = {
  repository: "english-pattern-lab",
  project: "English Pattern Coach",
  planningPath: "docs/planning/index.md",
  planningUrl: "https://github.com/StormQlog/english-pattern-lab/blob/main/docs/planning/index.md"
};

test("normalizes draft fields without changing meaning", () => {
  assert.deepEqual(normalizeDraft(sample), {
    targetRepo: "english-pattern-lab",
    title: "Retry pattern review",
    rawIdea: "Keep patterns visible in the next session.",
    userValue: "The learner can reuse accepted expressions.",
    scope: "- show three patterns\ntrack one retry",
    doneWhen: "pattern appears in retry\nreview event is visible",
    constraints: "no microphone\nno paid API"
  });
});

test("generates one self-contained Codex handoff", () => {
  const handoff = buildCodexHandoff(sample, target);

  assert.match(handoff, /^# Codex 작업 요청 — Retry pattern review/m);
  assert.match(handoff, /Repository: `english-pattern-lab`/);
  assert.match(handoff, /Planning source: `docs\/planning\/index\.md`/);
  assert.match(handoff, /- show three patterns/);
  assert.match(handoff, /branch, HEAD\/base, upstream, worktree/);
  assert.match(handoff, /충돌 가능성이 있으면 겹치는 쓰기를 중지/);
  assert.match(handoff, /Issue를 생성하거나 갱신하고 Project 상태를 연결/);
  assert.match(handoff, /Result \/ Validation \/ Decision \/ Human Corrections \/ Remaining Risks \/ Next/);
  assert.match(handoff, /이 공개 Page는 위 입력을 저장하거나 GitHub로 전송하지 않았습니다/);
});

test("summarizes and filters portfolio status", () => {
  const items = [
    { id: "A", status: "Doing" },
    { id: "B", status: "Ready" },
    { id: "C", status: "Doing" }
  ];

  assert.deepEqual(summarizeStatuses(items), {
    Ready: 1,
    Doing: 2,
    Review: 0,
    Done: 0,
    Parked: 0,
    Other: 0
  });
  assert.deepEqual(filterItems(items, "Doing").map((item) => item.id), ["A", "C"]);
  assert.equal(filterItems(items, "All").length, 3);
});

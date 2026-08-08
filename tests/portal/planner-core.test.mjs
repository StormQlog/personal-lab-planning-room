import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIssueContract,
  buildPlanningMarkdown,
  canPersistDraft,
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

test("generates planning and issue handoffs from one draft", () => {
  const planning = buildPlanningMarkdown(sample);
  const issue = buildIssueContract(sample);

  assert.match(planning, /^# Retry pattern review/m);
  assert.match(planning, /`english-pattern-lab`/);
  assert.match(planning, /- show three patterns/);
  assert.match(planning, /- \[ \] Ready to become an Issue/);
  assert.match(issue, /## Done when/);
  assert.match(issue, /## Target repository/);
  assert.match(issue, /- review event is visible/);
  assert.match(issue, /- Human corrections/);
});

test("persistent draft storage is limited to local preview hosts", () => {
  assert.equal(canPersistDraft("127.0.0.1"), true);
  assert.equal(canPersistDraft("localhost"), true);
  assert.equal(canPersistDraft("stormqlog.github.io"), false);
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

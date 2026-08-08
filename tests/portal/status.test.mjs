import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ISSUE_TARGETS } from "../../portal/issue-targets.mjs";

const data = JSON.parse(
  await readFile(new URL("../../portal/data/status.json", import.meta.url), "utf8")
);
const styles = await readFile(new URL("../../portal/styles.css", import.meta.url), "utf8");
const index = await readFile(new URL("../../portal/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../../portal/app.mjs", import.meta.url), "utf8");

test("publication approval and review timestamp move together", () => {
  assert.equal(Boolean(data.publication.reviewedAt), data.publication.approved);
  if (data.publication.reviewedAt) {
    assert.ok(Number.isFinite(Date.parse(data.publication.reviewedAt)));
  }
});

test("status snapshot contains only explicit public-card fields", () => {
  const allowed = [...data.publication.publicFields].sort();

  for (const item of data.items) {
    assert.deepEqual(Object.keys(item).sort(), allowed);
    assert.match(item.url, /^https:\/\/github\.com\//);
  }
});

test("each product cell points to its own main planning source", () => {
  assert.equal(ISSUE_TARGETS.length, 6);
  assert.equal(new Set(ISSUE_TARGETS.map((target) => target.repository)).size, 6);

  for (const target of ISSUE_TARGETS) {
    const expectedPath = target.repository === "lab-hq"
      ? "docs/portfolio/personal-lab.md"
      : "docs/planning/index.md";
    assert.equal(target.planningPath, expectedPath);
    assert.equal(
      new URL(target.planningUrl).pathname,
      `/StormQlog/${target.repository}/blob/main/${expectedPath}`
    );
  }
});

test("LAB-002 records the completed public workflow", () => {
  const item = data.items.find((candidate) => candidate.id === "LAB-002");
  assert.ok(item);
  assert.equal(item.status, "Done");
  assert.equal(item.agentStage, "1 Template");
});

test("LAB-003 records the completed single Codex handoff", () => {
  const item = data.items.find((candidate) => candidate.id === "LAB-003");
  assert.ok(item);
  assert.equal(item.status, "Done");
  assert.equal(item.agentStage, "1 Template");
});

test("the public workspace exposes one primary Codex handoff", () => {
  assert.match(index, /id="copy-handoff"/);
  assert.match(index, /Codex 작업 요청 복사/);
  assert.doesNotMatch(index, /id="copy-planning"/);
  assert.doesNotMatch(index, /id="copy-issue"/);
  assert.doesNotMatch(index, /id="open-issue"/);
  assert.match(index, /StormQlog로 로그인하지 않은 브라우저에서는 링크가 404/);
  assert.match(app, /Private Issue · 로그인 필요/);
});

test("hidden controls stay hidden and workflow uses four columns", () => {
  assert.match(styles, /\[hidden\]\s*{\s*display:\s*none\s*!important;/);
  assert.match(styles, /\.workflow-lane\s*{[^}]*grid-template-columns:\s*repeat\(4, 1fr\)/s);
  assert.match(index, /styles\.css\?v=[0-9-]+/);
});

test("copy handoff has a fallback and deploys with cache-busted assets", () => {
  assert.match(app, /document\.execCommand\("copy"\)/);
  assert.match(app, /미리보기에서 직접 복사하세요/);
  assert.match(app, /buildCodexHandoff/);
  assert.doesNotMatch(app, /window\.open\(/);
  assert.doesNotMatch(app, /localStorage/);
  assert.match(index, /app\.mjs\?v=[0-9-]+/);
});

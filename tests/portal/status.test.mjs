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

test("each product cell routes planning handoff to its own Issue list", () => {
  assert.equal(ISSUE_TARGETS.length, 6);
  assert.equal(new Set(ISSUE_TARGETS.map((target) => target.repository)).size, 6);

  for (const target of ISSUE_TARGETS) {
    const issueUrl = new URL(target.issueNewUrl);
    assert.equal(issueUrl.pathname, `/StormQlog/${target.repository}/issues/new`);
  }
});

test("LAB-002 monitors the workflow used to build the room", () => {
  const item = data.items.find((candidate) => candidate.id === "LAB-002");
  assert.ok(item);
  assert.equal(item.status, "Review");
  assert.equal(item.agentStage, "1 Template");
});

test("hidden controls stay hidden when component styles set display", () => {
  assert.match(styles, /\[hidden\]\s*{\s*display:\s*none\s*!important;/);
  assert.match(index, /styles\.css\?v=[0-9-]+/);
});

test("copy handoff has a fallback and deploys with cache-busted assets", () => {
  assert.match(app, /document\.execCommand\("copy"\)/);
  assert.match(app, /미리보기에서 직접 복사하세요/);
  assert.match(index, /app\.mjs\?v=[0-9-]+/);
});

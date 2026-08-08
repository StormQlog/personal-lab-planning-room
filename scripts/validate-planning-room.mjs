import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { ISSUE_TARGETS } from "../portal/issue-targets.mjs";

const root = resolve(import.meta.dirname, "..");
const portalRoot = resolve(root, "portal");
const statusPath = resolve(root, "portal/data/status.json");
const deploymentRequested = process.argv.includes("--deploy");

const allowedTopLevel = new Set(["schemaVersion", "publication", "meta", "sources", "items"]);
const allowedPublication = new Set(["approved", "reviewedAt", "publicFields", "notice"]);
const allowedMeta = new Set(["title", "description", "lastVerified"]);
const allowedSources = new Set(["projectUrl", "planningUrl"]);
const allowedTarget = new Set(["repository", "project", "planningUrl", "issueNewUrl"]);
const allowedItem = new Set([
  "id",
  "project",
  "repository",
  "title",
  "summary",
  "status",
  "type",
  "agentStage",
  "url"
]);
const allowedStatuses = new Set(["Ready", "Doing", "Review", "Done", "Parked"]);
const allowedPortalFiles = new Set([
  ".nojekyll",
  "app.mjs",
  "data/status.json",
  "index.html",
  "issue-targets.mjs",
  "planner-core.mjs",
  "styles.css"
]);
const secretPatterns = [
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /(?:AKIA|ASIA)[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /ya29\.[0-9A-Za-z_-]{20,}/,
  /xox[baprs]-[0-9A-Za-z-]{10,}/,
  /(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{16,}/,
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
  /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
  /https?:\/\/[^/\s:@]+:[^/\s@]+@/
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    assert(allowed.has(key), `${label} contains a non-allowlisted field: ${key}`);
  }
}

function assertGitHubUrl(value, label) {
  const url = new URL(value);
  assert(url.protocol === "https:", `${label} must use HTTPS.`);
  assert(url.hostname === "github.com", `${label} must point to github.com.`);
}

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Portal artifact must not contain a symbolic link: ${entryPath}`);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

const raw = await readFile(statusPath, "utf8");
const data = JSON.parse(raw);

assertKeys(data, allowedTopLevel, "status.json");
assert(data.schemaVersion === 1, "Unsupported status schema version.");
assertKeys(data.publication, allowedPublication, "publication");
assertKeys(data.meta, allowedMeta, "meta");
assertKeys(data.sources, allowedSources, "sources");
assert(Array.isArray(data.items), "items must be an array.");
assert(Number.isFinite(Date.parse(data.meta.lastVerified)), "lastVerified must be an ISO timestamp.");
assert(typeof data.publication.approved === "boolean", "publication.approved must be boolean.");
if (data.publication.approved) {
  assert(Number.isFinite(Date.parse(data.publication.reviewedAt)), "Approved publication requires an ISO reviewedAt.");
} else {
  assert(data.publication.reviewedAt === null, "Unapproved publication must have reviewedAt: null.");
}

for (const [key, value] of Object.entries(data.sources)) {
  assertGitHubUrl(value, `sources.${key}`);
}

const targetRepositories = new Set();
assert(ISSUE_TARGETS.length === 6, "All six repository Issue targets must be declared.");
for (const [index, target] of ISSUE_TARGETS.entries()) {
  assertKeys(target, allowedTarget, `ISSUE_TARGETS[${index}]`);
  assert(!targetRepositories.has(target.repository), `Duplicate issue target: ${target.repository}`);
  targetRepositories.add(target.repository);
  assertGitHubUrl(target.planningUrl, `issueTargets[${index}].planningUrl`);
  assertGitHubUrl(target.issueNewUrl, `issueTargets[${index}].issueNewUrl`);
  assert(
    new URL(target.issueNewUrl).pathname === `/StormQlog/${target.repository}/issues/new`,
    `issueTargets[${index}] must route to its own repository.`
  );
}

for (const [index, item] of data.items.entries()) {
  assertKeys(item, allowedItem, `items[${index}]`);
  assert(allowedStatuses.has(item.status), `items[${index}] has an unsupported status.`);
  assert(item.summary.length <= 180, `items[${index}] summary is too long for a public card.`);
  assertGitHubUrl(item.url, `items[${index}].url`);
}

const portalFiles = await collectFiles(portalRoot);
const relativePortalFiles = portalFiles.map((file) => relative(portalRoot, file).replaceAll("\\", "/"));
assert(
  JSON.stringify([...relativePortalFiles].sort()) === JSON.stringify([...allowedPortalFiles].sort()),
  "Portal artifact file list differs from the reviewed allowlist."
);
for (const [index, file] of portalFiles.entries()) {
  const content = await readFile(file, "utf8");
  for (const pattern of secretPatterns) {
    assert(!pattern.test(content), `Potential secret material in ${relativePortalFiles[index]} matches ${pattern}.`);
  }
}

assert(
  JSON.stringify([...data.publication.publicFields].sort()) === JSON.stringify([...allowedItem].sort()),
  "publication.publicFields must exactly match the item allowlist."
);
if (deploymentRequested) {
  assert(data.publication.approved === true, "Deployment blocked: public field review is not approved.");
  assert(data.publication.reviewedAt, "Deployment blocked: reviewedAt is required.");
}

console.log(
  `Planning Room data valid (${data.items.length} items, deployment ${deploymentRequested ? "requested" : "not requested"}).`
);

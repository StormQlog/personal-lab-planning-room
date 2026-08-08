const EMPTY_DRAFT = Object.freeze({
  targetRepo: "",
  title: "",
  rawIdea: "",
  userValue: "",
  scope: "",
  doneWhen: "",
  constraints: ""
});

function clean(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function list(value, emptyLabel) {
  const entries = clean(value)
    .split("\n")
    .map((entry) => entry.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  return entries.length
    ? entries.map((entry) => `- ${entry}`).join("\n")
    : `- ${emptyLabel}`;
}

export function normalizeDraft(input = {}) {
  return Object.fromEntries(
    Object.keys(EMPTY_DRAFT).map((key) => [key, clean(input[key])])
  );
}

export function hasDraftContent(input = {}) {
  return Object.values(normalizeDraft(input)).some(Boolean);
}

export function canPersistDraft(hostname = "") {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(
    String(hostname).toLowerCase()
  );
}

export function buildPlanningMarkdown(input = {}) {
  const draft = normalizeDraft(input);
  const title = draft.title || "Untitled planning candidate";

  return `# ${title}

## Target repository

${draft.targetRepo ? `\`${draft.targetRepo}\`` : "Choose the repository that owns this planning candidate."}

## Raw idea

${draft.rawIdea || "Describe the idea here."}

## User value

${draft.userValue || "Describe who benefits and why."}

## Candidate scope

${list(draft.scope, "Define the smallest useful scope.")}

## Done when

${list(draft.doneWhen, "Add an observable completion condition.")}

## Constraints and approval boundaries

${list(draft.constraints, "Record privacy, cost, safety, or approval boundaries.")}

## State

- [x] Raw idea captured
- [ ] Candidate reviewed
- [ ] Ready to become an Issue
`;
}

export function buildIssueContract(input = {}) {
  const draft = normalizeDraft(input);

  return `## Target repository

${draft.targetRepo ? `\`${draft.targetRepo}\`` : "Choose the repository that owns this work before submitting."}

## Goal

${draft.rawIdea || "Define the intended outcome."}

## User value

${draft.userValue || "Explain the user value."}

## In scope

${list(draft.scope, "Define the bounded implementation scope.")}

## Done when

${list(draft.doneWhen, "Add an observable completion condition.")}

## Constraints and approval boundaries

${list(draft.constraints, "Record privacy, cost, safety, or approval boundaries.")}

## Planning reference

Add the private planning Markdown link before starting implementation.

## Evidence to return

- Result
- Validation
- Decision
- Human corrections
- Remaining risks
- Next
`;
}

export function summarizeStatuses(items = []) {
  const summary = { Ready: 0, Doing: 0, Review: 0, Done: 0, Parked: 0, Other: 0 };

  for (const item of items) {
    if (Object.hasOwn(summary, item.status)) {
      summary[item.status] += 1;
    } else {
      summary.Other += 1;
    }
  }

  return summary;
}

export function filterItems(items = [], status = "All") {
  return status === "All"
    ? [...items]
    : items.filter((item) => item.status === status);
}

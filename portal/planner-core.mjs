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

export function buildCodexHandoff(input = {}, target = {}) {
  const draft = normalizeDraft(input);
  const title = draft.title || "제목 미정 아이디어";
  const repository = target.repository || draft.targetRepo || "대상 저장소를 먼저 선택하세요";
  const planningPath = target.planningPath || "대상 저장소의 planning 경로를 확인하세요";
  const planningUrl = target.planningUrl || "private planning URL 미정";

  return `# Codex 작업 요청 — ${title}

## 작업 위치

- Repository: \`${repository}\`
- Planning source: \`${planningPath}\`
- Private planning URL: ${planningUrl}

## 아이디어 원문

${draft.rawIdea || "아직 아이디어 원문이 입력되지 않았습니다."}

## 사용자 가치

${draft.userValue || "기획을 검토하면서 누구에게 어떤 가치가 있는지 정리해 주세요."}

## 후보 범위

${list(draft.scope, "원문과 현재 프로젝트 상태를 확인해 가장 작은 유효 범위를 제안해 주세요.")}

## 완료 조건

${list(draft.doneWhen, "실행 전 관찰 가능한 완료 조건을 제안하고 사용자 확인이 필요하면 멈춰 주세요.")}

## 제약과 승인 경계

${list(draft.constraints, "기존 AGENTS.md와 PROJECT.md의 승인·보안 경계를 그대로 지켜 주세요.")}

## 수행 지침

1. 대상 저장소의 \`AGENTS.md\`, \`PROJECT.md\`, README, 관련 planning/decision/workflow/manual 문서를 먼저 읽어 현재 운영 계약을 파악합니다.
2. 쓰기 전에 branch, HEAD/base, upstream, worktree, staged/unstaged 변경, 진행 중 Issue/PR과 같은 파일·기능을 건드리는 다른 작업을 점검합니다.
3. 충돌 가능성이 있으면 겹치는 쓰기를 중지하고 repo, base commit, branch/Issue, 수정 중인 파일·기능, 보존할 결정·테스트, 권장 소유자와 통합 순서를 중간 메시지로 전달합니다. 비충돌 읽기 감사는 계속합니다.
4. 충돌이 없으면 \`${planningPath}\`에 아이디어를 사용자 중심 planning 후보 또는 승인된 기획으로 반영합니다. 기존 기록을 이동·삭제하거나 다른 기준 기록을 복제하지 않습니다.
5. 목표·범위·Done When이 실행 가능하고 필요한 승인이 있으면 해당 저장소 Issue를 생성하거나 갱신하고 Project 상태를 연결합니다. 아직 탐색 단계면 Issue를 억지로 만들지 말고 planning과 열린 질문만 갱신합니다.
6. 구현까지 요청 범위에 포함되면 작은 branch/PR로 수행하고 테스트·eval·재현 절차를 남깁니다. 비밀키, 실제 민감 데이터, 승인되지 않은 유료 API·외부 배포는 추가하지 않습니다.
7. 마지막에는 Result / Validation / Decision / Human Corrections / Remaining Risks / Next 순서로 결과를 보고합니다.

## 중요한 경계

- 이 공개 Page는 위 입력을 저장하거나 GitHub로 전송하지 않았습니다. 사용자가 이 요청문을 Codex에 붙여넣은 뒤에만 작업이 시작됩니다.
- Planning Markdown은 승인된 의도, Issue는 실행 계약, PR은 제안과 증거, main은 채택된 사실, Project는 현재 실행 상태입니다.
- private GitHub 링크는 StormQlog로 로그인하지 않은 브라우저에서 404로 보일 수 있습니다. 404만으로 기록 부재를 단정하지 마세요.
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

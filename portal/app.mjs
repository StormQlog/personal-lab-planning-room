import {
  buildIssueContract,
  buildPlanningMarkdown,
  canPersistDraft,
  filterItems,
  hasDraftContent,
  normalizeDraft,
  summarizeStatuses
} from "./planner-core.mjs";
import { ISSUE_TARGETS } from "./issue-targets.mjs";

const STORAGE_KEY = "personal-lab.planning-room.draft.v1";
const localDraftPersistence = canPersistDraft(window.location.hostname);
const STATUS_LABELS = {
  Ready: "준비됨",
  Doing: "진행 중",
  Review: "검토 대기",
  Done: "완료",
  Parked: "보류"
};

const state = {
  data: null,
  filter: "All",
  draft: normalizeDraft()
};

const elements = {
  publicationBadge: document.querySelector("#publication-badge"),
  lastVerified: document.querySelector("#last-verified"),
  metrics: document.querySelector("#metrics"),
  workItems: document.querySelector("#work-items"),
  filters: document.querySelector("#status-filters"),
  emptyState: document.querySelector("#work-empty"),
  form: document.querySelector("#idea-form"),
  targetRepo: document.querySelector("#target-repo"),
  preview: document.querySelector("#markdown-preview"),
  saveState: document.querySelector("#save-state"),
  toast: document.querySelector("#toast"),
  saveButton: document.querySelector("#save-draft"),
  clearButton: document.querySelector("#clear-draft"),
  copyPlanningButton: document.querySelector("#copy-planning"),
  copyIssueButton: document.querySelector("#copy-issue"),
  downloadButton: document.querySelector("#download-planning"),
  openIssueButton: document.querySelector("#open-issue")
};

function readForm() {
  return normalizeDraft(Object.fromEntries(new FormData(elements.form)));
}

function writeForm(draft) {
  for (const [key, value] of Object.entries(normalizeDraft(draft))) {
    const field = elements.form.elements.namedItem(key);
    if (field) field.value = value;
  }
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2400);
}

function renderPublicationState() {
  const { publication, meta } = state.data;
  elements.publicationBadge.textContent = publication.approved
    ? "PUBLIC VIEW · 승인됨"
    : "LOCAL PREVIEW · 공개 승인 전";
  elements.publicationBadge.dataset.approved = String(publication.approved);
  elements.lastVerified.textContent = `마지막 확인 ${formatTimestamp(meta.lastVerified)}`;
}

function createMetric(label, value, tone) {
  const article = document.createElement("article");
  article.className = `metric metric--${tone}`;

  const count = document.createElement("strong");
  count.textContent = String(value);

  const name = document.createElement("span");
  name.textContent = label;

  article.append(count, name);
  return article;
}

function renderMetrics() {
  const summary = summarizeStatuses(state.data.items);
  elements.metrics.replaceChildren(
    createMetric("Ready", summary.Ready, "ready"),
    createMetric("Doing", summary.Doing, "doing"),
    createMetric("Review", summary.Review, "review"),
    createMetric("Done", summary.Done, "done"),
    createMetric("Parked", summary.Parked, "parked")
  );
}

function createWorkCard(item) {
  const article = document.createElement("article");
  article.className = "work-card";

  const top = document.createElement("div");
  top.className = "work-card__top";

  const id = document.createElement("span");
  id.className = "work-card__id";
  id.textContent = item.id;

  const status = document.createElement("span");
  status.className = `status status--${item.status.toLowerCase()}`;
  status.textContent = STATUS_LABELS[item.status] || item.status;
  top.append(id, status);

  const title = document.createElement("h3");
  title.textContent = item.title;

  const summary = document.createElement("p");
  summary.textContent = item.summary;

  const meta = document.createElement("div");
  meta.className = "work-card__meta";
  for (const value of [item.project, item.type, item.agentStage]) {
    const chip = document.createElement("span");
    chip.textContent = value;
    meta.append(chip);
  }

  const link = document.createElement("a");
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "기준 Issue 보기 ↗";
  link.setAttribute("aria-label", `${item.id} 기준 Issue 새 창에서 보기`);

  article.append(top, title, summary, meta, link);
  return article;
}

function renderWorkItems() {
  const visibleItems = filterItems(state.data.items, state.filter);
  elements.workItems.replaceChildren(...visibleItems.map(createWorkCard));
  elements.emptyState.hidden = visibleItems.length > 0;
}

function renderPreview() {
  state.draft = readForm();
  elements.preview.textContent = buildPlanningMarkdown(state.draft);
  if (!localDraftPersistence) {
    elements.saveState.textContent = hasDraftContent(state.draft)
      ? "공개 화면은 초안을 저장하지 않습니다. 복사하거나 .md로 내려받아 보관하세요."
      : "새 아이디어를 자유롭게 적어보세요. 공개 화면은 초안을 저장하지 않습니다.";
    return;
  }
  elements.saveState.textContent = hasDraftContent(state.draft)
    ? "로컬 미리보기에 아직 저장하지 않은 변경이 있을 수 있습니다."
    : "새 아이디어를 자유롭게 적어보세요.";
}

function renderIssueTargets() {
  const options = ISSUE_TARGETS.map((target) => {
    const option = document.createElement("option");
    option.value = target.repository;
    option.textContent = `${target.project} · ${target.repository}`;
    return option;
  });
  elements.targetRepo.append(...options);
}

function issueTargetFor(draft) {
  return ISSUE_TARGETS.find((target) => target.repository === draft.targetRepo);
}

function loadDraft() {
  if (!localDraftPersistence) return;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    state.draft = normalizeDraft(JSON.parse(saved));
    writeForm(state.draft);
    elements.saveState.textContent = "이 브라우저에 저장된 초안을 불러왔습니다.";
  } catch {
    elements.saveState.textContent = "저장된 초안을 읽지 못했습니다. 새 초안으로 시작합니다.";
  }
}

function saveDraft() {
  if (!localDraftPersistence) return;
  state.draft = readForm();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.draft));
  elements.saveState.textContent = "이 브라우저에만 저장했습니다. GitHub로 전송하지 않았습니다.";
  showToast("로컬 초안을 저장했습니다.");
}

async function copyText(value, message) {
  await navigator.clipboard.writeText(value);
  showToast(message);
}

function slugify(value) {
  const slug = String(value || "planning-candidate")
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return slug || "planning-candidate";
}

function downloadPlanning() {
  const draft = readForm();
  const blob = new Blob([buildPlanningMarkdown(draft)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(draft.title)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Markdown 파일을 만들었습니다.");
}

function bindEvents() {
  elements.form.addEventListener("submit", (event) => event.preventDefault());
  elements.form.addEventListener("input", renderPreview);
  elements.form.addEventListener("change", renderPreview);
  elements.saveButton.addEventListener("click", saveDraft);
  elements.clearButton.addEventListener("click", () => {
    const prompt = localDraftPersistence
      ? "작성 중인 내용과 로컬 미리보기에 저장된 초안을 비울까요?"
      : "작성 중인 내용을 비울까요? 저장되지 않은 내용은 복구할 수 없습니다.";
    if (!window.confirm(prompt)) return;
    if (localDraftPersistence) window.localStorage.removeItem(STORAGE_KEY);
    state.draft = normalizeDraft();
    writeForm(state.draft);
    renderPreview();
    showToast("초안을 비웠습니다.");
  });
  elements.copyPlanningButton.addEventListener("click", () =>
    copyText(buildPlanningMarkdown(readForm()), "Planning Markdown을 복사했습니다.")
  );
  elements.copyIssueButton.addEventListener("click", () =>
    copyText(buildIssueContract(readForm()), "Issue 계약을 복사했습니다.")
  );
  elements.downloadButton.addEventListener("click", downloadPlanning);
  elements.openIssueButton.addEventListener("click", async () => {
    const draft = readForm();
    const target = issueTargetFor(draft);
    if (!target) {
      elements.targetRepo.focus();
      showToast("Issue를 소유할 대상 프로젝트를 먼저 선택하세요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildIssueContract(draft));
      window.open(target.issueNewUrl, "_blank", "noopener,noreferrer");
      showToast("Issue 계약을 복사했습니다. 열린 GitHub 화면에 붙여넣으세요.");
    } catch {
      showToast("클립보드 권한이 필요합니다. Issue 계약 복사를 먼저 사용하세요.");
    }
  });
  elements.filters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    state.filter = button.dataset.status;
    for (const candidate of elements.filters.querySelectorAll("button")) {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    }
    renderWorkItems();
  });
}

async function start() {
  renderIssueTargets();
  if (!localDraftPersistence) {
    elements.saveButton.hidden = true;
  }
  loadDraft();
  renderPreview();
  if (localDraftPersistence && hasDraftContent(state.draft)) {
    elements.saveState.textContent = "이 브라우저에 저장된 초안을 불러왔습니다.";
  }
  bindEvents();

  try {
    const response = await fetch("./data/status.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Status data failed: ${response.status}`);
    state.data = await response.json();
    renderPublicationState();
    renderMetrics();
    renderWorkItems();
  } catch (error) {
    console.error(error);
    elements.publicationBadge.textContent = "STATUS SNAPSHOT · 불러오기 실패";
    elements.lastVerified.textContent = "로컬 기획 도구는 계속 사용할 수 있습니다.";
    elements.workItems.textContent = "진행상황을 불러오지 못했습니다. 기준 GitHub Project에서 확인해 주세요.";
  }
}

start();

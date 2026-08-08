import {
  buildCodexHandoff,
  filterItems,
  hasDraftContent,
  normalizeDraft,
  summarizeStatuses
} from "./planner-core.mjs";
import { ISSUE_TARGETS } from "./issue-targets.mjs";

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
  clearButton: document.querySelector("#clear-draft"),
  copyHandoffButton: document.querySelector("#copy-handoff"),
  downloadButton: document.querySelector("#download-handoff")
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

function targetFor(draft) {
  return ISSUE_TARGETS.find((target) => target.repository === draft.targetRepo);
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
  link.textContent = "Private Issue · 로그인 필요 ↗";
  link.setAttribute("aria-label", `${item.id} private Issue를 로그인한 새 창에서 보기`);

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
  elements.preview.textContent = buildCodexHandoff(state.draft, targetFor(state.draft));
  elements.saveState.textContent = hasDraftContent(state.draft)
    ? "이 페이지에는 저장되지 않습니다. 요청문을 복사해 현재 Codex 작업에 붙여넣으세요."
    : "아이디어를 입력한 뒤 Codex 작업 요청 하나로 넘기세요. 이 페이지에는 저장되지 않습니다.";
}

function renderTargets() {
  const options = ISSUE_TARGETS.map((target) => {
    const option = document.createElement("option");
    option.value = target.repository;
    option.textContent = `${target.project} · ${target.repository}`;
    return option;
  });
  elements.targetRepo.append(...options);
}

async function copyText(value, message) {
  let copied = false;

  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable.");
    await navigator.clipboard.writeText(value);
    copied = true;
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = value;
    fallback.readOnly = true;
    fallback.className = "clipboard-fallback";
    document.body.append(fallback);
    fallback.select();
    copied = document.execCommand("copy");
    fallback.remove();
  }

  showToast(copied ? message : "클립보드 복사가 차단됐습니다. 미리보기에서 직접 복사하세요.");
  return copied;
}

function slugify(value) {
  const slug = String(value || "codex-work-request")
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return slug || "codex-work-request";
}

function requireTarget() {
  const draft = readForm();
  const target = targetFor(draft);
  if (target) return { draft, target };
  elements.targetRepo.focus();
  showToast("작업을 소유할 대상 프로젝트를 먼저 선택하세요.");
  return null;
}

function downloadHandoff() {
  const selection = requireTarget();
  if (!selection) return;
  const blob = new Blob(
    [buildCodexHandoff(selection.draft, selection.target)],
    { type: "text/markdown;charset=utf-8" }
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(selection.draft.title)}-codex-request.md`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Codex 작업 요청 Markdown을 만들었습니다.");
}

function bindEvents() {
  elements.form.addEventListener("submit", (event) => event.preventDefault());
  elements.form.addEventListener("input", renderPreview);
  elements.form.addEventListener("change", renderPreview);
  elements.clearButton.addEventListener("click", () => {
    if (!window.confirm("작성 중인 내용을 비울까요? 저장되지 않은 내용은 복구할 수 없습니다.")) return;
    state.draft = normalizeDraft();
    writeForm(state.draft);
    renderPreview();
    showToast("입력 내용을 비웠습니다.");
  });
  elements.copyHandoffButton.addEventListener("click", async () => {
    const selection = requireTarget();
    if (!selection) return;
    await copyText(
      buildCodexHandoff(selection.draft, selection.target),
      "Codex 작업 요청을 복사했습니다. 현재 Codex 작업에 붙여넣으세요."
    );
  });
  elements.downloadButton.addEventListener("click", downloadHandoff);
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
  renderTargets();
  renderPreview();
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
    elements.lastVerified.textContent = "Codex 작업 요청 생성은 계속 사용할 수 있습니다.";
    elements.workItems.textContent = "진행상황을 불러오지 못했습니다. 로그인한 GitHub Project에서 확인해 주세요.";
  }
}

start();

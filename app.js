const platforms = [
  { id: "wechat", name: "微信公众号", short: "微", limit: 20000, color: "#16a34a", tone: "正式、完整，适合长内容" },
  { id: "weibo", name: "微博", short: "博", limit: 2000, color: "#dc2626", tone: "轻快、热点感强" },
  { id: "xiaohongshu", name: "小红书", short: "红", limit: 1000, color: "#e11d48", tone: "种草、有标题感" },
  { id: "douyin", name: "抖音", short: "抖", limit: 2200, color: "#111827", tone: "短句、强钩子" },
  { id: "bilibili", name: "B站动态", short: "B", limit: 2000, color: "#0284c7", tone: "社区感、解释清楚" },
  { id: "zhihu", name: "知乎", short: "知", limit: 5000, color: "#1772f6", tone: "观点清晰、论证充分" },
  { id: "linkedin", name: "LinkedIn", short: "in", limit: 3000, color: "#0a66c2", tone: "专业、业务价值" },
  { id: "x", name: "X / Twitter", short: "X", limit: 280, color: "#18181b", tone: "极简、观点明确" },
  { id: "facebook", name: "Facebook", short: "f", limit: 63206, color: "#2563eb", tone: "亲和、适合互动" },
];

const state = {
  selected: new Set(platforms.map((platform) => platform.id)),
  activeVariant: "wechat",
  accounts: {},
  media: [],
  publishing: false,
  variants: {},
  tasks: [],
  lastResults: [],
};

const elements = {
  platformList: document.querySelector("#platformList"),
  connectionList: document.querySelector("#connectionList"),
  queueList: document.querySelector("#queueList"),
  selectAllButton: document.querySelector("#selectAllButton"),
  postTitle: document.querySelector("#postTitle"),
  postBody: document.querySelector("#postBody"),
  hashtags: document.querySelector("#hashtags"),
  publishMode: document.querySelector("#publishMode"),
  scheduleRow: document.querySelector("#scheduleRow"),
  scheduleDate: document.querySelector("#scheduleDate"),
  scheduleTime: document.querySelector("#scheduleTime"),
  charCounter: document.querySelector("#charCounter"),
  limitHint: document.querySelector("#limitHint"),
  mediaInput: document.querySelector("#mediaInput"),
  uploadZone: document.querySelector("#uploadZone"),
  mediaGrid: document.querySelector("#mediaGrid"),
  previewAvatar: document.querySelector("#previewAvatar"),
  previewPlatform: document.querySelector("#previewPlatform"),
  previewTitle: document.querySelector("#previewTitle"),
  previewBody: document.querySelector("#previewBody"),
  previewTags: document.querySelector("#previewTags"),
  previewMedia: document.querySelector("#previewMedia"),
  publishButton: document.querySelector("#publishButton"),
  saveDraftButton: document.querySelector("#saveDraftButton"),
  createTaskButton: document.querySelector("#createTaskButton"),
  syncVariantsButton: document.querySelector("#syncVariantsButton"),
  queueStatus: document.querySelector("#queueStatus"),
  variantTabs: document.querySelector("#variantTabs"),
  variantCard: document.querySelector("#variantCard"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarStatus: document.querySelector("#calendarStatus"),
  taskList: document.querySelector("#taskList"),
  clearTasksButton: document.querySelector("#clearTasksButton"),
  metricGrid: document.querySelector("#metricGrid"),
  insightList: document.querySelector("#insightList"),
  toast: document.querySelector("#toast"),
};

function isConnected(platformId) {
  return Boolean(state.accounts[platformId]?.connected);
}

function defaultVariant() {
  return { title: "", body: "", tags: "", enabled: true };
}

function ensureVariants() {
  platforms.forEach((platform) => {
    if (!state.variants[platform.id]) state.variants[platform.id] = defaultVariant();
  });
}

function getVariant(platform) {
  ensureVariants();
  return state.variants[platform.id];
}

function getPayload(platform) {
  const variant = getVariant(platform);
  return {
    title: variant.title.trim() || elements.postTitle.value.trim(),
    body: variant.body.trim() || elements.postBody.value.trim(),
    tags: normalizeTags(variant.tags.trim() || elements.hashtags.value.trim()),
  };
}

function selectedPlatforms() {
  return platforms.filter((platform) => state.selected.has(platform.id));
}

function renderPlatforms() {
  elements.platformList.innerHTML = platforms
    .map((platform) => {
      const checked = state.selected.has(platform.id) ? "checked" : "";
      return `
        <label class="platform-item" for="platform-${platform.id}">
          <span class="platform-name">
            <span class="platform-logo" style="background:${platform.color}">${platform.short}</span>
            <span class="platform-text">
              <strong>${platform.name}</strong>
              <span>最多 ${platform.limit.toLocaleString("zh-CN")} 字</span>
            </span>
          </span>
          <span class="switch">
            <input id="platform-${platform.id}" type="checkbox" data-platform="${platform.id}" ${checked} />
            <span class="slider"></span>
          </span>
        </label>
      `;
    })
    .join("");
}

function renderConnections() {
  elements.connectionList.innerHTML = platforms
    .map((platform) => {
      const account = state.accounts[platform.id] || {};
      const connected = Boolean(account.connected);
      const expires = account.expiresAt ? `有效至 ${formatDateTime(account.expiresAt)}` : "未绑定账号";
      return `
        <div class="connection-item">
          <div>
            <strong>${platform.name}</strong>
            <span>${connected ? account.accountName || "已绑定账号" : "点击授权后可发布"}</span>
            <span>${expires}</span>
          </div>
          <div class="connection-actions">
            <span class="badge ${connected ? "connected" : "pending"}">${connected ? "已连接" : "待授权"}</span>
            <button class="mini-button" type="button" data-account-action="${connected ? "disconnect" : "connect"}" data-platform="${platform.id}">
              ${connected ? "断开" : "授权"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderVariantTabs() {
  const selected = selectedPlatforms();
  if (!selected.some((platform) => platform.id === state.activeVariant)) {
    state.activeVariant = selected[0]?.id || platforms[0].id;
  }

  elements.variantTabs.innerHTML = selected
    .map((platform) => {
      const payload = getPayload(platform);
      const overLimit = payload.body.length > platform.limit;
      const active = platform.id === state.activeVariant ? "active" : "";
      return `
        <button class="variant-tab ${active}" type="button" data-variant="${platform.id}" style="--platform-color:${platform.color}">
          <span>${platform.short}</span>
          <strong>${platform.name}</strong>
          ${overLimit ? '<em class="dot error"></em>' : '<em class="dot"></em>'}
        </button>
      `;
    })
    .join("");

  renderVariantCard();
}

function renderVariantCard() {
  const platform = platforms.find((item) => item.id === state.activeVariant) || selectedPlatforms()[0] || platforms[0];
  const variant = getVariant(platform);
  const payload = getPayload(platform);
  const remaining = platform.limit - payload.body.length;
  const remainingClass = remaining < 0 ? "danger-text" : remaining < 80 ? "warning-text" : "";

  elements.variantCard.innerHTML = `
    <div class="variant-card-head">
      <div>
        <h4>${platform.name}</h4>
        <p>${platform.tone}</p>
      </div>
      <span class="status-pill ${remaining < 0 ? "error-pill" : ""}" id="variantRemaining">${remaining.toLocaleString("zh-CN")} 字剩余</span>
    </div>
    <div class="field">
      <label for="variantTitle">平台标题</label>
      <input id="variantTitle" type="text" maxlength="140" value="${escapeAttribute(variant.title)}" placeholder="不填则使用主标题" />
    </div>
    <div class="field">
      <label for="variantBody">平台正文</label>
      <textarea id="variantBody" rows="7" placeholder="不填则使用主正文">${escapeHtml(variant.body)}</textarea>
      <div class="field-meta">
        <span class="${remainingClass}" id="variantCounter">${payload.body.length.toLocaleString("zh-CN")} / ${platform.limit.toLocaleString("zh-CN")} 字</span>
        <span>${isConnected(platform.id) ? "账号已连接" : "发布前需要授权"}</span>
      </div>
    </div>
    <div class="field">
      <label for="variantTags">平台话题标签</label>
      <input id="variantTags" type="text" value="${escapeAttribute(variant.tags)}" placeholder="不填则使用通用标签" />
    </div>
  `;

  document.querySelector("#variantTitle").addEventListener("input", (event) => {
    variant.title = event.target.value;
    refreshVariantPreview(platform);
  });
  document.querySelector("#variantBody").addEventListener("input", (event) => {
    variant.body = event.target.value;
    refreshVariantPreview(platform);
  });
  document.querySelector("#variantTags").addEventListener("input", (event) => {
    variant.tags = event.target.value;
    refreshVariantPreview(platform);
  });
}

function refreshVariantPreview(platform) {
  updateVariantCardMeta(platform);
  updatePreview();
  renderQueue();
}

function updateVariantCardMeta(platform) {
  const payload = getPayload(platform);
  const remaining = platform.limit - payload.body.length;
  const remainingNode = document.querySelector("#variantRemaining");
  const counterNode = document.querySelector("#variantCounter");
  const activeDot = document.querySelector(`.variant-tab[data-variant="${platform.id}"] .dot`);

  if (remainingNode) {
    remainingNode.textContent = `${remaining.toLocaleString("zh-CN")} 字剩余`;
    remainingNode.classList.toggle("error-pill", remaining < 0);
  }

  if (counterNode) {
    counterNode.textContent = `${payload.body.length.toLocaleString("zh-CN")} / ${platform.limit.toLocaleString("zh-CN")} 字`;
    counterNode.classList.toggle("danger-text", remaining < 0);
    counterNode.classList.toggle("warning-text", remaining >= 0 && remaining < 80);
  }

  if (activeDot) activeDot.classList.toggle("error", remaining < 0);
}

function renderQueue() {
  const rows = selectedPlatforms().map((platform) => {
    const payload = getPayload(platform);
    const connected = isConnected(platform.id);
    const overLimit = payload.body.length > platform.limit;
    const badge = overLimit
      ? '<span class="badge error">超出限制</span>'
      : connected
        ? '<span class="badge connected">就绪</span>'
        : '<span class="badge pending">需授权</span>';

    return `
      <div class="queue-item" data-queue="${platform.id}">
        <div class="queue-name">
          <span class="platform-logo" style="background:${platform.color}">${platform.short}</span>
          <div>
            <strong>${platform.name}</strong>
            <span>${payload.body.length.toLocaleString("zh-CN")} / ${platform.limit.toLocaleString("zh-CN")} 字</span>
          </div>
        </div>
        ${badge}
      </div>
    `;
  });

  elements.queueList.innerHTML = rows.length ? rows.join("") : '<div class="queue-item">还没有选择平台</div>';
  elements.queueStatus.textContent = state.publishing ? "发布中" : `${rows.length} 个平台`;
}

function updateTextMeta() {
  const bodyLength = elements.postBody.value.length;
  const limits = selectedPlatforms().map((platform) => platform.limit);
  const minLimit = limits.length ? Math.min(...limits) : 0;
  elements.charCounter.textContent = `${bodyLength.toLocaleString("zh-CN")} 字`;
  elements.limitHint.textContent = minLimit
    ? `当前最严格限制：${minLimit.toLocaleString("zh-CN")} 字`
    : "请选择平台查看限制";
}

function updatePreview() {
  const platform = platforms.find((item) => item.id === state.activeVariant) || selectedPlatforms()[0];
  const payload = platform ? getPayload(platform) : {
    title: elements.postTitle.value.trim(),
    body: elements.postBody.value.trim(),
    tags: normalizeTags(elements.hashtags.value),
  };

  elements.previewAvatar.textContent = platform?.short || "社";
  elements.previewAvatar.style.background = platform?.color || "#0f766e";
  elements.previewTitle.textContent = payload.title || "你的标题会显示在这里";
  elements.previewBody.textContent = payload.body || "正文预览会随着输入实时更新。";
  elements.previewTags.textContent = payload.tags;
  elements.previewPlatform.textContent = platform ? `${platform.name} 预览` : "未选择平台";

  if (state.media[0]) {
    const first = state.media[0];
    elements.previewMedia.innerHTML = first.type.startsWith("video/")
      ? `<video src="${first.url}" controls muted></video>`
      : `<img src="${first.url}" alt="${escapeAttribute(first.name)}" />`;
  } else {
    elements.previewMedia.textContent = "媒体预览";
  }
}

function renderCalendar() {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });

  elements.calendarStatus.textContent = `${state.tasks.length} 个任务`;
  elements.calendarGrid.innerHTML = days
    .map((day) => {
      const key = formatDateKey(day);
      const dayTasks = state.tasks.filter((task) => task.date === key);
      return `
        <div class="calendar-day">
          <div class="calendar-date">
            <strong>${day.toLocaleDateString("zh-CN", { weekday: "short" })}</strong>
            <span>${day.getMonth() + 1}/${day.getDate()}</span>
          </div>
          <div class="calendar-slots">
            ${
              dayTasks.length
                ? dayTasks.map((task) => `<div class="calendar-task"><strong>${escapeHtml(task.title || "未命名发布")}</strong><span>${task.time} · ${task.platforms.length} 平台 · ${statusText(task.status)}</span></div>`).join("")
                : '<span class="empty-slot">暂无任务</span>'
            }
          </div>
        </div>
      `;
    })
    .join("");

  elements.taskList.innerHTML = state.tasks.length
    ? state.tasks
        .map((task) => `
          <div class="task-item">
            <div>
              <strong>${escapeHtml(task.title || "未命名发布")}</strong>
              <span>${task.date} ${task.time} · ${task.platforms.map((item) => item.name || item).join("、")}</span>
            </div>
            <span class="badge ${task.status === "published" ? "connected" : "pending"}">${statusText(task.status)}</span>
          </div>
        `)
        .join("")
    : '<div class="task-item">还没有任务。点击“加入日历”创建一个排程。</div>';
}

function renderAnalytics() {
  const published = state.tasks.filter((task) => task.status === "published").length;
  const scheduled = state.tasks.filter((task) => task.status !== "published").length;
  const connectedCount = platforms.filter((platform) => isConnected(platform.id)).length;
  const readyRate = Math.round((connectedCount / platforms.length) * 100);

  const metrics = [
    { label: "已发布任务", value: published },
    { label: "待处理任务", value: scheduled },
    { label: "已连接账号", value: `${connectedCount}/${platforms.length}` },
    { label: "发布就绪率", value: `${readyRate}%` },
  ];

  elements.metricGrid.innerHTML = metrics
    .map((metric) => `
      <div class="metric-card">
        <span>${metric.label}</span>
        <strong>${metric.value}</strong>
      </div>
    `)
    .join("");

  elements.insightList.innerHTML = platforms
    .map((platform, index) => {
      const connected = isConnected(platform.id);
      const seed = state.tasks.length + index + 1;
      const views = connected ? 1800 + seed * 430 : 0;
      const engagement = connected ? `${(2.4 + index * 0.35).toFixed(1)}%` : "待授权";
      return `
        <div class="insight-item">
          <div class="queue-name">
            <span class="platform-logo" style="background:${platform.color}">${platform.short}</span>
            <div>
              <strong>${platform.name}</strong>
              <span>${connected ? `${views.toLocaleString("zh-CN")} 曝光 · 互动率 ${engagement}` : "连接账号后回收数据"}</span>
            </div>
          </div>
          <span class="badge ${connected ? "connected" : "pending"}">${connected ? "可统计" : "待授权"}</span>
        </div>
      `;
    })
    .join("");
}

function buildTaskPayload() {
  const now = new Date();
  const date = elements.publishMode.value === "schedule" ? elements.scheduleDate.value : formatDateKey(now);
  const time = elements.publishMode.value === "schedule" ? elements.scheduleTime.value : now.toTimeString().slice(0, 5);
  const selected = selectedPlatforms();
  return {
    title: elements.postTitle.value.trim() || selected.map((platform) => getPayload(platform).title).find(Boolean) || "未命名发布",
    date,
    time,
    platforms: selected.map((platform) => ({ id: platform.id, name: platform.name })),
    variants: selected.map((platform) => ({
      platformId: platform.id,
      platformName: platform.name,
      ...getPayload(platform),
    })),
  };
}

function validatePost() {
  if (!state.selected.size) return "请至少选择一个平台。";

  const missingBody = selectedPlatforms().find((platform) => !getPayload(platform).body);
  if (missingBody) return `请先填写 ${missingBody.name} 的正文或主正文。`;

  const overLimit = selectedPlatforms().find((platform) => getPayload(platform).body.length > platform.limit);
  if (overLimit) return `${overLimit.name} 超出 ${overLimit.limit} 字限制。`;

  if (elements.publishMode.value === "schedule") {
    if (!elements.scheduleDate.value || !elements.scheduleTime.value) return "请选择定时发布的日期和时间。";
    const scheduledAt = new Date(`${elements.scheduleDate.value}T${elements.scheduleTime.value}`);
    if (scheduledAt.getTime() < Date.now()) return "定时发布时间不能早于当前时间。";
  }

  return "";
}

function refresh() {
  updateTextMeta();
  renderVariantTabs();
  updatePreview();
  renderQueue();
  renderCalendar();
  renderAnalytics();
}

async function publishAll() {
  const error = validatePost();
  if (error) {
    showToast(error);
    return;
  }

  state.publishing = true;
  elements.publishButton.disabled = true;
  elements.publishButton.textContent = "发布中...";
  elements.queueStatus.textContent = "发布中";

  selectedPlatforms().forEach((platform) => {
    const row = document.querySelector(`[data-queue="${platform.id}"] .badge`);
    if (row) {
      row.className = "badge pending";
      row.textContent = "发送中";
    }
  });

  try {
    const { task } = await api("/api/publish", { method: "POST", body: buildTaskPayload() });
    state.lastResults = task.results || [];
    await loadTasks();

    task.results.forEach((result) => {
      const row = document.querySelector(`[data-queue="${result.platformId}"] .badge`);
      if (row) {
        row.className = result.status === "published" ? "badge connected" : "badge pending";
        row.textContent = result.status === "published" ? "已发布" : "待授权";
      }
    });

    elements.queueStatus.textContent = statusText(task.status);
    showToast("后端发布任务已创建，发布结果已写入任务系统。");
  } catch (error) {
    showToast(`发布失败：${error.message}`);
  } finally {
    state.publishing = false;
    elements.publishButton.disabled = false;
    elements.publishButton.textContent = "一键发布";
    renderCalendar();
    renderAnalytics();
  }
}

async function createScheduledTask() {
  const error = validatePost();
  if (error) {
    showToast(error);
    return;
  }

  try {
    const { task } = await api("/api/tasks", { method: "POST", body: buildTaskPayload() });
    state.tasks.unshift(task);
    renderCalendar();
    renderAnalytics();
    showToast("已写入后端发布日历。");
  } catch (error) {
    showToast(`创建任务失败：${error.message}`);
  }
}

async function clearTasks() {
  try {
    const { tasks } = await api("/api/tasks", { method: "DELETE" });
    state.tasks = tasks;
    renderCalendar();
    renderAnalytics();
    showToast("后端任务记录已清空。");
  } catch (error) {
    showToast(`清空失败：${error.message}`);
  }
}

async function updateAccount(platformId, action) {
  const label = action === "connect" ? "授权" : "断开";
  try {
    const { account } = await api(`/api/accounts/${platformId}/${action}`, { method: "POST" });
    state.accounts[platformId] = account;
    renderConnections();
    renderVariantCard();
    renderQueue();
    renderAnalytics();
    showToast(`${platformName(platformId)} 已${label}。`);
  } catch (error) {
    showToast(`${label}失败：${error.message}`);
  }
}

async function loadBackendState() {
  try {
    const [{ accounts }, { tasks }] = await Promise.all([
      api("/api/accounts"),
      api("/api/tasks"),
    ]);
    state.accounts = accounts || {};
    state.tasks = tasks || [];
  } catch (error) {
    showToast(`后端连接失败：${error.message}`);
  }
}

function saveDraft() {
  const draft = {
    title: elements.postTitle.value,
    body: elements.postBody.value,
    hashtags: elements.hashtags.value,
    selected: [...state.selected],
    activeVariant: state.activeVariant,
    variants: state.variants,
    publishMode: elements.publishMode.value,
    scheduleDate: elements.scheduleDate.value,
    scheduleTime: elements.scheduleTime.value,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem("socialPublisherDraft", JSON.stringify(draft));
  showToast("草稿已保存到本地浏览器。");
}

function loadDraft() {
  const raw = localStorage.getItem("socialPublisherDraft");
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    elements.postTitle.value = draft.title || "";
    elements.postBody.value = draft.body || "";
    elements.hashtags.value = draft.hashtags || "";
    elements.publishMode.value = draft.publishMode || "now";
    elements.scheduleDate.value = draft.scheduleDate || "";
    elements.scheduleTime.value = draft.scheduleTime || "";
    state.selected = new Set(draft.selected || platforms.map((platform) => platform.id));
    state.activeVariant = draft.activeVariant || "wechat";
    state.variants = draft.variants || {};
    elements.scheduleRow.hidden = elements.publishMode.value !== "schedule";
  } catch {
    localStorage.removeItem("socialPublisherDraft");
  }
}

function bindEvents() {
  elements.platformList.addEventListener("change", (event) => {
    const id = event.target.dataset.platform;
    if (!id) return;
    if (event.target.checked) state.selected.add(id);
    else state.selected.delete(id);
    refresh();
  });

  elements.connectionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-account-action]");
    if (!button) return;
    updateAccount(button.dataset.platform, button.dataset.accountAction);
  });

  elements.selectAllButton.addEventListener("click", () => {
    const allSelected = state.selected.size === platforms.length;
    state.selected = new Set(allSelected ? [] : platforms.map((platform) => platform.id));
    renderPlatforms();
    refresh();
  });

  elements.variantTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-variant]");
    if (!button) return;
    state.activeVariant = button.dataset.variant;
    refresh();
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.view}View`).classList.add("active");
    });
  });

  [elements.postTitle, elements.postBody, elements.hashtags].forEach((input) => {
    input.addEventListener("input", refresh);
  });

  elements.publishMode.addEventListener("change", () => {
    elements.scheduleRow.hidden = elements.publishMode.value !== "schedule";
  });

  elements.syncVariantsButton.addEventListener("click", () => {
    selectedPlatforms().forEach((platform) => {
      const variant = getVariant(platform);
      variant.title = elements.postTitle.value;
      variant.body = tailorBodyForPlatform(platform, elements.postBody.value);
      variant.tags = elements.hashtags.value;
    });
    refresh();
    showToast("已按平台风格同步主文案。");
  });

  elements.mediaInput.addEventListener("change", (event) => {
    const files = [...event.target.files].slice(0, 8);
    state.media.forEach((file) => URL.revokeObjectURL(file.url));
    state.media = files.map((file) => ({
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    }));
    renderMedia();
    updatePreview();
  });

  elements.uploadZone.addEventListener("dragover", (event) => event.preventDefault());
  elements.uploadZone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.mediaInput.files = event.dataTransfer.files;
    elements.mediaInput.dispatchEvent(new Event("change"));
  });

  elements.publishButton.addEventListener("click", publishAll);
  elements.saveDraftButton.addEventListener("click", saveDraft);
  elements.createTaskButton.addEventListener("click", createScheduledTask);
  elements.clearTasksButton.addEventListener("click", clearTasks);
}

async function loadTasks() {
  const { tasks } = await api("/api/tasks");
  state.tasks = tasks || [];
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || payload.error || "请求失败");
  return payload;
}

function normalizeTags(value) {
  return value
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .join(" ");
}

function renderMedia() {
  elements.mediaGrid.innerHTML = state.media
    .map((file, index) => {
      const preview = file.type.startsWith("video/")
        ? `<video src="${file.url}" muted></video>`
        : `<img src="${file.url}" alt="${escapeAttribute(file.name)}" />`;
      return `<div class="media-thumb" title="${escapeAttribute(file.name)}" data-media="${index}">${preview}</div>`;
    })
    .join("");
}

function tailorBodyForPlatform(platform, body) {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (platform.id === "x" && trimmed.length > 240) return `${trimmed.slice(0, 236)}...`;
  if (platform.id === "xiaohongshu") return `${trimmed}\n\n适合收藏，也欢迎评论交流。`;
  if (platform.id === "zhihu") return `${trimmed}\n\n我的看法是：这类工具真正的价值，不只是减少重复发布，而是让内容生产、审核、分发和复盘形成闭环。`;
  if (platform.id === "linkedin") return `${trimmed}\n\n这背后的重点是效率、协作和可衡量的增长。`;
  if (platform.id === "douyin") return `先说结论：${trimmed}`;
  return trimmed;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function statusText(status) {
  const map = {
    scheduled: "待发布",
    publishing: "发布中",
    published: "已发布",
    partial: "部分完成",
    failed: "失败",
  };
  return map[status] || status || "待发布";
}

function platformName(platformId) {
  return platforms.find((platform) => platform.id === platformId)?.name || platformId;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  return new Date(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function init() {
  ensureVariants();
  loadDraft();
  ensureVariants();
  bindEvents();
  await loadBackendState();
  renderPlatforms();
  renderConnections();
  refresh();
}

init();

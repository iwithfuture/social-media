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
  links: [],
  publishing: false,
  variants: {},
  packages: {},
  packageStatus: {},
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
  mediaNoteList: document.querySelector("#mediaNoteList"),
  addLinkButton: document.querySelector("#addLinkButton"),
  linkList: document.querySelector("#linkList"),
  previewAvatar: document.querySelector("#previewAvatar"),
  previewPlatform: document.querySelector("#previewPlatform"),
  previewTitle: document.querySelector("#previewTitle"),
  previewBody: document.querySelector("#previewBody"),
  previewTags: document.querySelector("#previewTags"),
  previewMedia: document.querySelector("#previewMedia"),
  publishButton: document.querySelector("#publishButton"),
  saveDraftButton: document.querySelector("#saveDraftButton"),
  createTaskButton: document.querySelector("#createTaskButton"),
  generatePackagesButton: document.querySelector("#generatePackagesButton"),
  syncVariantsButton: document.querySelector("#syncVariantsButton"),
  queueStatus: document.querySelector("#queueStatus"),
  variantTabs: document.querySelector("#variantTabs"),
  variantCard: document.querySelector("#variantCard"),
  packageGrid: document.querySelector("#packageGrid"),
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

function renderPublishPackages() {
  if (!elements.packageGrid) return;
  const packages = getPublishPackages();
  elements.packageGrid.innerHTML = packages
    .map((item) => {
      const done = state.packageStatus[item.id] === "published";
      return `
        <article class="publish-package" style="--package-color:${item.color}">
          <div class="package-head">
            <div class="platform-logo">${item.short}</div>
            <div>
              <h3>${item.name}</h3>
              <p>${item.positioning}</p>
            </div>
            <span class="badge ${done ? "connected" : "pending"}">${done ? "已发布" : "待发布"}</span>
          </div>

          <div class="package-section">
            <div class="package-label">
              <strong>标题</strong>
              <button class="mini-button" type="button" data-copy-package="${item.id}" data-copy-field="title">复制</button>
            </div>
            <p class="package-copy">${escapeHtml(item.title)}</p>
          </div>

          ${item.summary ? `
            <div class="package-section">
              <div class="package-label">
                <strong>摘要</strong>
                <button class="mini-button" type="button" data-copy-package="${item.id}" data-copy-field="summary">复制</button>
              </div>
              <p class="package-copy">${escapeHtml(item.summary)}</p>
            </div>
          ` : ""}

          <div class="package-section">
            <div class="package-label">
              <strong>正文</strong>
              <button class="mini-button" type="button" data-copy-package="${item.id}" data-copy-field="body">复制</button>
            </div>
            <pre class="package-body">${escapeHtml(item.body)}</pre>
          </div>

          <div class="package-section">
            <div class="package-label">
              <strong>标签 / 关键词</strong>
              <button class="mini-button" type="button" data-copy-package="${item.id}" data-copy-field="tags">复制</button>
            </div>
            <p class="package-tags">${escapeHtml(item.tags)}</p>
          </div>

          ${item.mediaNotes?.length ? `
            <div class="package-section">
              <div class="package-label">
                <strong>图片说明</strong>
              </div>
              <p class="package-copy">${escapeHtml(item.mediaNotes.map((note, index) => `图 ${index + 1}：${note}`).join("\n"))}</p>
            </div>
          ` : ""}

          ${item.links?.length ? `
            <div class="package-section">
              <div class="package-label">
                <strong>链接</strong>
              </div>
              <p class="package-copy">${escapeHtml(formatLinksForBody(item.links))}</p>
            </div>
          ` : ""}

          <div class="package-tips">
            ${item.tips.map((tip) => `<span>${escapeHtml(tip)}</span>`).join("")}
          </div>

          <div class="package-actions">
            <button class="secondary-button slim" type="button" data-copy-package="${item.id}" data-copy-field="all">复制整包</button>
            <button class="secondary-button slim" type="button" data-open-package="${item.id}">打开发布页</button>
            <button class="primary-button slim" type="button" data-mark-package="${item.id}">${done ? "取消标记" : "标记已发布"}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function getPublishPackages() {
  const title = elements.postTitle.value.trim() || "这篇内容可以这样发布";
  const body = elements.postBody.value.trim() || "先在内容编辑里写下主文章，工具会在这里生成小红书、知乎和公众号版本。";
  const tags = normalizeTags(elements.hashtags.value) || "#内容创作 #社媒运营";
  const paragraphs = splitParagraphs(body);
  const keyPoints = extractKeyPoints(body);
  const mediaNotes = getMediaNotes();
  const links = getValidLinks();
  return [
    buildXhsPackage(title, paragraphs, keyPoints, tags, mediaNotes, links),
    buildZhihuPackage(title, paragraphs, keyPoints, tags, mediaNotes, links),
    buildWechatPackage(title, paragraphs, keyPoints, tags, mediaNotes, links),
  ];
}

function buildXhsPackage(title, paragraphs, keyPoints, tags, mediaNotes, links) {
  const hook = makeShortTitle(title, 20);
  const bullets = keyPoints.slice(0, 5).map((point, index) => `${index + 1}. ${point}`).join("\n");
  const body = [
    `先说结论：${paragraphs[0] || title}`,
    "",
    bullets || paragraphs.slice(0, 4).map((item, index) => `${index + 1}. ${item}`).join("\n"),
    "",
    mediaNotes.length ? `配图建议：\n${mediaNotes.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : "适合收藏，发布前可以配 3-6 张图：封面图、步骤图、结果图、对比图。",
    links.length ? `\n补充链接：${links.map((link) => link.title).join(" / ")}。小红书正文不适合放长链接，建议放在评论区或主页。` : "",
    "",
    "你会更想看哪一部分？评论区告诉我。"
  ].filter(Boolean).join("\n");
  return {
    id: "xiaohongshu",
    name: "小红书",
    short: "红",
    color: "#e11d48",
    positioning: "短标题、强钩子、分点、标签更重要",
    title: `${hook}｜建议收藏`,
    body,
    tags: mergeTags(tags, ["#小红书运营", "#内容创作", "#干货分享"]),
    links,
    mediaNotes,
    tips: ["封面标题控制在 12 字内", "正文前 3 行要给结论", "标签保留 5-8 个"],
    url: "https://creator.xiaohongshu.com/publish/publish"
  };
}

function buildZhihuPackage(title, paragraphs, keyPoints, tags, mediaNotes, links) {
  const lead = paragraphs[0] || title;
  const body = [
    `我会从三个角度回答这个问题。`,
    "",
    `## 背景`,
    lead,
    "",
    `## 核心观点`,
    keyPoints.slice(0, 4).map((point, index) => `${index + 1}. ${point}`).join("\n") || paragraphs.slice(0, 4).join("\n\n"),
    "",
    `## 为什么这件事值得做`,
    "真正麻烦的地方往往不是发布按钮，而是同一份内容在不同平台要换表达方式、结构和读者预期。",
    links.length ? `\n## 参考链接\n${formatLinksForBody(links)}` : "",
    mediaNotes.length ? `\n## 配图说明\n${mediaNotes.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : "",
    "",
    `## 结论`,
    "我的建议是先把主内容写完整，再按平台生成不同版本，最后人工确认发布。这样既稳，也能明显减少重复劳动。"
  ].filter(Boolean).join("\n");
  return {
    id: "zhihu",
    name: "知乎",
    short: "知",
    color: "#1772f6",
    positioning: "观点清晰、解释充分、减少营销感",
    title: title.endsWith("？") ? title : `${title}，我的实际看法是什么？`,
    body,
    tags: mergeTags(tags, ["内容创作", "新媒体运营", "效率工具"]).replaceAll("#", ""),
    links,
    mediaNotes,
    tips: ["适合发文章或回答", "标题可以问题化", "正文保留论证和反例"],
    url: "https://www.zhihu.com/creator"
  };
}

function buildWechatPackage(title, paragraphs, keyPoints, tags, mediaNotes, links) {
  const summary = makeSummary(paragraphs);
  const body = [
    `# ${title}`,
    "",
    summary,
    "",
    `## 一、为什么要做这件事`,
    paragraphs[0] || "很多内容工作不是难在创作，而是难在多平台重复改写。",
    "",
    `## 二、可以怎么处理`,
    keyPoints.slice(0, 5).map((point, index) => `${index + 1}. ${point}`).join("\n") || paragraphs.slice(0, 5).join("\n\n"),
    "",
    `## 三、发布前检查`,
    "- 标题是否清楚\n- 摘要是否完整\n- 封面图是否匹配主题\n- 正文是否适合公众号阅读\n- 结尾是否有下一步行动",
    mediaNotes.length ? `\n## 配图位置建议\n${mediaNotes.map((item, index) => `- 图 ${index + 1}：${item}`).join("\n")}` : "",
    links.length ? `\n## 延伸阅读\n${formatLinksForBody(links)}` : "",
    "",
    `## 结尾`,
    "如果这篇内容对你有帮助，可以收藏备用。后续我会继续把流程拆得更细。"
  ].filter(Boolean).join("\n");
  return {
    id: "wechat",
    name: "微信公众号",
    short: "微",
    color: "#16a34a",
    positioning: "长文结构、摘要、标题和封面更重要",
    title,
    summary,
    body,
    tags: mergeTags(tags, ["#公众号", "#新媒体", "#内容运营"]),
    links,
    mediaNotes,
    tips: ["可复制 Markdown 到编辑器", "封面建议 2.35:1", "摘要控制在 120 字以内"],
    url: "https://mp.weixin.qq.com/"
  };
}

function splitParagraphs(value) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractKeyPoints(value) {
  const lines = value
    .split(/\n+/)
    .map((item) => item.replace(/^[-*#\d.、\s]+/, "").trim())
    .filter((item) => item.length >= 8);
  return lines.length ? lines : splitSentences(value).slice(0, 5);
}

function splitSentences(value) {
  return value
    .split(/[。！？!?；;]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);
}

function makeShortTitle(value, maxLength) {
  const clean = value.replace(/[，。！？!?、]/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function makeSummary(paragraphs) {
  const source = paragraphs.join(" ").trim();
  if (!source) return "这篇文章整理了一个更省力的多平台发布流程。";
  return source.length > 118 ? `${source.slice(0, 118)}...` : source;
}

function mergeTags(base, additions) {
  const tags = `${base} ${additions.join(" ")}`
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(tags)].join(" ");
}

function getMediaNotes() {
  return state.media
    .map((file, index) => file.caption?.trim() || `${index === 0 ? "封面图" : `配图 ${index + 1}`}：${file.name}`)
    .filter(Boolean);
}

function getValidLinks() {
  return state.links
    .map((link) => ({
      title: link.title.trim() || link.url.trim(),
      url: link.url.trim(),
    }))
    .filter((link) => link.url);
}

function formatLinksForBody(links) {
  return links.map((link, index) => `${index + 1}. ${link.title}：${link.url}`).join("\n");
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
  renderLinks();
  renderVariantTabs();
  updatePreview();
  renderQueue();
  renderPublishPackages();
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

async function copyPackageField(packageId, field) {
  const item = getPublishPackages().find((entry) => entry.id === packageId);
  if (!item) return;

  const text = field === "all"
    ? formatPackageForCopy(item)
    : item[field] || "";

  try {
    await navigator.clipboard.writeText(text);
    showToast(`${item.name}${field === "all" ? "发布包" : fieldLabel(field)}已复制。`);
  } catch {
    fallbackCopy(text);
    showToast(`${item.name}${field === "all" ? "发布包" : fieldLabel(field)}已复制。`);
  }
}

function openPackagePage(packageId) {
  const item = getPublishPackages().find((entry) => entry.id === packageId);
  if (!item) return;
  window.open(item.url, "_blank", "noopener,noreferrer");
}

function togglePackagePublished(packageId) {
  state.packageStatus[packageId] = state.packageStatus[packageId] === "published" ? "draft" : "published";
  renderPublishPackages();
  saveDraft();
  showToast(`${platformName(packageId)}发布状态已更新。`);
}

function formatPackageForCopy(item) {
  return [
    `【${item.name}】`,
    "",
    `标题：${item.title}`,
    item.summary ? `摘要：${item.summary}` : "",
    "",
    "正文：",
    item.body,
    "",
    `标签 / 关键词：${item.tags}`,
    item.mediaNotes?.length ? `\n图片说明：\n${item.mediaNotes.map((note, index) => `${index + 1}. ${note}`).join("\n")}` : "",
    item.links?.length ? `\n链接：\n${formatLinksForBody(item.links)}` : "",
    "",
    `发布提示：${item.tips.join("；")}`,
  ].filter(Boolean).join("\n");
}

function fieldLabel(field) {
  const map = {
    title: "标题",
    summary: "摘要",
    body: "正文",
    tags: "标签",
  };
  return map[field] || "内容";
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
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
    links: state.links,
    selected: [...state.selected],
    activeVariant: state.activeVariant,
    variants: state.variants,
    packageStatus: state.packageStatus,
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
    state.links = Array.isArray(draft.links) ? draft.links : [];
    elements.publishMode.value = draft.publishMode || "now";
    elements.scheduleDate.value = draft.scheduleDate || "";
    elements.scheduleTime.value = draft.scheduleTime || "";
    state.selected = new Set(draft.selected || platforms.map((platform) => platform.id));
    state.activeVariant = draft.activeVariant || "wechat";
    state.variants = draft.variants || {};
    state.packageStatus = draft.packageStatus || {};
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

  if (elements.addLinkButton) {
    elements.addLinkButton.addEventListener("click", () => {
      state.links.push({ title: "", url: "" });
      renderLinks();
    });
  }

  if (elements.linkList) {
    elements.linkList.addEventListener("input", (event) => {
      const titleIndex = event.target.dataset.linkTitle;
      const urlIndex = event.target.dataset.linkUrl;
      if (titleIndex !== undefined) state.links[Number(titleIndex)].title = event.target.value;
      if (urlIndex !== undefined) state.links[Number(urlIndex)].url = event.target.value;
      renderPublishPackages();
    });

    elements.linkList.addEventListener("click", (event) => {
      const removeIndex = event.target.dataset.removeLink;
      if (removeIndex === undefined) return;
      state.links.splice(Number(removeIndex), 1);
      renderLinks();
      renderPublishPackages();
    });
  }

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

  if (elements.packageGrid) {
    elements.packageGrid.addEventListener("click", (event) => {
      const copyButton = event.target.closest("[data-copy-package]");
      const openButton = event.target.closest("[data-open-package]");
      const markButton = event.target.closest("[data-mark-package]");

      if (copyButton) {
        copyPackageField(copyButton.dataset.copyPackage, copyButton.dataset.copyField);
        return;
      }

      if (openButton) {
        openPackagePage(openButton.dataset.openPackage);
        return;
      }

      if (markButton) {
        togglePackagePublished(markButton.dataset.markPackage);
      }
    });
  }

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

  if (elements.generatePackagesButton) {
    elements.generatePackagesButton.addEventListener("click", () => {
      state.packages = Object.fromEntries(getPublishPackages().map((item) => [item.id, item]));
      renderPublishPackages();
      showToast("已生成小红书、知乎、公众号发布包。");
    });
  }

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
      caption: "",
    }));
    renderMedia();
    updatePreview();
    renderPublishPackages();
  });

  if (elements.mediaNoteList) {
    elements.mediaNoteList.addEventListener("input", (event) => {
      const index = event.target.dataset.mediaCaption;
      if (index === undefined || !state.media[Number(index)]) return;
      state.media[Number(index)].caption = event.target.value;
      renderPublishPackages();
    });
  }

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
  renderMediaNotes();
}

function renderMediaNotes() {
  if (!elements.mediaNoteList) return;
  elements.mediaNoteList.innerHTML = state.media.length
    ? state.media
        .map((file, index) => `
          <div class="media-note-item">
            <div>
              <strong>图 ${index + 1}</strong>
              <span>${escapeHtml(file.name)}</span>
            </div>
            <input type="text" value="${escapeAttribute(file.caption || "")}" data-media-caption="${index}" placeholder="说明用途，例如：封面图 / 步骤图 / 结果图" />
          </div>
        `)
        .join("")
    : "";
}

function renderLinks() {
  if (!elements.linkList) return;
  elements.linkList.innerHTML = state.links.length
    ? state.links
        .map((link, index) => `
          <div class="link-item" data-link-item="${index}">
            <input type="text" value="${escapeAttribute(link.title || "")}" data-link-title="${index}" placeholder="链接标题，例如：产品官网" />
            <input type="url" value="${escapeAttribute(link.url || "")}" data-link-url="${index}" placeholder="https://example.com" />
            <button class="icon-button" type="button" data-remove-link="${index}" aria-label="删除链接" title="删除链接">×</button>
          </div>
        `)
        .join("")
    : '<div class="empty-helper">还没有链接。可以添加产品页、参考资料或延伸阅读。</div>';
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

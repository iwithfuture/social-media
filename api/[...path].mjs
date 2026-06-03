const defaultAccounts = {
  wechat: { connected: true, status: "active", accountName: "品牌公众号", expiresAt: futureDays(28) },
  weibo: { connected: true, status: "active", accountName: "品牌微博", expiresAt: futureDays(21) },
  xiaohongshu: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
  douyin: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
  bilibili: { connected: true, status: "active", accountName: "品牌B站", expiresAt: futureDays(35) },
  zhihu: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
  linkedin: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
  x: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
  facebook: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
};

function getStore() {
  if (!globalThis.socialPublisherStore) {
    globalThis.socialPublisherStore = {
      accounts: structuredClone(defaultAccounts),
      tasks: [],
      auditLog: [],
    };
  }
  return globalThis.socialPublisherStore;
}

export default async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const store = getStore();
    const url = new URL(request.url || "/", "https://example.com");
    const method = request.method || "GET";
    const segments = url.pathname.split("/").filter(Boolean);

    if (method === "GET" && url.pathname === "/api/health") {
      send(response, 200, { ok: true, runtime: "vercel", time: new Date().toISOString() });
      return;
    }

    if (method === "GET" && url.pathname === "/api/accounts") {
      send(response, 200, { accounts: store.accounts });
      return;
    }

    if (method === "POST" && segments[1] === "accounts" && segments[3] === "connect") {
      const platform = segments[2];
      ensureAccount(store, platform);
      store.accounts[platform] = {
        connected: true,
        status: "active",
        accountName: `${platform} 测试账号`,
        expiresAt: futureDays(30),
      };
      appendAudit(store, "account_connected", { platform });
      send(response, 200, { account: store.accounts[platform] });
      return;
    }

    if (method === "POST" && segments[1] === "accounts" && segments[3] === "disconnect") {
      const platform = segments[2];
      ensureAccount(store, platform);
      store.accounts[platform] = {
        connected: false,
        status: "disconnected",
        accountName: "",
        expiresAt: "",
      };
      appendAudit(store, "account_disconnected", { platform });
      send(response, 200, { account: store.accounts[platform] });
      return;
    }

    if (method === "GET" && url.pathname === "/api/tasks") {
      send(response, 200, { tasks: store.tasks });
      return;
    }

    if (method === "POST" && url.pathname === "/api/tasks") {
      const body = await readBody(request);
      const task = createTask(body, "scheduled");
      store.tasks.unshift(task);
      appendAudit(store, "task_created", { taskId: task.id, status: task.status });
      send(response, 201, { task });
      return;
    }

    if (method === "DELETE" && url.pathname === "/api/tasks") {
      store.tasks = [];
      appendAudit(store, "tasks_cleared", {});
      send(response, 200, { tasks: [] });
      return;
    }

    if (method === "POST" && url.pathname === "/api/publish") {
      const body = await readBody(request);
      const task = createTask(body, "publishing");
      task.results = task.variants.map((variant) => {
        const account = store.accounts[variant.platformId];
        return {
          platformId: variant.platformId,
          platformName: variant.platformName,
          status: account?.connected ? "published" : "waiting_auth",
          message: account?.connected ? "已提交到平台发布接口" : "账号未授权，已进入授权待办",
          finishedAt: new Date().toISOString(),
        };
      });
      task.status = task.results.every((result) => result.status === "published") ? "published" : "partial";
      task.publishedAt = new Date().toISOString();
      store.tasks.unshift(task);
      appendAudit(store, "task_published", { taskId: task.id, status: task.status });
      send(response, 201, { task });
      return;
    }

    if (method === "GET" && segments[1] === "tasks" && segments[2]) {
      const task = store.tasks.find((item) => item.id === segments[2]);
      if (!task) {
        send(response, 404, { error: "task_not_found" });
        return;
      }
      send(response, 200, { task });
      return;
    }

    if (method === "GET" && url.pathname === "/api/audit-log") {
      send(response, 200, { auditLog: store.auditLog.slice(0, 100) });
      return;
    }

    send(response, 404, { error: "not_found" });
  } catch (error) {
    send(response, 500, { error: "server_error", message: error.message });
  }
}

function createTask(body, status) {
  const now = new Date();
  const date = body.date || formatDateKey(now);
  const time = body.time || now.toTimeString().slice(0, 5);
  return {
    id: crypto.randomUUID(),
    title: body.title || "未命名发布",
    date,
    time,
    status,
    platforms: body.platforms || [],
    variants: body.variants || [],
    createdAt: now.toISOString(),
    scheduledAt: `${date}T${time}`,
    results: [],
  };
}

async function readBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function ensureAccount(store, platform) {
  if (!store.accounts[platform]) {
    store.accounts[platform] = { connected: false, status: "disconnected", accountName: "", expiresAt: "" };
  }
}

function appendAudit(store, action, detail) {
  store.auditLog.unshift({
    id: crypto.randomUUID(),
    action,
    detail,
    createdAt: new Date().toISOString(),
  });
  store.auditLog = store.auditLog.slice(0, 200);
}

function send(response, status, payload) {
  response.status(status).json(payload);
}

function futureDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

const root = resolve(".");
const dataDir = resolve("data");
const dataFile = resolve(dataDir, "store.json");
const port = Number(process.env.PORT || 4173);
const host = "127.0.0.1";

const contentTypes = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".json": "application/json;charset=utf-8",
};

const defaultAccounts = {
  wechat: { connected: true, status: "active", accountName: "品牌公众号", expiresAt: futureDays(28) },
  weibo: { connected: true, status: "active", accountName: "品牌微博", expiresAt: futureDays(21) },
  xiaohongshu: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
  douyin: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
  bilibili: { connected: true, status: "active", accountName: "品牌B站", expiresAt: futureDays(35) },
  linkedin: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
  x: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
  facebook: { connected: false, status: "disconnected", accountName: "", expiresAt: "" },
};

const defaultStore = {
  accounts: defaultAccounts,
  tasks: [],
  auditLog: [],
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url);
  } catch (error) {
    sendJson(response, 500, { error: "server_error", message: error.message });
  }
});

async function handleApi(request, response, url) {
  const store = await loadStore();
  const segments = url.pathname.split("/").filter(Boolean);
  const method = request.method || "GET";

  if (method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, time: new Date().toISOString() });
    return;
  }

  if (method === "GET" && url.pathname === "/api/accounts") {
    sendJson(response, 200, { accounts: store.accounts });
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
    await saveStore(store);
    sendJson(response, 200, { account: store.accounts[platform] });
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
    await saveStore(store);
    sendJson(response, 200, { account: store.accounts[platform] });
    return;
  }

  if (method === "GET" && url.pathname === "/api/tasks") {
    sendJson(response, 200, { tasks: store.tasks });
    return;
  }

  if (method === "POST" && url.pathname === "/api/tasks") {
    const body = await readJson(request);
    const task = createTask(body, "scheduled");
    store.tasks.unshift(task);
    appendAudit(store, "task_created", { taskId: task.id, status: task.status });
    await saveStore(store);
    sendJson(response, 201, { task });
    return;
  }

  if (method === "DELETE" && url.pathname === "/api/tasks") {
    store.tasks = [];
    appendAudit(store, "tasks_cleared", {});
    await saveStore(store);
    sendJson(response, 200, { tasks: [] });
    return;
  }

  if (method === "POST" && url.pathname === "/api/publish") {
    const body = await readJson(request);
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
    await saveStore(store);
    sendJson(response, 201, { task });
    return;
  }

  if (method === "GET" && segments[1] === "tasks" && segments[2]) {
    const task = store.tasks.find((item) => item.id === segments[2]);
    if (!task) {
      sendJson(response, 404, { error: "task_not_found" });
      return;
    }
    sendJson(response, 200, { task });
    return;
  }

  if (method === "GET" && url.pathname === "/api/audit-log") {
    sendJson(response, 200, { auditLog: store.auditLog.slice(0, 100) });
    return;
  }

  sendJson(response, 404, { error: "not_found" });
}

async function serveStatic(response, url) {
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = resolve(join(root, pathname));

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "content-type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

async function loadStore() {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    return {
      accounts: { ...defaultAccounts, ...(parsed.accounts || {}) },
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
    };
  } catch {
    await saveStore(defaultStore);
    return structuredClone(defaultStore);
  }
}

async function saveStore(store) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
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

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json;charset=utf-8" });
  response.end(JSON.stringify(payload));
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

server.listen(port, host, () => {
  console.log(`Social publisher running at http://${host}:${port}`);
});

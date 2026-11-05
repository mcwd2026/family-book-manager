// fnOS 统一网关适配层：监听 Unix Socket，把网关请求转发到本机 Next.js 服务。
// 网关会校验 NAS 登录态，并通过 X-Trim-Userid / X-Trim-Username 传递用户身份。
const http = require("node:http");
const fs = require("node:fs");

const SOCKET_PATH = process.env.FBM_GATEWAY_SOCKET || "";
const TARGET_PORT = Number(process.env.PORT || 8112);
const TARGET_HOST = process.env.FBM_TARGET_HOST || "127.0.0.1";
const GATEWAY_PREFIX = process.env.FBM_GATEWAY_PREFIX || "/app/fbm";

if (!SOCKET_PATH) {
  console.error("[gateway] 缺少 FBM_GATEWAY_SOCKET");
  process.exit(1);
}

// 清理上次残留的 socket 文件
try {
  fs.unlinkSync(SOCKET_PATH);
} catch {
  /* ignore */
}

const server = http.createServer((req, res) => {
  const headers = { ...req.headers };
  // 保留原始 Host，保证 Next.js 生成的回调地址与 fnOS 域名一致
  delete headers["proxy-connection"];

  // 兼容网关是否保留 /app/fbm 前缀两种转发方式
  let path = req.url || "/";
  if (GATEWAY_PREFIX && !path.startsWith(`${GATEWAY_PREFIX}/`) && path !== GATEWAY_PREFIX) {
    path = `${GATEWAY_PREFIX}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  const proxyReq = http.request(
    {
      host: TARGET_HOST,
      port: TARGET_PORT,
      method: req.method,
      path,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (error) => {
    console.error("[gateway] 转发失败:", error.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Bad Gateway");
  });

  req.pipe(proxyReq);
});

server.listen(SOCKET_PATH, () => {
  try {
    fs.chmodSync(SOCKET_PATH, 0o660);
  } catch {
    /* ignore */
  }
  console.log(`[gateway] 已监听 ${SOCKET_PATH} -> ${TARGET_HOST}:${TARGET_PORT}${GATEWAY_PREFIX}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

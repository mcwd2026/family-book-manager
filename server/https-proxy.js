// 局域网 HTTPS 入口：手机浏览器只有在安全上下文（HTTPS）下才允许调用摄像头，
// 因此把 8443 的 HTTPS 请求反向代理到本机的 Next.js 服务（默认 8112）。
const https = require("node:https");
const http = require("node:http");
const fs = require("node:fs");

const HTTPS_PORT = Number(process.env.FBM_HTTPS_PORT || 8443);
const TARGET_PORT = Number(process.env.PORT || 8112);
const CERT_FILE = process.env.FBM_CERT_FILE || "";
const KEY_FILE = process.env.FBM_KEY_FILE || "";

function readPem(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

const cert = readPem(CERT_FILE);
const key = readPem(KEY_FILE);

if (!cert || !key) {
  console.error("[https] 未找到证书，跳过 HTTPS 入口:", CERT_FILE, KEY_FILE);
  process.exit(0);
}

const server = https.createServer({ cert, key }, (req, res) => {
  // 手机直连只用于扫码页，不携带 fnOS 网关身份，避免伪造身份头
  const headers = { ...req.headers, "x-forwarded-proto": "https" };
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase().startsWith("x-trim-")) delete headers[name];
  }
  const proxyReq = http.request(
    {
      host: "127.0.0.1",
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end("Bad Gateway");
  });

  req.pipe(proxyReq);
});

server.listen(HTTPS_PORT, "0.0.0.0", () => {
  console.log(`[https] 手机扫码入口已启动: https://0.0.0.0:${HTTPS_PORT}`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));

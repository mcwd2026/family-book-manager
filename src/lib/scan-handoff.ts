// 手机扫码接力：生成手机可访问的扫码地址
import os from "node:os";

// 取本机局域网 IPv4（排除回环与 Docker 网桥）
export function getLanIPv4(): string[] {
  const result: string[] = [];
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (net.family !== "IPv4" || net.internal) continue;
      if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(net.address)) continue;
      result.push(net.address);
    }
  }
  return result;
}

function firstHost(value: string | null): string {
  return (value || "").split(",")[0].trim();
}

// 桌面端入口是 http://NAS:8112，手机摄像头必须在安全上下文（HTTPS）下才能调用，
// 因此默认把二维码指向应用自带的 HTTPS 端口（8443）。
// 若当前页面本身已是 HTTPS（例如 NAS 已配置反向代理），则直接复用当前域名。
export function buildPhoneUrl(req: Request, token: string): string {
  const override = process.env.FBM_PHONE_BASE_URL?.trim();
  if (override) {
    return `${override.replace(/\/$/, "")}/m/${token}`;
  }

  const headers = req.headers;
  const host = firstHost(headers.get("x-forwarded-host")) || firstHost(headers.get("host"));
  const proto = firstHost(headers.get("x-forwarded-proto"));
  const httpsPort = process.env.FBM_HTTPS_PORT || "8443";

  let hostname = host.replace(/:\d+$/, "");
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    hostname = getLanIPv4()[0] || "localhost";
  }

  if (proto === "https") {
    // 反向代理 / 原生 HTTPS 访问：手机直接打开当前域名下的同一路径
    const hostForUrl = host || hostname;
    return `https://${hostForUrl}/m/${token}`;
  }

  return `https://${hostname}:${httpsPort}/m/${token}`;
}

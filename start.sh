#!/bin/sh
set -e
echo "[启动] 同步数据库 schema..."
# 直接调用内置的 prisma CLI，避免 npx 在离线环境联网下载
node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss || true
echo "[启动] 初始化默认管理员账号（如不存在）..."
node prisma/seed.js || true
echo "[启动] 启动 Next.js..."
node server.js

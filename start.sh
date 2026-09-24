#!/bin/sh
set -e
echo "[启动] 修复挂载卷权限..."
chown -R nextjs:nodejs /app/data
echo "[启动] 同步数据库 schema..."
su-exec nextjs node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss || true
echo "[启动] 初始化默认管理员账号（如不存在）..."
su-exec nextjs node prisma/seed.js || true
echo "[启动] 启动 Next.js..."
exec su-exec nextjs node server.js

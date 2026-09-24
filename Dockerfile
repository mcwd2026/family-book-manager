# 多阶段构建：先构建 Next.js standalone 产物，再起精简运行镜像
# ---- Stage 1: deps ----
FROM node:20-alpine AS deps
WORKDIR /app
# 安装 prisma 需要的 openssl
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# 安装全部依赖（含 devDependencies 中的 prisma CLI）
RUN npm ci --omit=optional || npm install --omit=optional

# ---- Stage 2: builder ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 生成 prisma client 并构建（Serwist 同时生成 SW）
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: runner ----
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat su-exec
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# 拷贝 Next standalone 产物与静态资源（全部 chown 给 nextjs 用户）
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma：schema + Client + CLI（运行时 db push 初始化数据库）
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# bcryptjs（seed 脚本密码哈希用，无其他依赖，单独拷贝即可）
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

# 入口脚本 + 数据目录
COPY start.sh ./start.sh
RUN chmod +x ./start.sh && mkdir -p /app/data

# 默认环境变量（数据库文件挂载在 /app/data，外部可覆盖）
ENV DATABASE_URL="file:/app/data/dev.db"
ENV PORT=8182
ENV HOSTNAME=0.0.0.0

# 不切换 USER：start.sh 以 root 启动，先 chown 挂载卷，再用 su-exec 切换 nextjs 运行
EXPOSE 8182

# 入口：先同步 schema + 种子管理员 + chown，再以 nextjs 启动
CMD ["./start.sh"]

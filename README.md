# 家庭图书管理系统 (Family Book Manager · FBM)

面向家庭场景的绘本/童书管理 PWA：**摄像头实时自动扫码录书**、成员管理、阅读记录、按年龄推荐、自定义封面与封面刮削，自带轻量管理员登录。专为飞牛 NAS（fnOS）Docker 部署设计，也可运行在任意 Linux 主机上。

在线演示形态：手机浏览器访问后"添加到主屏幕"，即可像原生 App 一样使用。

## 功能一览

- **扫码录入**：打开摄像头即进入**实时自动扫描**（ZBar WASM 引擎，每 500ms 截帧识别，对准条形码自动填充，无需拍照按键）；同时支持从相册选图识别（多策略：原生 BarcodeDetector + ZBar 多区域 + zxing 旋转增强）
- **多源查书**：ISBN 依次查询 **豆瓣 → Google Books → 京东 → 当当** 四个数据源，自动抓取书名、作者、出版社、封面图，任一命中即返回
- **ISBN 查重**：保存前点查数据库，已入库的书提示"已入库，请扫描下一本"
- **藏书管理**：支持手动录入/编辑分类、适读年龄区间、购买日期、价格、备注等
- **封面体系**：
  - 互联网封面优先显示，加载失败（防盗链/404）自动回退
  - **自定义封面**：拍照或从相册选取，本地压缩存储（最长边 800px JPEG），不依赖外网图床
  - **封面刮削**：书籍详情页可单本"刷新封面"，仪表盘可"批量更新图书封面"
- **成员管理**：每位家庭成员一个档案，支持三种类型
  - `成人`（家长）
  - `儿童`（学龄前/小学）
  - `青少年`（中学阶段，推荐逻辑与儿童共享"按年龄匹配"规则）

  儿童/青少年记录出生日期，系统自动计算年龄（如"6岁11个月"）与适合其阅读的藏书数
- **阅读记录**：每次阅读绑定成员 + 书目，支持评分、日期、备注，可取消（应用内弹窗二次确认）
- **首页统计**：总藏书数、本月阅读总数，以及按成员拆分的本月/累计阅读数
- **智能推荐**：基于成员生日计算实际年龄，按书目的 `ageMin/ageMax` 区间匹配；成人不参与推荐，儿童与青少年仅按年龄匹配、不按类型过滤
- **PWA**：Serwist 离线缓存，可"添加到主屏幕"作为 App 使用
- **轻量鉴权**：JWT（httpOnly + Secure + SameSite=Lax）+ bcrypt 哈希，7 天免登录；「我的」页面支持修改密码、退出登录

## 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | Next.js 15.5 (App Router) + React 19 |
| ORM | Prisma 5.22 + SQLite（文件位于容器 `/app/data/dev.db`） |
| 鉴权 | `jose`（JWT）+ `bcryptjs`（纯 JS，无原生依赖） |
| 条码识别 | `@undecaf/zbar-wasm` + 原生 `BarcodeDetector` + `html5-qrcode`(zxing) |
| PWA | Serwist |
| 样式 | Tailwind CSS + shadcn 风格组件 |
| 容器 | Node 20-alpine 多阶段构建，standalone 输出 |

## 快速部署（Docker）

### 1. 拉取代码

```bash
git clone https://github.com/mcwd2026/family-book-manager.git
cd family-book-manager
```

### 2. 准备环境变量

在项目根目录新建 `.env`（已 gitignore，可参考 `.env.example`）：

```env
# 随机字符串，务必修改
JWT_SECRET=please-change-me-to-a-random-string
# 仅在首次启动（数据库为空）时创建默认管理员，之后不会再覆盖密码
ADMIN_USERNAME=admin
ADMIN_PASSWORD=123456
DATABASE_URL=file:/app/data/dev.db
```

### 3. 启动

```bash
docker compose up -d --build
```

- 内部端口：`8182`
- 健康检查：`/login`（公开页，无需鉴权）
- SQLite 数据通过 `./data` 目录挂载持久化

### 4. 反向代理（可选）

摄像头 `getUserMedia` 要求安全上下文（HTTPS 或 localhost）。建议在 Lucky / Nginx 层套一层 HTTPS（如把 `18182` 转发到容器 `8182`），手机才能正常调用摄像头扫码。

## 默认账号与密码

首次启动（数据库为空）时自动创建：

| 用户名 | 初始密码 |
|---|---|
| `admin` | `123456`（可用 `ADMIN_PASSWORD` 环境变量覆盖） |

**关于密码的三种情况：**

1. **初始密码**：仅在首次启动、库中没有任何用户时创建。之后容器重启、修改 `.env` 都**不会**覆盖已有密码。
2. **自定义密码（推荐）**：登录后在「我的 → 修改密码」中修改，修改后永久生效，重启容器也不会被重置。
3. **忘记密码**：在宿主机执行一条容器命令即可重置（无需改环境变量、不丢数据）：
   ```bash
   docker exec -it family-book-manager node prisma/reset-password.js admin 新密码
   ```
   执行成功后直接用新密码登录。

## 目录结构（要点）

```
prisma/
  schema.prisma      # User / Member / Book / ReadingRecord 模型
  seed.js            # 启动种子：首次建管理员（不重置密码、不做类型迁移）
  reset-password.js  # 忘记密码时容器内手动重置：node prisma/reset-password.js <用户> <新密码>
src/
  middleware.ts      # 边缘中间件：除 /login、/api/auth、静态资源外都需登录
  lib/auth.ts        # JWT 签发/校验、bcrypt 封装、getSession()
  components/
    bottom-nav.tsx       # 底部导航（首页/推荐/扫码/书库/我的）
    ui/cover-picker.tsx  # 自定义封面（拍照/相册，压缩为 dataURL）
    ui/book-cover.tsx    # 互联网封面优先 + 自定义封面回退
  app/
    login/           # 登录页（Suspense 包裹 useSearchParams）
    dashboard/       # 首页统计 + 批量刮削封面入口 + 退出
    members/         # 「我的」：账号/改密码 + 家庭成员管理
    scan/            # 扫码录入（实时自动扫描 + 相册识别）
    library/         # 全部藏书
    books/[id]/      # 书籍详情（编辑、删除、单本刷新封面、阅读记录）
    recommend/       # 按年龄推荐
    api/
      auth/          # login / logout / me / change-password
      books/         # CRUD + check(查重) + [id]/scrape + scrape-all
      members/       # CRUD
      reading-records/
      scan-isbn/     # 豆瓣 / Google Books / 京东 / 当当 四源查询
start.sh             # db push → seed → node server.js
Dockerfile           # 多阶段：deps → builder → runner
docker-compose.yml   # 端口、env、volume、healthcheck
```

## 常见问题

- **手机扫码无反应**：请确认通过 **HTTPS** 访问（自签证书也可，需在浏览器手动信任）；非安全上下文浏览器会拒绝调用摄像头。
- **豆瓣查不到书 / 封面刷不出来**：豆瓣对高频请求有风控（返回安全验证页），Google Books 在部分网络不可达。系统会自动依次尝试四个数据源；临时不可用时可改用自定义封面（拍照/相册）。
- **页面更新后看起来没变化**：PWA (Service Worker) 缓存导致，下拉刷新或关闭页面重开一次即可；必要时在浏览器设置中清除站点数据。
- **手机上点删除/确认没反应**：部分手机浏览器会静默拦截 `alert/confirm`，本项目已统一改为应用内弹窗确认。
- **忘记密码 / 登录提示密码错误**：自定义密码不受 `.env` 影响，重启也不会恢复默认值。在宿主机执行下面命令重置即可（数据不丢）：
  ```bash
  docker exec -it family-book-manager node prisma/reset-password.js admin 新密码
  ```
- **想彻底回到初始状态**：删除挂载目录下的 `data/dev.db` 后重新 `docker compose up -d`，会用 `.env` 中的 `ADMIN_PASSWORD` 重新创建账号（**会清空全部书籍和成员数据，谨慎操作**）。

## 许可证

本仓库目前公开展示，**暂未添加开源许可证**（默认保留所有权利）。如需引用或二次发布，请先联系作者。

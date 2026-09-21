// 启动种子脚本：
// 数据库无用户时，创建默认管理员（仅首次启动生效，之后不再覆盖用户密码）
// 成员类型固定为：成人 / 儿童 / 青少年（不再做运行时迁移）
// 修改密码请在「我的 → 修改密码」中操作；忘记密码用 prisma/reset-password.js
// 由 start.sh 在 db push 后调用，环境变量可覆盖默认账号密码
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const prisma = new PrismaClient();
  try {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "123456";
    const existing = await prisma.user.findFirst();

    if (!existing) {
      // 无管理员：创建默认账号
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({ data: { username, passwordHash } });
      console.log("[seed] 已创建默认管理员账号:", username);
    } else {
      // 已有用户：绝不重置密码，保留用户在页面上修改的自定义密码
      console.log("[seed] 已存在管理员账号，跳过初始化");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[seed] 失败:", e);
  process.exit(0); // 种子失败不阻塞启动
});

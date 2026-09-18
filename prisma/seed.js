// 启动种子脚本：
// 1) 数据库无用户时，创建默认管理员（仅首次启动生效，之后不再覆盖用户密码）
// 2) 幂等迁移旧成员类型（大人→成人，小孩→儿童）
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

    // 迁移旧成员类型（大人→成人，小孩→儿童），幂等可重复执行
    const r1 = await prisma.member.updateMany({ where: { type: "大人" }, data: { type: "成人" } });
    const r2 = await prisma.member.updateMany({ where: { type: "小孩" }, data: { type: "儿童" } });
    if (r1.count || r2.count) {
      console.log("[seed] 成员类型迁移: 大人→成人 " + r1.count + " 条, 小孩→儿童 " + r2.count + " 条");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[seed] 失败:", e);
  process.exit(0); // 种子失败不阻塞启动
});

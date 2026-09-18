// 启动种子脚本：1) 无管理员时创建默认账号 2) 校验密码与配置一致（自愈）3) 迁移旧成员类型
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
      // 无管理员：创建
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({ data: { username, passwordHash } });
      console.log("[seed] 已创建默认管理员账号:", username);
    } else {
      // 已有管理员：校验密码是否与当前环境变量一致，不一致则重置（自愈）
      const matches = await bcrypt.compare(password, existing.passwordHash);
      if (!matches) {
        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
        console.log("[seed] 管理员密码已与配置同步重置");
      } else {
        console.log("[seed] 管理员账号正常，跳过");
      }
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

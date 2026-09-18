// 忘记密码时，在容器内手动重置指定用户的密码：
//
//   docker exec -it family-book-manager \
//     node prisma/reset-password.js <用户名> <新密码>
//
// 示例：
//   docker exec -it family-book-manager node prisma/reset-password.js admin 123456
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("用法: node prisma/reset-password.js <用户名> <新密码>");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("新密码至少 6 位");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.error(`用户「${username}」不存在`);
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    console.log(`[reset-password] 用户「${username}」的密码已重置，请用新密码登录`);
  } finally {
    await prisma.$disconnect();
  }
}

main();

// 年龄计算与书籍推荐工具函数
// 注意：年龄永远实时计算，不存数据库

/**
 * 根据出生日期计算周岁
 * 自动处理生日逻辑：未到今年生日则减一岁
 */
export function calcAge(birthDate: Date | string | null): number | null {
  if (!birthDate) return null;
  const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (isNaN(birth.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  const dayDiff = now.getDate() - birth.getDate();

  // 未到今年生日则减一岁
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }
  return age < 0 ? 0 : age;
}

/**
 * 返回详细的年龄描述（婴幼儿用）
 * 格式："3岁5个月"
 * 小于1岁："8个月"
 */
export function calcAgeDetailed(birthDate: Date | string | null): string {
  if (!birthDate) return "";
  const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (isNaN(birth.getTime())) return "";

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    // 上个月的天数
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += lastMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years <= 0) {
    const totalMonths = months;
    return totalMonths <= 0 ? "新生儿" : `${totalMonths}个月`;
  }
  return `${years}岁${months}个月`;
}

/**
 * 根据成员年龄筛选适合的书
 * 规则：书的 ageMin/ageMax 可空，为空表示不限；成员年龄落在 [ageMin, ageMax] 区间则匹配
 */
export function matchBooksForMember<T extends { ageMin: number | null; ageMax: number | null; status?: string }>(
  memberAge: number | null,
  books: T[]
): T[] {
  if (memberAge === null) return [];
  return books.filter((book) => {
    // 仅在库书籍可推荐
    if (book.status && book.status !== "在库") return false;
    // 无年龄限制的书默认匹配
    if (book.ageMin === null && book.ageMax === null) return true;
    const min = book.ageMin ?? 0;
    const max = book.ageMax ?? 999;
    return memberAge >= min && memberAge <= max;
  });
}

/**
 * 判断成员当前是否到达某一年龄段
 */
export function isInAgeRange(memberAge: number | null, min: number, max: number): boolean {
  if (memberAge === null) return false;
  return memberAge >= min && memberAge <= max;
}

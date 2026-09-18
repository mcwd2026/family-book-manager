// 通用工具函数
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// 合并 className
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 统一 API 响应格式
export function apiSuccess<T>(data: T, message = "操作成功") {
  return { success: true, data, message };
}

export function apiError(message = "操作失败", data = null) {
  return { success: false, data, message };
}

// 格式化日期
export function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 格式化月份（用于时间线分组）
export function formatMonth(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

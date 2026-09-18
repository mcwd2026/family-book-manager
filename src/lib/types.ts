// 类型定义
export type MemberType = "成人" | "儿童" | "青少年";

export type BookStatus = "在库" | "已出售" | "已移除";

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
}

// 带统计信息的成员
export interface MemberWithStats {
  id: string;
  name: string;
  type: MemberType;
  birthDate: string | null;
  avatar: string | null;
  createdAt: string;
  age: number | null;
  ageDetail: string;
  readCount: number;
  suitableBookCount?: number;
}

// 带阅读记录的书籍
export interface BookWithReadings {
  id: string;
  isbn: string | null;
  title: string;
  author: string | null;
  coverUrl: string | null;
  coverLocal: string | null;
  publisher: string | null;
  ageMin: number | null;
  ageMax: number | null;
  category: string | null;
  status: BookStatus;
  buyDate: string | null;
  sellDate: string | null;
  buyPrice: number | null;
  note: string | null;
  createdAt: string;
  readings?: ReadingRecordWithMember[];
  readMembers?: { id: string; name: string; avatar: string | null }[];
  avgRating?: number | null;
}

export interface ReadingRecordWithMember {
  id: string;
  bookId: string;
  memberId: string;
  readDate: string;
  rating: number | null;
  note: string | null;
  createdAt: string;
  member?: { id: string; name: string; avatar: string | null; type: string };
  book?: BookWithReadings;
}

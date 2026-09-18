"use client";
import { useState, useEffect } from "react";
import { Book as BookIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookCoverProps {
  src?: string | null;
  /** 主图加载失败时的回退源（例如自定义封面 coverLocal） */
  fallback?: string | null;
  title: string;
  width?: number;
  height?: number;
  className?: string;
}

// 书籍封面组件：优先显示互联网封面(src)，加载失败回退到自定义封面(fallback)，全部失败显示书名占位
export function BookCover({ src, fallback, title, width, height, className }: BookCoverProps) {
  // 有效候选源：主源在前，回退源在后
  const sources = [src, fallback].filter((s): s is string => !!s);
  const [idx, setIdx] = useState(0);
  // src/fallback 变化时重置
  useEffect(() => setIdx(0), [src, fallback]);
  const current = sources[idx];
  const showImg = !!current;
  return (
    <div
      className={cn(
        "rounded-md bg-secondary flex items-center justify-center overflow-hidden shrink-0",
        !showImg && "border border-border/60",
        className
      )}
      style={width !== undefined || height !== undefined ? { width, height } : undefined}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setIdx((i) => i + 1)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-muted-foreground p-1 w-full h-full aspect-[2/3]">
          <BookIcon size={24} className="opacity-50 mb-1" />
          <span className="text-[10px] text-center line-clamp-2 px-1">{title}</span>
        </div>
      )}
    </div>
  );
}

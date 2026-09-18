"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, ScanLine, Sparkles, Library } from "lucide-react";
import { cn } from "@/lib/utils";

// 底部导航（移动端优先）
const navItems = [
  { href: "/dashboard", label: "首页", icon: Home },
  { href: "/recommend", label: "推荐", icon: Sparkles },
  { href: "/scan", label: "扫码", icon: ScanLine, highlight: true },
  { href: "/library", label: "书库", icon: Library },
  { href: "/members", label: "我的", icon: Users },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 safe-bottom">
      <div className="mx-auto max-w-md flex items-center justify-around h-14">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          if (item.highlight) {
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center -mt-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                  <Icon size={22} />
                </div>
                <span className="text-[10px] mt-0.5 text-primary font-medium">{item.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon size={20} />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

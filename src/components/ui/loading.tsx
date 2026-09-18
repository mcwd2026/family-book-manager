import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Loading({ className, size = 24 }: { className?: string; size?: number }) {
  return <Loader2 className={cn("animate-spin text-primary", className)} size={size} />;
}

export function FullLoading({ tip = "加载中..." }: { tip?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Loading size={32} />
      <p className="mt-2 text-sm">{tip}</p>
    </div>
  );
}

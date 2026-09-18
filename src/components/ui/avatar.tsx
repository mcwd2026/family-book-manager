import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}

// 头像组件（无图时取姓名首字）
export function Avatar({ src, name, size = 40, className }: AvatarProps) {
  const initial = name?.trim()?.charAt(0) || "?";
  return (
    <div
      className={cn("rounded-full bg-primary/10 text-primary flex items-center justify-center overflow-hidden shrink-0", className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

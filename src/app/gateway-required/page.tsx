// 统一网关模式下的提示页：只有从飞牛 fnOS 桌面 / 飞牛 App 打开时才带网关注入的身份
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function GatewayRequiredPage() {
  return (
    <div className="min-h-screen bg-background px-6 pt-20">
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen size={24} />
          </div>
          <h1 className="text-lg font-semibold">请从飞牛 App 打开</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            当前为飞牛 NAS 集成版，需在飞牛桌面或飞牛手机 App 的「应用」中启动，
            由系统自动完成身份校验，无需单独登录。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { redirect } from "next/navigation";

// 根路径跳转到仪表盘
export default function Home() {
  redirect("/dashboard");
}

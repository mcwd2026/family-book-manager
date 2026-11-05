import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "家庭图书管理系统",
  description: "管理家庭图书藏书，记录孩子的阅读时光",
  manifest: "/manifest.json",
  applicationName: "家庭图书管理系统",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "家庭图书",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen pb-14 max-w-md mx-auto bg-background">
        {children}
      </body>
    </html>
  );
}

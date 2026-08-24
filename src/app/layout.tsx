import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { UIProvider } from "@/components/ui/UIProvider";
import "@xyflow/react/dist/style.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mentor · 本地 AI 学习老师",
  description: "一个运行在本地、有长期记忆的私人学习老师",
};

/** 防首屏闪烁：默认纸白，非默认主题在首帧前写入 data-theme（旧值 light/dark 已迁移）。 */
const themeInitScript = `(function(){try{var v=localStorage.getItem('mentor-theme');if(v==='light')v='paper';if(v==='dark')v='warm';if(v&&v!=='paper'){document.documentElement.setAttribute('data-theme',v);if(v==='night'){document.documentElement.style.colorScheme='dark'}}}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      // 主题类由脚本在客户端切换，服务端与客户端 html 属性可能不同
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* 阻塞式内联脚本：必须在正文渲染前执行 */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <UIProvider>
          <AppShell>{children}</AppShell>
        </UIProvider>
      </body>
    </html>
  );
}

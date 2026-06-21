import type { Metadata } from "next";
import "./globals.css";
import GitHubLink from '@/components/GitHubLink';
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "广学相册",
  description: "记录每一个精彩瞬间",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans")}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var _hmt = _hmt || [];
              (function() {
                var hm = document.createElement("script");
                hm.src = "https://hm.baidu.com/hm.js?5bb4cf6dbf4b33132629fd891d818dec";
                var s = document.getElementsByTagName("script")[0];
                s.parentNode.insertBefore(hm, s);
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <GitHubLink />
        {children}
      </body>
    </html>
  );
}
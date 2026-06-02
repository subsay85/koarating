import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { DataProvider } from "./context/DataContext";

const inter = Inter({ subsets: ["latin"] });

// 데이터 로딩 전에 Supabase 도메인과의 연결(DNS·TLS)을 미리 맺어 첫 요청 지연을 줄인다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const metadata: Metadata = {
  title: "대한오목협회 레이팅 관리",
  description: "대한오목협회 레이팅 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {supabaseUrl && (
          <>
            <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseUrl} />
          </>
        )}
        <DataProvider>{children}</DataProvider>
      </body>
    </html>
  );
}

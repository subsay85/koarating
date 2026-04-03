import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { DataProvider } from "./context/DataContext";

const inter = Inter({ subsets: ["latin"] });

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
        {}
        <DataProvider>{children}</DataProvider>
      </body>
    </html>
  );
}

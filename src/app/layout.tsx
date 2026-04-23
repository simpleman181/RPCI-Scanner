import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RPCI Stock Scanner - NSE India | Automated Range Compression Analysis",
  description: "Automated RPCI (Range Percent Compression Indicator) stock scanner for NSE India. Identifies consolidation stocks with weekly RSI range shift, Bollinger Band squeeze, and volatility compression before breakout.",
  keywords: ["RPCI", "stock scanner", "NSE", "India", "consolidation", "breakout", "range compression", "Bollinger Bands", "RSI", "ATR", "F&O stocks"],
  authors: [{ name: "RPCI Scanner" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "RPCI Stock Scanner - NSE India",
    description: "Automated stock scanner identifying RPCI consolidation setups on NSE India",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

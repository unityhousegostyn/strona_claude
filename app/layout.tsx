import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
import ThemeProvider from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Panel Wspólnoty",
  description: "Panel zarządzania wspólnotą mieszkaniową",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Panel Wspólnoty",
    startupImage: ["/icon-512.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "msapplication-TileColor": "#0d9488",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased light`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0d9488" />
        {/* Apply saved theme before React hydrates to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.remove('light');document.documentElement.classList.add('dark');}}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col bg-[#f0f2f5]">
        <ThemeProvider>
          {children}
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}

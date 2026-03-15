import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { RadioQueueProvider } from "@/contexts/RadioQueueContext";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Focus Feed",
  description: "유튜브와 RSS 소스를 한 곳에서 정리해 보는 텍스트 중심 피드 리더",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Focus Feed",
    description: "YouTube & RSS in one feed",
    type: "website",
    images: [
      {
        url: "/images/og/og-image.png",
        width: 1200,
        height: 630,
        alt: "Focus Feed – YouTube & RSS in one feed",
      },
    ],
  },
};

export const viewport = {
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className="antialiased font-sans"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RadioQueueProvider>
            {children}
          </RadioQueueProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

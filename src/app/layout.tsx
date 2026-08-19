import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

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
  title: "DevStash",
  description: "Your developer knowledge hub",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Dark mode is the default; a light-mode toggle comes later.
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        {children}
        {/* Every route can raise one, so it is mounted once at the root rather
            than per page. Rate limits are the only thing that raises one today. */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}

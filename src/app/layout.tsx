import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { THEME_SCRIPT } from "@/lib/theme";

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
  title: "DevSquirrel",
  description: "Your developer knowledge hub",
  // The icon set lives in `public/` and is declared here rather than through
  // Next's `app/icon.*` file convention, because the manifest already refers to
  // the same files by root path and one source for them is easier to keep true.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The head script takes the `dark` class off before React hydrates, so
      // the class it finds is not the one the server sent. This is the only
      // way to say that is intended: it covers this element's own attributes
      // and nothing deeper, so a real mismatch anywhere else still reports.
      suppressHydrationWarning
      // The marketing page sets `scroll-behavior: smooth` through
      // `html:has(.marketing)`, which Next cannot see and warns about on every
      // navigation in development. Declaring it here is Next's own answer, and
      // does not itself turn smooth scrolling on anywhere.
      data-scroll-behavior="smooth"
      // Dark is the default and is rendered on the server; the script in the
      // head below takes the class off before paint if the visitor chose light.
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        {/* Blocking and inline on purpose: a theme applied after hydration
            flashes the wrong one on every load. It only ever removes the class,
            so a browser with no stored choice gets the server's dark. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        {/* Every route can raise one, so it is mounted once at the root rather
            than per page. Rate limits are the only thing that raises one today. */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}

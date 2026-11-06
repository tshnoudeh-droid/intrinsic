import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Navbar } from "@/components/Navbar";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_DESCRIPTION =
  "See what US and Canadian stocks are actually worth. The Intrinsic Valuator runs a simple DCF on any stock; the Intrinsic Screener finds stocks from a plain-English description.";

export const metadata: Metadata = {
  metadataBase: new URL("https://intrinsic.tawficshnoudeh.com"),
  applicationName: "Intrinsic",
  title: "Intrinsic",
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Intrinsic",
    title: "Intrinsic: what is a stock actually worth?",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Intrinsic: what is a stock actually worth?",
    description: SITE_DESCRIPTION,
  },
  icons: {
    icon: [{ url: "/favicon.png", sizes: "32x32", type: "image/png" }],
    shortcut: "/favicon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF8F4",
};

/** Clerk components themed to the Intrinsic palette. */
const clerkAppearance = {
  variables: {
    colorPrimary: "#2a2622",
    colorText: "#2a2622",
    colorTextSecondary: "#6b5a4e",
    colorBackground: "#FAF8F4",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={clerkAppearance}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col font-sans">
          <Navbar />
          <main className="flex min-h-0 flex-1 flex-col">
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
          <SiteFooter />
        </body>
      </html>
    </ClerkProvider>
  );
}

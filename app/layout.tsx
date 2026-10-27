import type { Metadata } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { ui } from "@clerk/ui"
import { shadcn } from "@clerk/ui/themes"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import { ClerkFix } from "@/components/clerk-fix"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "MIRA | AI Teammate Platform",
  description:
    "Multi-agent AI collaboration platform with cloud sandboxes and computer use.",
  icons: {
    icon: [
      {
        url: "/logo.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
}

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.next = window.next || {};
              window.next.version = "16.4.3";
              try {
                Object.defineProperty(window, '__internal_onBeforeSetActive', {
                  configurable: false,
                  enumerable: true,
                  get: function() { return function() { return Promise.resolve(); }; },
                  set: function() {}
                });
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ClerkProvider
          ui={ui}
          appearance={{
            theme: shadcn,
            options: {
              unsafe_disableDevelopmentModeWarnings: true,
            },
          }}
        >
          <ClerkFix />
          <ThemeProvider>
            <TooltipProvider>
              <Toaster>{children}</Toaster>
            </TooltipProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}

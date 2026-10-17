import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import { NavHeader } from "@/components/nav-header"

export const metadata: Metadata = {
  title: {
    default: "WatchedSeerr | Media Retention & Lifecycle Auditor",
    template: "%s | WatchedSeerr",
  },
  description:
    "Automated media retention and lifecycle auditor bridging Jellyfin playback history with Overseerr request management.",
  keywords: [
    "Jellyfin",
    "Overseerr",
    "Jellyseerr",
    "Media Retention",
    "Disk Cleanup",
    "Media Lifecycle",
    "Audit Queue",
  ],
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "WatchedSeerr | Media Retention & Lifecycle Auditor",
    description:
      "Automated media retention and lifecycle auditor bridging Jellyfin playback history with Overseerr request management.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "WatchedSeerr",
    description:
      "Automated media retention and lifecycle auditor bridging Jellyfin playback history with Overseerr request management.",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans antialiased">
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster>
              <div className="flex min-h-screen flex-col bg-background text-foreground">
                <NavHeader />
                {children}
              </div>
            </Toaster>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

import type { Metadata, Viewport } from "next"
import { Fira_Sans, Ubuntu_Mono, Zen_Dots } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import { NavHeader } from "@/components/nav-header"
import { cn } from "@/lib/utils"

const zenDots = Zen_Dots({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-title",
})

const firaSans = Fira_Sans({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
})

const ubuntuMono = Ubuntu_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "WatchedSeerr | Media Retention & Lifecycle Auditor",
    template: "%s | WatchedSeerr",
  },
  description:
    "Automated media retention and lifecycle auditor bridging Jellyfin playback history with Seerr request management.",
  keywords: [
    "Jellyfin",
    "Overseerr",
    "Jellyseerr",
    "Seerr",
    "Media Retention",
    "Disk Cleanup",
    "Media Lifecycle",
    "Audit Queue",
    "Arr Stack",
    "Radarr",
    "Sonarr",
    "Media server"
  ],
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WatchedSeerr",
  },
  openGraph: {
    title: "WatchedSeerr | Media Retention & Lifecycle Auditor",
    description:
      "Automated media retention and lifecycle auditor bridging Jellyfin playback history with Seerr request management.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "WatchedSeerr",
    description:
      "Automated media retention and lifecycle auditor bridging Jellyfin playback history with Seerr request management.",
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
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        zenDots.variable,
        firaSans.variable,
        ubuntuMono.variable
      )}
    >
      <head>
        <meta name="text-scale" content="scale" />
      </head>
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

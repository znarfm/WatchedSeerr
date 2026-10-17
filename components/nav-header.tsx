"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconLayoutGrid } from "@tabler/icons-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

export function NavHeader() {
  const pathname = usePathname()
  const isMatrix = pathname === "/matrix"
  const isQueue = pathname === "/"

  const [isVisible, setIsVisible] = React.useState(true)
  const lastScrollY = React.useRef(0)

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY <= 10) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setIsVisible(false)
      } else if (currentScrollY < lastScrollY.current) {
        setIsVisible(true)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur px-4 py-2.5 transition-transform duration-200 ease-in-out sm:px-6 sm:py-3",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <Logo />
          <div>
            <span className="block text-sm font-semibold tracking-tight uppercase">
              WatchedSeerr
            </span>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Media retention &amp; lifecycle auditor
            </p>
          </div>
        </Link>

        <nav aria-label="Main Navigation" className="flex items-center gap-2">
          <Link
            href="/"
            className={cn(
              "px-2.5 py-1 text-xs font-medium transition-colors",
              isQueue
                ? "border border-primary bg-primary/10 text-primary"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Audit Queue
          </Link>
          <Link
            href="/matrix"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors",
              isMatrix
                ? "border border-primary bg-primary/10 text-primary"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <IconLayoutGrid className="size-3.5" />
            Watch Matrix
          </Link>
        </nav>
      </div>
    </header>
  )
}

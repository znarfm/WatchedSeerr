import { auditMedia } from "@/lib/audit"
import { DataTable } from "@/components/audit-table/data-table"
import Link from "next/link"
import { IconLayoutGrid } from "@tabler/icons-react"

export const dynamic = "force-dynamic"

export default async function Page() {
  let report = null
  let errorMessage = ""

  try {
    report = await auditMedia()
  } catch (err: any) {
    errorMessage = err?.message || "Failed to connect to Jellyfin or Seerr API"
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Navigation Bar */}
      <header className="border-b border-border bg-muted/20 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center bg-primary font-mono text-sm font-bold text-primary-foreground">
              WS
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight uppercase">
                WatchedSeerr
              </h1>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                Media retention & lifecycle auditor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              Audit Queue
            </Link>
            <Link
              href="/matrix"
              className="flex items-center gap-1.5 border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <IconLayoutGrid className="size-3.5" />
              Watch Matrix
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 p-3 sm:space-y-6 sm:p-6">
        {errorMessage ? (
          <div className="space-y-2 border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive">
            <div className="font-semibold tracking-wider uppercase">
              Connection Notice
            </div>
            <p>{errorMessage}</p>
            <p className="text-muted-foreground">
              Configure your{" "}
              <code className="font-mono text-foreground">.env.local</code> with
              valid{" "}
              <code className="font-mono text-foreground">JELLYFIN_URL</code>,{" "}
              <code className="font-mono text-foreground">
                JELLYFIN_API_KEY
              </code>
              , <code className="font-mono text-foreground">SEERR_URL</code>,
              and{" "}
              <code className="font-mono text-foreground">SEERR_API_KEY</code>{" "}
              credentials.
            </p>
          </div>
        ) : report ? (
          <DataTable initialData={report.items} />
        ) : null}
      </main>
    </div>
  )
}

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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-border bg-muted/20 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center bg-primary text-primary-foreground font-mono font-bold text-sm">
              WS
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight uppercase">
                WatchedSeerr
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Media retention & lifecycle auditor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-2.5 py-1 text-xs border border-primary bg-primary/10 text-primary font-medium"
            >
              Audit Queue
            </Link>
            <Link
              href="/matrix"
              className="px-2.5 py-1 text-xs border border-border hover:bg-muted text-muted-foreground font-medium flex items-center gap-1.5"
            >
              <IconLayoutGrid className="size-3.5" />
              Watch Matrix
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {errorMessage ? (
          <div className="border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive space-y-2">
            <div className="font-semibold uppercase tracking-wider">Connection Notice</div>
            <p>{errorMessage}</p>
            <p className="text-muted-foreground">
              Configure your <code className="font-mono text-foreground">.env.local</code> with valid <code className="font-mono text-foreground">JELLYFIN_URL</code>, <code className="font-mono text-foreground">JELLYFIN_API_KEY</code>, <code className="font-mono text-foreground">SEERR_URL</code>, and <code className="font-mono text-foreground">SEERR_API_KEY</code> credentials.
            </p>
          </div>
        ) : report ? (
          <DataTable initialData={report.items} />
        ) : null}
      </main>
    </div>
  )
}

import { auditMedia } from "@/lib/audit"
import { DataTable } from "@/components/audit-table/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { IconDeviceTv, IconLayoutGrid, IconRefresh } from "@tabler/icons-react"

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
        {/* Metric Cards */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/10">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-normal">
                  Total Audited
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <span className="text-2xl font-bold font-mono">{report.totalItems}</span>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-[11px] uppercase tracking-wider text-emerald-400 font-normal">
                  Safe to Purge
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {report.safeCount}
                </span>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-[11px] uppercase tracking-wider text-amber-400 font-normal">
                  Active Conflicts
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <span className="text-2xl font-bold font-mono text-amber-400">
                  {report.conflictCount}
                </span>
              </CardContent>
            </Card>

            <Card className="border-rose-500/20 bg-rose-500/5">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-[11px] uppercase tracking-wider text-rose-400 font-normal">
                  Ghost Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <span className="text-2xl font-bold font-mono text-rose-400">
                  {report.ghostCount}
                </span>
              </CardContent>
            </Card>
          </div>
        )}

        {errorMessage ? (
          <div className="border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive space-y-2">
            <div className="font-semibold uppercase tracking-wider">Connection Notice</div>
            <p>{errorMessage}</p>
            <p className="text-muted-foreground">
              Configure your <code className="font-mono text-foreground">.env.local</code> with valid <code className="font-mono text-foreground">JELLYFIN_URL</code>, <code className="font-mono text-foreground">JELLYFIN_API_KEY</code>, <code className="font-mono text-foreground">SEERR_URL</code>, and <code className="font-mono text-foreground">SEERR_API_KEY</code> credentials.
            </p>
          </div>
        ) : report ? (
          <div className="space-y-4">
            <Separator />
            <DataTable initialData={report.items} />
          </div>
        ) : null}
      </main>
    </div>
  )
}

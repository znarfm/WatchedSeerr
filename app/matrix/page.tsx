import { auditMedia } from "@/lib/audit"
import { WatchMatrix } from "@/components/matrix-table/watch-matrix"
import Link from "next/link"
import { IconLayoutGrid, IconArrowLeft } from "@tabler/icons-react"

export const dynamic = "force-dynamic"

export default async function MatrixPage() {
  let report = null
  let errorMessage = ""

  try {
    report = await auditMedia()
  } catch (err: any) {
    errorMessage = err?.message || "Failed to load audit data"
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="border-b border-border bg-muted/20 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex size-7 items-center justify-center border border-border text-muted-foreground hover:bg-muted"
            >
              <IconArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-sm font-semibold tracking-tight uppercase">
                Watch Matrix
              </h1>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                2D Household playback distribution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Audit Queue
            </Link>
            <Link
              href="/matrix"
              className="flex items-center gap-1.5 border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              <IconLayoutGrid className="size-3.5" />
              Watch Matrix
            </Link>
          </div>
        </div>
      </header>

      {/* Main Grid Matrix */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 p-3 sm:space-y-6 sm:p-6">
        {errorMessage ? (
          <div className="border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive">
            {errorMessage}
          </div>
        ) : (
          report && <WatchMatrix initialData={report.items} />
        )}
      </main>
    </div>
  )
}

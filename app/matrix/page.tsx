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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="border-b border-border bg-muted/20 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex size-7 items-center justify-center border border-border hover:bg-muted text-muted-foreground"
            >
              <IconArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-sm font-semibold tracking-tight uppercase">
                Watch Matrix
              </h1>
              <p className="text-[11px] text-muted-foreground">
                2D Household playback distribution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-2.5 py-1 text-xs border border-border hover:bg-muted text-muted-foreground font-medium"
            >
              Audit Queue
            </Link>
            <Link
              href="/matrix"
              className="px-2.5 py-1 text-xs border border-primary bg-primary/10 text-primary font-medium flex items-center gap-1.5"
            >
              <IconLayoutGrid className="size-3.5" />
              Watch Matrix
            </Link>
          </div>
        </div>
      </header>

      {/* Main Grid Matrix */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-4">
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

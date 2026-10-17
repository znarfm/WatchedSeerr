import type { Metadata } from "next"
import { auditMedia } from "@/lib/audit"
import { WatchMatrix } from "@/components/matrix-table/watch-matrix"
import { isDeleteDisabled } from "@/lib/utils"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Watch Matrix",
  description: "2D Household playback distribution matrix.",
}

export default async function MatrixPage() {
  let report = null
  let errorMessage = ""

  try {
    report = await auditMedia()
  } catch (err: unknown) {
    errorMessage =
      err instanceof Error ? err.message : "Failed to load audit data"
  }

  const disableDelete = isDeleteDisabled()

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 p-3 sm:space-y-6 sm:p-6">
      {errorMessage ? (
        <div className="border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive">
          {errorMessage}
        </div>
      ) : (
        report && (
          <WatchMatrix
            initialData={report.items}
            disableDelete={disableDelete}
          />
        )
      )}
    </main>
  )
}

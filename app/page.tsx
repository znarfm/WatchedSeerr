import { auditMedia } from "@/lib/audit"
import { DataTable } from "@/components/audit-table/data-table"
import { isDeleteDisabled } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function Page() {
  let report = null
  let errorMessage = ""

  try {
    report = await auditMedia()
  } catch (err: any) {
    errorMessage = err?.message || "Failed to connect to Jellyfin or Seerr API"
  }

  const disableDelete = isDeleteDisabled()

  return (
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
            <code className="font-mono text-foreground">JELLYFIN_API_KEY</code>,{" "}
            <code className="font-mono text-foreground">SEERR_URL</code>, and{" "}
            <code className="font-mono text-foreground">SEERR_API_KEY</code>{" "}
            credentials.
          </p>
        </div>
      ) : report ? (
        <DataTable initialData={report.items} disableDelete={disableDelete} />
      ) : null}
    </main>
  )
}

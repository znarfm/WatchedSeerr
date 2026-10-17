import { auditMedia } from "@/lib/audit"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

  // Extract unique users across all items
  const allUsernames = Array.from(
    new Set(
      report?.items.flatMap((item) => [
        item.requester.username,
        ...item.householdStates.map((h) => h.username),
      ]) || []
    )
  ).sort()

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
        ) : report && (
          <div className="border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="p-3 uppercase text-muted-foreground min-w-[200px]">
                    Requested Media
                  </TableHead>
                  {allUsernames.map((user) => (
                    <TableHead
                      key={user}
                      className="p-3 uppercase text-muted-foreground text-center min-w-[100px] border-l border-border/50"
                    >
                      {user}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="p-3 font-medium">
                      <div className="truncate max-w-[220px]" title={item.title}>
                        {item.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">
                        {item.mediaType} • Req: {item.requester.username}
                      </div>
                    </TableCell>

                    {allUsernames.map((username) => {
                      const isRequester =
                        item.requester.username.toLowerCase() === username.toLowerCase()
                      const state = isRequester
                        ? item.requesterState
                        : item.householdStates.find(
                            (h) => h.username.toLowerCase() === username.toLowerCase()
                          )

                      const progress = state?.progressPercent ?? 0
                      const status = state?.status ?? "unplayed"

                      return (
                        <TableCell
                          key={username}
                          className={`p-2.5 text-center border-l border-border/50 ${
                            isRequester ? "bg-primary/5" : ""
                          }`}
                        >
                          <div
                            className={`inline-flex flex-col items-center justify-center p-1 w-full border text-[11px] ${
                              status === "completed"
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-semibold"
                                : status === "in_progress"
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-400 font-semibold"
                                : "bg-muted/10 border-border text-muted-foreground"
                            } ${isRequester ? "ring-1 ring-primary/60" : ""}`}
                            title={`${username}: ${status} (${progress}%) ${isRequester ? "[Requester]" : ""}`}
                          >
                            <span>{progress}%</span>
                            <span className="text-[9px] uppercase tracking-tighter opacity-70">
                              {status === "in_progress" ? "in-prog" : status}
                            </span>
                          </div>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  )
}

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IconArrowLeft } from "@tabler/icons-react"

export default function MatrixLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="border-b border-border bg-muted/20 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center border border-border text-muted-foreground opacity-60">
              <IconArrowLeft className="size-4" />
            </div>
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
            <div className="border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground opacity-60">
              Audit Queue
            </div>
            <div className="flex items-center gap-1.5 border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              Watch Matrix
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Matrix */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 p-3 sm:p-6">
        {/* Toolbar Skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-muted/20 p-3">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <Skeleton className="h-8 w-full sm:w-64" />
            <Skeleton className="h-8 w-full sm:w-28" />
            <Skeleton className="h-8 w-full sm:w-28" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0" />
        </div>

        {/* 10-Row Matrix Table Skeleton with Sticky Media Column + 4 User Columns */}
        <div className="overflow-x-auto border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-20 min-w-50 border-r border-border bg-card p-3 sm:min-w-65">
                  <Skeleton className="h-4 w-20" />
                </TableHead>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableHead
                    key={i}
                    className="min-w-25 border-r border-border p-2 text-center"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Skeleton className="size-6 rounded-full" />
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-2.5 w-14" />
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell className="sticky left-0 z-10 border-r border-border bg-card p-2 sm:p-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Skeleton className="h-11 w-8 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <Skeleton className="h-3.5 w-28 sm:w-36" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </div>
                  </TableCell>
                  {Array.from({ length: 4 }).map((_, uIdx) => (
                    <TableCell
                      key={uIdx}
                      className="border-r border-border p-2 text-center"
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="h-1.5 w-12" />
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  )
}

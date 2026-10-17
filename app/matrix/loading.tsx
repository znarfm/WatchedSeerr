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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
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
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                2D Household playback distribution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 text-xs border border-border text-muted-foreground font-medium opacity-60">
              Audit Queue
            </div>
            <div className="px-2.5 py-1 text-xs border border-primary bg-primary/10 text-primary font-medium flex items-center gap-1.5">
              Watch Matrix
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Matrix */}
      <main className="flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto space-y-4">
        {/* Toolbar Skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 border border-border">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Skeleton className="h-8 w-full sm:w-64" />
            <Skeleton className="h-8 w-full sm:w-28" />
            <Skeleton className="h-8 w-full sm:w-28" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0" />
        </div>

        {/* 10-Row Matrix Table Skeleton with Sticky Media Column + 4 User Columns */}
        <div className="border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-20 bg-card min-w-50 sm:min-w-65 border-r border-border p-3">
                  <Skeleton className="h-4 w-20" />
                </TableHead>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableHead key={i} className="text-center min-w-25 border-r border-border p-2">
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
                  <TableCell className="sticky left-0 z-10 bg-card border-r border-border p-2 sm:p-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Skeleton className="w-8 h-11 shrink-0" />
                      <div className="space-y-1 min-w-0 flex-1">
                        <Skeleton className="h-3.5 w-28 sm:w-36" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </div>
                  </TableCell>
                  {Array.from({ length: 4 }).map((_, uIdx) => (
                    <TableCell key={uIdx} className="text-center border-r border-border p-2">
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

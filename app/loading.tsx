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

export default function Loading() {
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
                Media retention &amp; lifecycle auditor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              Audit Queue
            </div>
            <div className="flex items-center gap-1.5 border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground opacity-60">
              Watch Matrix
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 p-3 sm:space-y-6 sm:p-6">
        {/* Metric Cards Skeleton Grid (5 cards) */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          <div className="col-span-2 space-y-2 border border-border bg-muted/10 p-3 sm:col-span-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 border border-border bg-muted/10 p-3"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>

        {/* Toolbar Skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-muted/20 p-3">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <Skeleton className="h-8 w-full sm:w-64" />
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <Skeleton className="h-8 w-full sm:w-28" />
              <Skeleton className="h-8 w-full sm:w-28" />
              <Skeleton className="h-8 w-full sm:w-28" />
              <Skeleton className="h-8 w-full sm:w-28" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 shrink-0" />
        </div>

        {/* Table Skeleton (10 rows) */}
        <div className="overflow-hidden border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Skeleton className="size-4" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-3.5 w-24" />
                </TableHead>
                <TableHead className="w-40">
                  <Skeleton className="h-3.5 w-20" />
                </TableHead>
                <TableHead className="w-44">
                  <Skeleton className="h-3.5 w-28" />
                </TableHead>
                <TableHead className="hidden w-28 md:table-cell">
                  <Skeleton className="h-3.5 w-16" />
                </TableHead>
                <TableHead className="hidden w-36 md:table-cell">
                  <Skeleton className="h-3.5 w-14" />
                </TableHead>
                <TableHead className="hidden w-28 lg:table-cell">
                  <Skeleton className="h-3.5 w-16" />
                </TableHead>
                <TableHead className="hidden w-24 sm:table-cell">
                  <Skeleton className="h-3.5 w-14" />
                </TableHead>
                <TableHead className="w-28">
                  <Skeleton className="h-3.5 w-16" />
                </TableHead>
                <TableHead className="w-10">
                  <Skeleton className="size-4" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell className="w-12">
                    <Skeleton className="size-4" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-12 w-9 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-32 sm:w-44" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="w-40">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-5 shrink-0 rounded-full" />
                      <Skeleton className="h-3.5 w-16" />
                    </div>
                  </TableCell>
                  <TableCell className="w-44">
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-8" />
                      </div>
                      <Skeleton className="h-1.5 w-full" />
                    </div>
                  </TableCell>
                  <TableCell className="hidden w-28 md:table-cell">
                    <div className="flex -space-x-1">
                      <Skeleton className="size-5 rounded-full" />
                      <Skeleton className="size-5 rounded-full" />
                    </div>
                  </TableCell>
                  <TableCell className="hidden w-36 md:table-cell">
                    <Skeleton className="h-3.5 w-14" />
                  </TableCell>
                  <TableCell className="hidden w-28 lg:table-cell">
                    <Skeleton className="h-3.5 w-16" />
                  </TableCell>
                  <TableCell className="hidden w-24 sm:table-cell">
                    <Skeleton className="h-3.5 w-12" />
                  </TableCell>
                  <TableCell className="w-28">
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell className="w-10">
                    <Skeleton className="size-7" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  )
}

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

export default function MatrixLoading() {
  return (
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
                <TableHead className="sticky left-0 z-20 w-32 min-w-32 max-w-32 border-r border-border bg-card p-2 sm:w-auto sm:min-w-65 sm:max-w-none sm:p-3">
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
                  <TableCell className="sticky left-0 z-10 w-32 min-w-32 max-w-32 border-r border-border bg-card p-2 sm:w-auto sm:min-w-65 sm:max-w-none sm:p-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Skeleton className="h-11 w-8 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <Skeleton className="h-3.5 w-20 sm:w-36" />
                        <Skeleton className="hidden h-2.5 w-16 sm:block" />
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
  )
}

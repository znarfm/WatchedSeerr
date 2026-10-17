"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Progress } from "@/components/ui/progress"
import { columns, type TableMeta } from "./columns"
import { toggleWhitelistAction, deleteMediaAction } from "@/lib/actions"
import type { AuditMediaItem, ConflictStatus } from "@/types"
import {
  IconChevronLeft,
  IconChevronRight,
  IconUser,
} from "@tabler/icons-react"

interface DataTableProps {
  initialData: AuditMediaItem[]
}

export function DataTable({ initialData }: DataTableProps) {
  const [data, setData] = React.useState<AuditMediaItem[]>(initialData)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState({})
  const [selectedItem, setSelectedItem] = React.useState<AuditMediaItem | null>(null)
  const [isPending, startTransition] = React.useTransition()

  const handleToggleWhitelist = (item: AuditMediaItem) => {
    startTransition(async () => {
      const res = await toggleWhitelistAction({
        id: item.id,
        tmdbId: item.tmdbId,
        title: item.title,
        mediaType: item.mediaType,
      })
      if (res.success && res.isWhitelisted !== undefined) {
        setData((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isWhitelisted: res.isWhitelisted as boolean } : i))
        )
      }
    })
  }

  const handleDelete = (item: AuditMediaItem) => {
    if (!confirm(`Are you sure you want to delete ${item.title}?`)) return
    startTransition(async () => {
      const res = await deleteMediaAction({
        id: item.id,
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
      })
      if (res.success) {
        setData((prev) => prev.filter((i) => i.id !== item.id))
        if (selectedItem?.id === item.id) setSelectedItem(null)
      }
    })
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    meta: {
      onToggleWhitelist: handleToggleWhitelist,
      onDelete: handleDelete,
      onSelectRow: setSelectedItem,
      isPending,
    } satisfies TableMeta,
  })

  const currentTypeFilter = (table.getColumn("title")?.getFilterValue() as string) || "all"
  const currentStatusFilter = (table.getColumn("status")?.getFilterValue() as string) || "all"

  return (
    <div className="space-y-4">
      {/* Search & Faceted Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 border border-border">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search by title..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 w-52 bg-background border border-border px-2 text-xs focus:outline-none focus:border-ring"
          />

          <div className="flex items-center border border-border bg-background">
            {(["all", "movie", "tv"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  // Filter by mediaType
                  const col = table.getColumn("mediaType")
                  if (t === "all") {
                    table.setColumnFilters((prev) => prev.filter((f) => f.id !== "mediaType"))
                  } else {
                    table.setColumnFilters((prev) => [
                      ...prev.filter((f) => f.id !== "mediaType"),
                      { id: "mediaType", value: t },
                    ])
                  }
                }}
                className="px-2.5 py-1 text-xs uppercase text-muted-foreground hover:text-foreground"
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center border border-border bg-background">
            {(["all", "safe", "conflict", "ghost"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  const col = table.getColumn("status")
                  col?.setFilterValue(s === "all" ? undefined : s)
                }}
                className={`px-2 py-1 text-xs uppercase ${
                  (table.getColumn("status")?.getFilterValue() || "all") === s
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Selected rows batch count */}
        {table.getFilteredSelectedRowModel().rows.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-mono">
              {table.getFilteredSelectedRowModel().rows.length} selected
            </span>
          </div>
        )}
      </div>

      {/* TanStack Data Table */}
      <div className="border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  No matching media items found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedItem(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="font-mono">
          Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())} (
          {table.getFilteredRowModel().rows.length} items)
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <IconChevronLeft className="size-3 mr-0.5" /> Previous
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next <IconChevronRight className="size-3 ml-0.5" />
          </Button>
        </div>
      </div>

      {/* Slide-over Detail Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        {selectedItem && (
          <SheetContent className="sm:max-w-md w-full">
            <SheetHeader>
              <SheetTitle className="text-base font-semibold">{selectedItem.title}</SheetTitle>
              <SheetDescription className="text-xs">
                Requested by {selectedItem.requester.username} • TMDB {selectedItem.tmdbId}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div
                className={`p-3 text-xs border ${
                  selectedItem.conflictStatus === "safe"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : selectedItem.conflictStatus === "conflict"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
              >
                <span className="font-semibold uppercase tracking-wider block mb-1">
                  {selectedItem.conflictStatus} Status
                </span>
                {selectedItem.conflictReason}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Household Playback Breakdown
                </h4>
                <div className="space-y-3">
                  <div className="p-2.5 bg-muted/40 border border-primary/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1.5">
                        <IconUser className="size-3.5 text-primary" />
                        {selectedItem.requester.username} (Requester)
                      </span>
                      <span className="font-mono text-xs">
                        {selectedItem.requesterState.progressPercent}%
                      </span>
                    </div>
                    <Progress
                      value={selectedItem.requesterState.progressPercent}
                      className="h-1.5"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Status: {selectedItem.requesterState.status}</span>
                      <span>
                        Last played:{" "}
                        {selectedItem.requesterState.lastPlayedDate
                          ? new Date(selectedItem.requesterState.lastPlayedDate).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                  </div>

                  {selectedItem.householdStates.map((user) => (
                    <div
                      key={user.userId}
                      className="p-2.5 bg-muted/20 border border-border space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium flex items-center gap-1.5">
                          <IconUser className="size-3.5 text-muted-foreground" />
                          {user.username}
                        </span>
                        <span className="font-mono text-xs">{user.progressPercent}%</span>
                      </div>
                      <Progress value={user.progressPercent} className="h-1.5" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Status: {user.status}</span>
                        <span>
                          Last played:{" "}
                          {user.lastPlayedDate
                            ? new Date(user.lastPlayedDate).toLocaleDateString()
                            : "Never"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleWhitelist(selectedItem)}
                >
                  {selectedItem.isWhitelisted ? "Remove Whitelist" : "Whitelist Media"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selectedItem)}
                >
                  Purge Media
                </Button>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  )
}

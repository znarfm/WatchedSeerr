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
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
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
  IconSearch,
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
  const [deleteCandidate, setDeleteCandidate] = React.useState<AuditMediaItem | null>(null)
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
    setDeleteCandidate(item)
  }

  const confirmDelete = () => {
    if (!deleteCandidate) return
    const item = deleteCandidate
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
      setDeleteCandidate(null)
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

  const currentTypeFilter =
    (table.getColumn("mediaType")?.getFilterValue() as string) || "all"
  const currentStatusFilter =
    (table.getColumn("status")?.getFilterValue() as string) || "all"

  return (
    <div className="space-y-4">
      {/* Search & Faceted Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 border border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-56">
            <Input
              type="text"
              placeholder="Search by title..."
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
            <IconSearch className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
          </div>

          <Tabs
            value={currentTypeFilter}
            onValueChange={(val) => {
              if (val === "all") {
                table.setColumnFilters((prev) => prev.filter((f) => f.id !== "mediaType"))
              } else {
                table.setColumnFilters((prev) => [
                  ...prev.filter((f) => f.id !== "mediaType"),
                  { id: "mediaType", value: val },
                ])
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="all" className="uppercase text-[11px]">All</TabsTrigger>
              <TabsTrigger value="movie" className="uppercase text-[11px]">Movie</TabsTrigger>
              <TabsTrigger value="tv" className="uppercase text-[11px]">TV</TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs
            value={currentStatusFilter}
            onValueChange={(val) => {
              const col = table.getColumn("status")
              col?.setFilterValue(val === "all" ? undefined : val)
            }}
          >
            <TabsList>
              <TabsTrigger value="all" className="uppercase text-[11px]">All</TabsTrigger>
              <TabsTrigger value="safe" className="uppercase text-[11px]">Safe</TabsTrigger>
              <TabsTrigger value="conflict" className="uppercase text-[11px]">Conflict</TabsTrigger>
              <TabsTrigger value="ghost" className="uppercase text-[11px]">Ghost</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Selected rows batch count */}
        {table.getFilteredSelectedRowModel().rows.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="font-mono">
              {table.getFilteredSelectedRowModel().rows.length} selected
            </Badge>
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
                  <Card className="p-3 bg-muted/40 border border-primary/40 space-y-2">
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
                  </Card>

                  {selectedItem.householdStates.map((user) => (
                    <Card
                      key={user.userId}
                      className="p-3 bg-muted/20 border border-border space-y-2"
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
                    </Card>
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

      {/* Confirmation Dialog for Purge */}
      <Dialog
        open={!!deleteCandidate}
        onOpenChange={(open) => !open && setDeleteCandidate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Media Purge</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteCandidate?.title}
              </span>
              ? This triggers immediate deletion in Radarr/Sonarr and purges local files.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteCandidate(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={confirmDelete}
            >
              Confirm Purge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

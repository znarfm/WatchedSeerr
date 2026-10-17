"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ExpandedState,
  type SortingState,
  type VisibilityState,
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { columns, type TableMeta } from "./columns"
import { toggleWhitelistAction, deleteMediaAction, getSeriesEpisodesAction } from "@/lib/actions"
import type { AuditMediaItem, ConflictStatus } from "@/types"
import {
  IconChevronLeft,
  IconChevronRight,
  IconUser,
  IconSearch,
  IconExternalLink,
  IconMovie,
  IconDeviceTv,
} from "@tabler/icons-react"

interface DataTableProps {
  initialData: AuditMediaItem[]
}

interface DeleteTarget {
  item: AuditMediaItem
  target: "all" | "single_episode"
  episodeFileId?: number
}

export function DataTable({ initialData }: DataTableProps) {
  const [data, setData] = React.useState<AuditMediaItem[]>(initialData)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState({})
  const [expanded, setExpanded] = React.useState<ExpandedState>({})
  const [loadingEpisodes, setLoadingEpisodes] = React.useState<Record<string, boolean>>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    mediaType: false,
  })
  const [selectedItem, setSelectedItem] = React.useState<AuditMediaItem | null>(null)
  const [deleteCandidate, setDeleteCandidate] = React.useState<DeleteTarget | null>(null)
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

  const handleDelete = (item: AuditMediaItem, target: "all" | "single_episode" = "all", episodeFileId?: number) => {
    setDeleteCandidate({ item, target, episodeFileId })
  }

  const handleToggleExpand = async (item: AuditMediaItem) => {
    if (item.mediaType !== "tv" || !item.jellyfinItemId || (item.subRows && item.subRows.length > 0)) {
      return
    }

    setLoadingEpisodes((prev) => ({ ...prev, [item.id]: true }))
    try {
      const res = await getSeriesEpisodesAction(item.jellyfinItemId, item.tmdbId)
      if (res.success && res.episodes) {
        const episodeSubRows: AuditMediaItem[] = res.episodes.map((ep) => {
          const sNum = String(ep.seasonNumber).padStart(2, "0")
          const eNum = String(ep.episodeNumber).padStart(2, "0")
          return {
            id: ep.id,
            requestId: item.requestId,
            tmdbId: item.tmdbId,
            jellyfinItemId: ep.episodeId,
            title: `S${sNum}E${eNum}: ${ep.name}`,
            mediaType: "tv" as const,
            requestedAt: item.requestedAt,
            requester: item.requester,
            requesterState: {
              userId: item.requesterState.userId,
              username: item.requesterState.username,
              isRequester: true,
              status: ep.status,
              progressPercent: ep.progressPercent,
              lastPlayedDate: ep.lastPlayedDate,
              playCount: ep.status === "completed" ? 1 : 0,
            },
            householdStates: [],
            daysSinceLastPlayed: null,
            conflictStatus: ep.status === "in_progress" ? "conflict" : ep.status === "completed" ? "safe" : "ghost",
            conflictReason: `Episode status: ${ep.status}`,
            isWhitelisted: item.isWhitelisted,
            episodes: [ep],
          }
        })

        setData((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, episodes: res.episodes, subRows: episodeSubRows } : i
          )
        )
      }
    } finally {
      setLoadingEpisodes((prev) => ({ ...prev, [item.id]: false }))
    }
  }

  const confirmDelete = () => {
    if (!deleteCandidate) return
    const { item, target, episodeFileId } = deleteCandidate
    startTransition(async () => {
      const res = await deleteMediaAction({
        id: item.id,
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        target,
        episodeFileId,
      })
      if (res.success) {
        if (target === "single_episode") {
          // Remove single subRow from parent
          setData((prev) =>
            prev.map((parent) => ({
              ...parent,
              subRows: parent.subRows?.filter((sub) => sub.id !== item.id),
              episodes: parent.episodes?.filter((ep) => ep.id !== item.id),
            }))
          )
        } else {
          // Remove entire parent row
          setData((prev) => prev.filter((i) => i.id !== item.id))
          if (selectedItem?.id === item.id) setSelectedItem(null)
        }
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
      columnVisibility,
      expanded,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    meta: {
      onToggleWhitelist: handleToggleWhitelist,
      onDelete: handleDelete,
      onSelectRow: setSelectedItem,
      onToggleExpand: handleToggleExpand,
      loadingEpisodes,
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
          <SheetContent className="sm:max-w-md w-full overflow-y-auto">
            {(() => {
              const posterUrl = selectedItem.jellyfinItemId
                ? `/api/proxy/poster?jellyfinItemId=${selectedItem.jellyfinItemId}`
                : selectedItem.posterPath
                ? `/api/proxy/poster?posterPath=${encodeURIComponent(selectedItem.posterPath)}`
                : selectedItem.tmdbId
                ? `/api/proxy/poster?tmdbId=${selectedItem.tmdbId}&mediaType=${selectedItem.mediaType}`
                : null

              const sizeGb = selectedItem.sizeBytes
                ? (selectedItem.sizeBytes / (1024 * 1024 * 1024)).toFixed(1) + " GB"
                : null

              const requesterAvatarSrc = selectedItem.requester.requesterAvatarUrl || (
                selectedItem.requester.matchedJellyfinUserId
                  ? `/api/proxy/avatar?userId=${selectedItem.requester.matchedJellyfinUserId}`
                  : selectedItem.requester.avatar
                  ? `/api/proxy/avatar?avatar=${encodeURIComponent(selectedItem.requester.avatar)}`
                  : undefined
              )

              return (
                <>
                  <SheetHeader className="text-left">
                    <div className="flex gap-4">
                      <div className="relative w-20 h-28 shrink-0 overflow-hidden bg-muted border border-border flex items-center justify-center">
                        {posterUrl ? (
                          <img
                            src={posterUrl}
                            alt={selectedItem.title}
                            className="size-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none"
                            }}
                          />
                        ) : selectedItem.mediaType === "tv" ? (
                          <IconDeviceTv className="size-8 text-muted-foreground" />
                        ) : (
                          <IconMovie className="size-8 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex flex-col justify-between min-w-0 flex-1">
                        <div>
                          <SheetTitle className="text-base font-semibold leading-tight line-clamp-2">
                            {selectedItem.title}
                          </SheetTitle>
                          <SheetDescription className="text-xs mt-1">
                            {selectedItem.year && <span>{selectedItem.year} • </span>}
                            <span className="uppercase">{selectedItem.mediaType}</span>
                            {sizeGb && <span> • {sizeGb}</span>}
                          </SheetDescription>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-2">
                          {selectedItem.quality && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                              {selectedItem.quality}
                            </Badge>
                          )}
                          {selectedItem.genres?.map((g) => (
                            <Badge key={g} variant="outline" className="text-[10px] px-1.5 py-0">
                              {g}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="mt-6 space-y-5">
                    {/* Synopsis Overview */}
                    {selectedItem.overview && (
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Overview
                        </h4>
                        <p className="text-xs text-foreground/90 leading-relaxed bg-muted/20 p-2.5 border border-border">
                          {selectedItem.overview}
                        </p>
                      </div>
                    )}

                    {/* Conflict / Retention Status */}
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

                    {/* Household Playback Breakdown */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Household Playback Breakdown
                      </h4>
                      <div className="space-y-3">
                        <Card className="p-3 bg-muted/40 border border-primary/40 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium flex items-center gap-2">
                              <Avatar className="size-5 shrink-0">
                                {requesterAvatarSrc && (
                                  <AvatarImage src={requesterAvatarSrc} alt={selectedItem.requester.username} />
                                )}
                                <AvatarFallback className="text-[10px] uppercase font-mono">
                                  {selectedItem.requester.username.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
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
                              <span className="font-medium flex items-center gap-2">
                                <Avatar className="size-5 shrink-0">
                                  <AvatarImage
                                    src={`/api/proxy/avatar?userId=${user.userId}`}
                                    alt={user.username}
                                  />
                                  <AvatarFallback className="text-[10px] uppercase font-mono">
                                    {user.username.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
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
                </>
              )
            })()}
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
            <DialogTitle>
              {deleteCandidate?.target === "single_episode" ? "Confirm Episode Purge" : "Confirm Media Purge"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteCandidate?.item.title}
              </span>
              ? {deleteCandidate?.target === "single_episode"
                ? "This will delete this episode file from Sonarr disk storage."
                : "This triggers immediate deletion in Radarr/Sonarr and purges local files."}
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

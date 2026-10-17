"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
  type PaginationState,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTableShortcuts } from "@/lib/hooks/use-table-shortcuts"
import { toast } from "@/components/ui/toast"
import {
  MediaDetailSheet,
  type DeleteTarget,
} from "@/components/media-detail-sheet"
import { columns, type TableMeta } from "./columns"
import {
  toggleWhitelistAction,
  getSeriesEpisodesAction,
  refreshAuditAction,
} from "@/lib/actions"
import type { AuditMediaItem, ConflictStatus } from "@/types"
import { cn } from "cn"
import {
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconRefresh,
} from "@tabler/icons-react"

export interface MetricCounts {
  total: number
  safe: number
  newCount: number
  conflict: number
  ghost: number
}

export function computeMetricCounts(items: AuditMediaItem[]): MetricCounts {
  let safe = 0
  let newCount = 0
  let conflict = 0
  let ghost = 0
  for (const item of items) {
    if (item.conflictStatus === "safe") safe++
    else if (item.conflictStatus === "new") newCount++
    else if (item.conflictStatus === "conflict") conflict++
    else if (item.conflictStatus === "ghost") ghost++
  }
  return { total: items.length, safe, newCount, conflict, ghost }
}

export function isSearchShortcut(e: {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  targetTagName?: string
}): boolean {
  const tag = (e.targetTagName || "").toUpperCase()
  const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
    return true
  }
  if (!isEditable && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === "/") {
    return true
  }
  return false
}

export function resolveStatusCardClick(
  currentFilter: ConflictStatus | "all",
  clickedCard: ConflictStatus | "all"
): ConflictStatus | undefined {
  if (clickedCard === "all") return undefined
  return currentFilter === clickedCard ? undefined : clickedCard
}

interface DataTableProps {
  initialData: AuditMediaItem[]
}

export function DataTable({ initialData }: DataTableProps) {
  let router: any = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter()
  } catch {
    router = { refresh: () => {} }
  }

  const [data, setData] = React.useState<AuditMediaItem[]>(initialData)
  React.useEffect(() => {
    setData(initialData)
  }, [initialData])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState({})
  const [expanded, setExpanded] = React.useState<ExpandedState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [loadingEpisodes, setLoadingEpisodes] = React.useState<
    Record<string, boolean>
  >({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      mediaType: false,
      whitelisted: false,
    })
  const [selectedItem, setSelectedItem] = React.useState<AuditMediaItem | null>(
    null
  )
  const [deleteCandidate, setDeleteCandidate] =
    React.useState<DeleteTarget | null>(null)
  const [isPending, startTransition] = React.useTransition()

  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const handleRefresh = React.useCallback(() => {
    setIsRefreshing(true)
    startTransition(async () => {
      try {
        await refreshAuditAction()
        router.refresh()
        try {
          toast.add({
            title: "Audit Refreshed",
            description: "Latest playback and request states loaded.",
            type: "info",
          })
        } catch {}
      } catch (err: any) {
        try {
          toast.add({
            title: "Refresh Failed",
            description: err?.message || "Failed to refresh audit data",
            type: "error",
          })
        } catch {}
      } finally {
        setIsRefreshing(false)
      }
    })
  }, [router])

  useTableShortcuts(searchInputRef, handleRefresh)

  const metricCounts = React.useMemo(() => computeMetricCounts(data), [data])

  const uniqueRequesters = React.useMemo(() => {
    return Array.from(new Set(data.map((d) => d.requester.username))).sort(
      (a, b) => a.localeCompare(b)
    )
  }, [data])

  const handleToggleWhitelist = (item: AuditMediaItem) => {
    startTransition(async () => {
      const res = await toggleWhitelistAction({
        id: item.id,
        tmdbId: item.tmdbId,
        title: item.title,
        mediaType: item.mediaType,
      })
      if (res.success) {
        setData((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, isWhitelisted: res.isWhitelisted as boolean }
              : i
          )
        )
        if (selectedItem?.id === item.id) {
          setSelectedItem((prev) =>
            prev
              ? { ...prev, isWhitelisted: res.isWhitelisted as boolean }
              : prev
          )
        }
        try {
          toast.add({
            title: res.isWhitelisted
              ? "Media Whitelisted"
              : "Removed from Whitelist",
            description: item.title,
            type: "success",
          })
        } catch {}
      } else {
        try {
          toast.add({
            title: "Whitelist Update Failed",
            description: "Failed to update whitelist",
            type: "error",
          })
        } catch {}
      }
    })
  }

  const handleDelete = (
    item: AuditMediaItem,
    target: "all" | "single_episode" = "all",
    episodeFileId?: number
  ) => {
    setDeleteCandidate({ item, target, episodeFileId })
  }

  const handleToggleExpand = async (item: AuditMediaItem) => {
    if (
      item.mediaType !== "tv" ||
      !item.jellyfinItemId ||
      (item.subRows && item.subRows.length > 0)
    ) {
      return
    }

    setLoadingEpisodes((prev) => ({ ...prev, [item.id]: true }))
    try {
      const res = await getSeriesEpisodesAction(
        item.jellyfinItemId,
        item.tmdbId,
        item.requester.matchedJellyfinUserId
      )

      if (res.success && res.episodes) {
        const episodeSubRows: AuditMediaItem[] = res.episodes.map((ep: any) => {
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
            conflictStatus:
              ep.status === "in_progress"
                ? "conflict"
                : ep.status === "completed"
                  ? "safe"
                  : "ghost",
            conflictReason: `Episode status: ${ep.status}`,
            isWhitelisted: item.isWhitelisted,
            episodes: [ep],
            sizeBytes: ep.sizeBytes,
            quality: ep.quality,
            qualityFull: ep.qualityFull,
          }
        })

        setData((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, episodes: res.episodes, subRows: episodeSubRows }
              : i
          )
        )
      }
    } finally {
      setLoadingEpisodes((prev) => ({ ...prev, [item.id]: false }))
    }
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
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    getSubRows: (row) => row.subRows,
    paginateExpandedRows: false,
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
    (table.getColumn("status")?.getFilterValue() as
      ConflictStatus | undefined) || "all"
  const currentRequesterFilter =
    (table.getColumn("requester")?.getFilterValue() as string) || "all"
  const currentWatchStateFilter =
    (table.getColumn("progress")?.getFilterValue() as string) || "all"
  const currentWhitelistFilter =
    (table.getColumn("whitelisted")?.getFilterValue() as string) || "all"

  const handleCardClick = (card: ConflictStatus | "all") => {
    const nextFilter = resolveStatusCardClick(currentStatusFilter, card)
    table.getColumn("status")?.setFilterValue(nextFilter)
  }

  const isFiltered =
    globalFilter !== "" ||
    currentStatusFilter !== "all" ||
    currentTypeFilter !== "all" ||
    currentRequesterFilter !== "all" ||
    currentWatchStateFilter !== "all" ||
    currentWhitelistFilter !== "all"

  return (
    <div className="space-y-4">
      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        <button
          type="button"
          aria-pressed={currentStatusFilter === "all"}
          onClick={() => handleCardClick("all")}
          className="col-span-2 w-full cursor-pointer text-left focus-visible:outline-none sm:col-span-1"
        >
          <Card
            className={cn(
              "transition-colors",
              currentStatusFilter === "all"
                ? "border-primary/50 bg-muted/25 ring-1 ring-primary"
                : "border-border bg-muted/10 hover:bg-muted/20"
            )}
          >
            <CardHeader className="px-3 pt-3 pb-1">
              <CardTitle className="text-[11px] font-normal tracking-wider text-muted-foreground uppercase">
                Total Audited
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <span className="font-mono text-2xl font-bold">
                {metricCounts.total}
              </span>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          aria-pressed={currentStatusFilter === "safe"}
          onClick={() => handleCardClick("safe")}
          className="w-full cursor-pointer text-left focus-visible:outline-none"
        >
          <Card
            className={cn(
              "transition-colors",
              currentStatusFilter === "safe"
                ? "border-emerald-500/40 bg-emerald-500/15 ring-1 ring-emerald-500"
                : "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10"
            )}
          >
            <CardHeader className="px-3 pt-3 pb-1">
              <CardTitle className="text-[11px] font-normal tracking-wider text-emerald-400 uppercase">
                Safe to Purge
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <span className="font-mono text-2xl font-bold text-emerald-400">
                {metricCounts.safe}
              </span>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          aria-pressed={currentStatusFilter === "new"}
          onClick={() => handleCardClick("new")}
          className="w-full cursor-pointer text-left focus-visible:outline-none"
        >
          <Card
            className={cn(
              "transition-colors",
              currentStatusFilter === "new"
                ? "border-sky-500/40 bg-sky-500/15 ring-1 ring-sky-500"
                : "border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10"
            )}
          >
            <CardHeader className="px-3 pt-3 pb-1">
              <CardTitle className="text-[11px] font-normal tracking-wider text-sky-400 uppercase">
                New / Unwatched
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <span className="font-mono text-2xl font-bold text-sky-500">
                {metricCounts.newCount}
              </span>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          aria-pressed={currentStatusFilter === "conflict"}
          onClick={() => handleCardClick("conflict")}
          className="w-full cursor-pointer text-left focus-visible:outline-none"
        >
          <Card
            className={cn(
              "transition-colors",
              currentStatusFilter === "conflict"
                ? "border-amber-500/40 bg-amber-500/15 ring-1 ring-amber-500"
                : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
            )}
          >
            <CardHeader className="px-3 pt-3 pb-1">
              <CardTitle className="text-[11px] font-normal tracking-wider text-amber-400 uppercase">
                Active Conflicts
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <span className="font-mono text-2xl font-bold text-amber-400">
                {metricCounts.conflict}
              </span>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          aria-pressed={currentStatusFilter === "ghost"}
          onClick={() => handleCardClick("ghost")}
          className="w-full cursor-pointer text-left focus-visible:outline-none"
        >
          <Card
            className={cn(
              "transition-colors",
              currentStatusFilter === "ghost"
                ? "border-rose-500/40 bg-rose-500/15 ring-1 ring-rose-500"
                : "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10"
            )}
          >
            <CardHeader className="px-3 pt-3 pb-1">
              <CardTitle className="text-[11px] font-normal tracking-wider text-rose-400 uppercase">
                Ghost Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <span className="font-mono text-2xl font-bold text-rose-400">
                {metricCounts.ghost}
              </span>
            </CardContent>
          </Card>
        </button>
      </div>

      <Separator />

      {/* Search & Faceted Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-muted/20 p-3">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          <div className="relative w-full sm:w-64">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search by title..."
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setGlobalFilter("")
                  e.currentTarget.blur()
                }
              }}
              className="h-8 bg-background pr-16 pl-8 text-xs"
            />
            <IconSearch className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <div className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5">
              {globalFilter ? (
                <Kbd className="h-4 px-1 text-[10px]">Esc</Kbd>
              ) : (
                <KbdGroup>
                  <Kbd className="h-4 px-1 text-[10px]">Ctrl</Kbd>
                  <Kbd className="h-4 px-1 text-[10px]">K</Kbd>
                </KbdGroup>
              )}
            </div>
          </div>

          <Tabs
            value={currentTypeFilter}
            onValueChange={(val) => {
              table
                .getColumn("mediaType")
                ?.setFilterValue(val === "all" ? undefined : val)
            }}
          >
            <TabsList>
              <TabsTrigger value="all" className="text-[11px] uppercase">
                All
              </TabsTrigger>
              <TabsTrigger value="movie" className="text-[11px] uppercase">
                Movie
              </TabsTrigger>
              <TabsTrigger value="tv" className="text-[11px] uppercase">
                TV
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Select
              value={currentRequesterFilter}
              onValueChange={(val) => {
                table
                  .getColumn("requester")
                  ?.setFilterValue(!val || val === "all" ? undefined : val)
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-8 min-w-36 bg-background text-xs"
              >
                <SelectValue placeholder="All Requesters">
                  {(val) => (!val || val === "all" ? "All Requesters" : val)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requesters</SelectItem>
                {uniqueRequesters.map((user) => (
                  <SelectItem key={user} value={user}>
                    {user}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={currentWatchStateFilter}
              onValueChange={(val) => {
                table
                  .getColumn("progress")
                  ?.setFilterValue(!val || val === "all" ? undefined : val)
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-8 min-w-36 bg-background text-xs"
              >
                <SelectValue placeholder="All Watch States">
                  {(val) =>
                    val === "completed"
                      ? "Completed"
                      : val === "in_progress"
                        ? "In Progress"
                        : val === "unplayed"
                          ? "Unplayed"
                          : "All Watch States"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Watch States</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="unplayed">Unplayed</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={currentWhitelistFilter}
              onValueChange={(val) => {
                table
                  .getColumn("whitelisted")
                  ?.setFilterValue(!val || val === "all" ? undefined : val)
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-8 min-w-32 bg-background text-xs"
              >
                <SelectValue placeholder="All Items">
                  {(val) =>
                    val === "whitelisted"
                      ? "Whitelisted"
                      : val === "unprotected"
                        ? "Unprotected"
                        : "All Items"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="whitelisted">Whitelisted</SelectItem>
                <SelectItem value="unprotected">Unprotected</SelectItem>
              </SelectContent>
            </Select>

            {isFiltered && (
              <Button
                variant="ghost"
                size="xs"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setGlobalFilter("")
                  table.resetColumnFilters()
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {table.getFilteredSelectedRowModel().rows.length > 0 && (
            <>
              <Badge variant="secondary" className="font-mono text-xs">
                {table.getFilteredSelectedRowModel().rows.length} selected
              </Badge>
              {([true, false] as const).map((want) => (
                <Button
                  key={String(want)}
                  variant="outline"
                  size="xs"
                  className="h-8 text-xs"
                  disabled={isPending}
                  onClick={() => {
                    table
                      .getFilteredSelectedRowModel()
                      .rows.filter(
                        (r) => r.depth === 0 && !!r.original.isWhitelisted !== want
                      )
                      .forEach((r) => handleToggleWhitelist(r.original))
                    table.resetRowSelection()
                  }}
                >
                  {want ? "Whitelist" : "Unwhitelist"}
                </Button>
              ))}
            </>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="xs"
                  className="h-8 text-xs"
                  disabled={isPending || isRefreshing}
                  onClick={handleRefresh}
                >
                  <IconRefresh
                    className={cn(
                      "mr-1 size-3.5",
                      isRefreshing && "animate-spin"
                    )}
                  />
                  Refresh
                </Button>
              }
            />
            <TooltipContent className="flex items-center gap-1.5">
              <span>Refresh audit data</span>
              <KbdGroup>
                <Kbd className="h-4 px-1 text-[10px]">Alt</Kbd>
                <Kbd className="h-4 px-1 text-[10px]">R</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* TanStack Data Table */}
      <div className="border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={(header.column.columnDef.meta as any)?.className}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isRefreshing ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <TableRow key={`refresh-skeleton-${idx}`}>
                  {table.getVisibleFlatColumns().map((col, colIdx) => (
                    <TableCell
                      key={col.id || colIdx}
                      className={(col.columnDef.meta as any)?.className}
                    >
                      {col.id === "select" ? (
                        <div className="flex size-full items-center justify-center p-2">
                          <Skeleton className="size-4" />
                        </div>
                      ) : (
                        <Skeleton className="h-4 w-full" />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  No matching media items found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    data-subrow={row.depth > 0 ? "true" : undefined}
                    className={cn(
                      "group cursor-pointer hover:bg-muted/50",
                      row.depth > 0 && "bg-muted/10 hover:bg-muted/20"
                    )}
                    onClick={() => setSelectedItem(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          (cell.column.columnDef.meta as any)?.className
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {loadingEpisodes[row.original.id] &&
                    Array.from({ length: 3 }).map((_, subIdx) => (
                      <TableRow
                        key={`loading-subrow-${row.id}-${subIdx}`}
                        className="bg-muted/10"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={
                              (cell.column.columnDef.meta as any)?.className
                            }
                          >
                            <Skeleton className="h-4 w-3/4" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="font-mono">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(1, table.getPageCount())} (
            {table.getFilteredRowModel().rows.length} items)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Rows per page:</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(val) => {
                table.setPageSize(Number(val))
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-7 w-20 bg-background text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <IconChevronLeft className="mr-0.5 size-3" /> Previous
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next <IconChevronRight className="ml-0.5 size-3" />
          </Button>
        </div>
      </div>

      {/* Shared Media Detail Sheet & Purge Dialog */}
      <MediaDetailSheet
        selectedItem={selectedItem}
        onClose={() => setSelectedItem(null)}
        onItemUpdated={(itemId, updates) => {
          setData((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
          )
          setSelectedItem((prev) =>
            prev && prev.id === itemId ? { ...prev, ...updates } : prev
          )
        }}
        onItemDeleted={({ item, target, episodeFileId }) => {
          if (target === "single_episode" && episodeFileId) {
            setData((prev) =>
              prev.map((i) =>
                i.id === item.id || i.tmdbId === item.tmdbId
                  ? {
                      ...i,
                      subRows: i.subRows?.filter((sub) => sub.id !== item.id),
                    }
                  : i
              )
            )
          } else {
            setData((prev) => prev.filter((i) => i.id !== item.id))
          }
          setSelectedItem(null)
        }}
        deleteCandidate={deleteCandidate}
        onDeleteCandidateChange={setDeleteCandidate}
      />
    </div>
  )
}

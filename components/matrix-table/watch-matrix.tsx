"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { toast } from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  MediaDetailSheet,
  type DeleteTarget,
} from "@/components/media-detail-sheet"
import {
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconMovie,
  IconDeviceTv,
  IconUser,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { refreshAuditAction } from "@/lib/actions"
import { isDeleteDisabled } from "@/lib/utils"
import { cn } from "cn"
import type { AuditMediaItem, ConflictStatus, UserPlaybackState } from "@/types"

import { isSearchShortcut } from "@/components/audit-table/data-table"
import { useTableShortcuts } from "@/lib/hooks/use-table-shortcuts"

export { isSearchShortcut, useTableShortcuts }

export interface MatrixUserColumn {
  key: string // userId or lowercase username
  userId?: string
  username: string
  avatarUrl?: string
  requestedCount: number
  watchedCount: number
}

export function deriveMatrixUsers(items: AuditMediaItem[]): MatrixUserColumn[] {
  const map = new Map<string, MatrixUserColumn>()

  const ensureUser = (
    userId: string | undefined,
    username: string,
    avatarUrl?: string
  ) => {
    const key = (
      userId && userId !== "unknown" ? userId : username
    ).toLowerCase()
    let entry = map.get(key)
    if (!entry) {
      entry = {
        key,
        userId: userId && userId !== "unknown" ? userId : undefined,
        username,
        avatarUrl,
        requestedCount: 0,
        watchedCount: 0,
      }
      map.set(key, entry)
    } else if (!entry.avatarUrl && avatarUrl) {
      entry.avatarUrl = avatarUrl
    }
    return entry
  }

  for (const item of items) {
    const reqEntry = ensureUser(
      item.requester.matchedJellyfinUserId || item.requesterState.userId,
      item.requester.username,
      item.requester.requesterAvatarUrl || item.requesterState.avatarUrl
    )
    reqEntry.requestedCount++
    if (item.requesterState.status === "completed") {
      reqEntry.watchedCount++
    }

    for (const h of item.householdStates) {
      const hEntry = ensureUser(h.userId, h.username, h.avatarUrl)
      if (h.status === "completed") {
        hEntry.watchedCount++
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.username.localeCompare(b.username)
  )
}

export function getUserCellState(
  item: AuditMediaItem,
  col: MatrixUserColumn
): { state?: UserPlaybackState; isRequester: boolean } {
  const reqId = (
    item.requester.matchedJellyfinUserId ||
    item.requesterState.userId ||
    ""
  ).toLowerCase()
  const isRequester =
    (!!col.userId && reqId === col.userId.toLowerCase()) ||
    item.requester.username.toLowerCase() === col.username.toLowerCase()

  if (isRequester) {
    return { state: item.requesterState, isRequester: true }
  }

  const state = item.householdStates.find(
    (h) =>
      (!!col.userId &&
        !!h.userId &&
        h.userId.toLowerCase() === col.userId.toLowerCase()) ||
      h.username.toLowerCase() === col.username.toLowerCase()
  )
  return { state, isRequester: false }
}

interface WatchMatrixProps {
  initialData: AuditMediaItem[]
  disableDelete?: boolean
}

function useSafeRouter():
  { refresh: () => void } | ReturnType<typeof useRouter> {
  try {
    return useRouter()
  } catch {
    return { refresh: () => {} }
  }
}

export function WatchMatrix({ initialData, disableDelete }: WatchMatrixProps) {
  const effectiveDisableDelete = disableDelete ?? isDeleteDisabled()
  const router = useSafeRouter()
  const [data, setData] = React.useState<AuditMediaItem[]>(initialData)
  const [prevInitialData, setPrevInitialData] = React.useState(initialData)

  if (initialData !== prevInitialData) {
    setPrevInitialData(initialData)
    setData(initialData)
  }
  const [search, setSearch] = React.useState("")
  const [mediaTypeFilter, setMediaTypeFilter] = React.useState<
    "all" | "movie" | "tv"
  >("all")
  const [requesterFilter, setRequesterFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | ConflictStatus
  >("all")
  const [sortField, setSortField] = React.useState<
    "default" | "title" | string
  >("default")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(25)
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
      } catch (err: unknown) {
        try {
          const msg =
            err instanceof Error ? err.message : "Failed to refresh audit data"
          toast.add({
            title: "Refresh Failed",
            description: msg,
            type: "error",
          })
        } catch {}
      } finally {
        setIsRefreshing(false)
      }
    })
  }, [router])

  useTableShortcuts(searchInputRef, handleRefresh)

  // Reconcile user columns from current data
  const userColumns = React.useMemo(() => deriveMatrixUsers(data), [data])

  // Unique requesters for dropdown
  const uniqueRequesters = React.useMemo(() => {
    const set = new Set<string>()
    for (const item of data) {
      if (item.requester?.username) {
        set.add(item.requester.username)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [data])

  // Reset all filters
  const isFiltered =
    search !== "" ||
    mediaTypeFilter !== "all" ||
    requesterFilter !== "all" ||
    statusFilter !== "all" ||
    sortField !== "default"

  const handleReset = () => {
    setSearch("")
    setMediaTypeFilter("all")
    setRequesterFilter("all")
    setStatusFilter("all")
    setSortField("default")
    setSortDir("asc")
    setPageIndex(0)
  }

  // Filtered and sorted rows
  const filteredAndSortedItems = React.useMemo(() => {
    let result = data.filter((item) => {
      if (search.trim()) {
        const query = search.trim().toLowerCase()
        if (!item.title.toLowerCase().includes(query)) {
          return false
        }
      }
      if (mediaTypeFilter !== "all" && item.mediaType !== mediaTypeFilter) {
        return false
      }
      if (
        requesterFilter !== "all" &&
        item.requester.username.toLowerCase() !== requesterFilter.toLowerCase()
      ) {
        return false
      }
      if (statusFilter !== "all" && item.conflictStatus !== statusFilter) {
        return false
      }
      return true
    })

    if (sortField === "title") {
      result = [...result].sort((a, b) => {
        const cmp = a.title.localeCompare(b.title)
        return sortDir === "asc" ? cmp : -cmp
      })
    } else if (sortField !== "default") {
      const col = userColumns.find((c) => c.key === sortField)
      if (col) {
        result = [...result].sort((a, b) => {
          const aState = getUserCellState(a, col).state?.progressPercent ?? 0
          const bState = getUserCellState(b, col).state?.progressPercent ?? 0
          const diff = aState - bState
          if (diff !== 0) {
            return sortDir === "asc" ? diff : -diff
          }
          return a.title.localeCompare(b.title)
        })
      }
    }

    return result
  }, [
    data,
    search,
    mediaTypeFilter,
    requesterFilter,
    statusFilter,
    sortField,
    sortDir,
    userColumns,
  ])

  // Pagination calculation
  const pageCount = Math.max(
    1,
    Math.ceil(filteredAndSortedItems.length / pageSize)
  )
  const clampedPageIndex = Math.min(pageIndex, pageCount - 1)
  const paginatedItems = filteredAndSortedItems.slice(
    clampedPageIndex * pageSize,
    (clampedPageIndex + 1) * pageSize
  )

  // Header click handlers
  const handleTitleHeaderClick = () => {
    if (sortField === "title") {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField("title")
      setSortDir("asc")
    }
    setPageIndex(0)
  }

  const handleUserHeaderClick = (colKey: string) => {
    if (sortField === colKey) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"))
    } else {
      setSortField(colKey)
      setSortDir("desc") // Requirement: desc first, then asc
    }
    setPageIndex(0)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-muted/20 p-3">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          {/* Title search */}
          <div className="relative w-full sm:w-64">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPageIndex(0)
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("")
                  setPageIndex(0)
                  e.currentTarget.blur()
                }
              }}
              className="h-8 bg-background pr-16 pl-8 text-xs"
            />
            <IconSearch className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <div className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5">
              {search ? (
                <Kbd className="h-4 px-1 text-[10px]">Esc</Kbd>
              ) : (
                <KbdGroup>
                  <Kbd className="h-4 px-1 text-[10px]">Ctrl</Kbd>
                  <Kbd className="h-4 px-1 text-[10px]">K</Kbd>
                </KbdGroup>
              )}
            </div>
          </div>

          {/* Media Type Tabs */}
          <Tabs
            value={mediaTypeFilter}
            onValueChange={(val) => {
              setMediaTypeFilter(val as "all" | "movie" | "tv")
              setPageIndex(0)
            }}
          >
            <TabsList>
              <TabsTrigger value="all" className="text-[11px] uppercase">
                All
              </TabsTrigger>
              <TabsTrigger value="movie" className="gap-1 text-[11px] uppercase">
                <IconMovie className="size-3.5" />
                Movie
              </TabsTrigger>
              <TabsTrigger value="tv" className="gap-1 text-[11px] uppercase">
                <IconDeviceTv className="size-3.5" />
                TV
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
            {/* Requester Filter */}
            <Select
              value={requesterFilter}
              onValueChange={(val) => {
                if (val) {
                  setRequesterFilter(val)
                  setPageIndex(0)
                }
              }}
            >
              <SelectTrigger className="h-8 min-w-36 bg-background text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <IconUser className="size-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="All Requesters">
                    {(val: string | null) =>
                      val === "all" || !val ? "All Requesters" : val
                    }
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="all">All Requesters</SelectItem>
                {uniqueRequesters.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Retention Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                if (val) {
                  setStatusFilter(val as "all" | ConflictStatus)
                  setPageIndex(0)
                }
              }}
            >
              <SelectTrigger className="h-8 min-w-32 bg-background text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <IconAlertTriangle className="size-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="All Statuses">
                    {(val: string | null) =>
                      val === "all" || !val
                        ? "All Statuses"
                        : val === "safe"
                          ? "Safe"
                          : val === "new"
                            ? "New"
                            : val === "conflict"
                              ? "Conflict"
                              : "Ghost"
                    }
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="safe">Safe</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="conflict">Conflict</SelectItem>
                <SelectItem value="ghost">Ghost</SelectItem>
              </SelectContent>
            </Select>

            {/* Reset Button */}
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <IconRefresh className="mr-1 size-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Total Count and Refresh */}
        <div className="flex items-center gap-2">
          <div className="mr-1 font-mono text-xs text-muted-foreground">
            {filteredAndSortedItems.length} media items
          </div>
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

      {/* 2D Matrix Table */}
      <div className="overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {/* Sticky Left Requested Media Column */}
              <TableHead
                onClick={handleTitleHeaderClick}
                className="sticky left-0 z-10 w-32 max-w-32 min-w-32 cursor-pointer border-r border-border bg-background p-2 text-muted-foreground uppercase select-none hover:bg-muted/60 sm:w-auto sm:max-w-none sm:min-w-[260px] sm:p-3"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="hidden sm:inline">Requested Media</span>
                  <span className="sm:hidden">Media</span>
                  {sortField === "title" ? (
                    sortDir === "asc" ? (
                      <IconArrowUp className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <IconArrowDown className="size-3.5 shrink-0 text-primary" />
                    )
                  ) : (
                    <IconArrowsSort className="size-3.5 shrink-0 opacity-40" />
                  )}
                </div>
              </TableHead>

              {/* Dynamic User Columns */}
              {userColumns.map((col) => (
                <TableHead
                  key={col.key}
                  onClick={() => handleUserHeaderClick(col.key)}
                  className="min-w-[120px] cursor-pointer border-l border-border/50 p-3 text-center text-muted-foreground uppercase select-none hover:bg-muted/60"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Avatar className="size-6 shrink-0">
                      {col.avatarUrl && (
                        <AvatarImage src={col.avatarUrl} alt={col.username} />
                      )}
                      <AvatarFallback className="font-mono text-[10px] uppercase">
                        {col.username.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1">
                      <span className="max-w-[90px] truncate">
                        {col.username}
                      </span>
                      {sortField === col.key ? (
                        sortDir === "desc" ? (
                          <IconArrowDown className="size-3 shrink-0 text-primary" />
                        ) : (
                          <IconArrowUp className="size-3 shrink-0 text-primary" />
                        )
                      ) : (
                        <IconArrowsSort className="size-3 shrink-0 opacity-40" />
                      )}
                    </div>
                    <span className="font-mono text-[10px] lowercase opacity-75">
                      {col.requestedCount} req • {col.watchedCount} watched
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isRefreshing ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <TableRow key={`refresh-skeleton-${idx}`}>
                  <TableCell className="sticky left-0 z-10 w-32 max-w-32 min-w-32 border-r border-border bg-background p-2 sm:w-auto sm:max-w-none sm:min-w-[260px] sm:p-3">
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                      <Skeleton className="size-7 shrink-0 rounded sm:size-9" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-full sm:w-3/4" />
                        <Skeleton className="hidden h-2.5 w-1/2 sm:block" />
                      </div>
                    </div>
                  </TableCell>
                  {userColumns.map((col) => (
                    <TableCell
                      key={col.key}
                      className="border-l border-border/50 p-2.5 text-center"
                    >
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={1 + userColumns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  No matching media items found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item) => {
                const posterSrc = item.jellyfinItemId
                  ? `/api/proxy/poster?jellyfinItemId=${item.jellyfinItemId}${
                      item.jellyfinImageTag
                        ? `&tag=${encodeURIComponent(item.jellyfinImageTag)}`
                        : ""
                    }`
                  : undefined

                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedItem(item)}
                  >
                    {/* Sticky Requested Media Cell */}
                    <TableCell className="sticky left-0 z-10 w-32 max-w-32 min-w-32 border-r border-border bg-background p-2 font-medium sm:w-auto sm:max-w-none sm:min-w-[260px] sm:p-3">
                      <div className="flex items-center gap-1.5 sm:gap-2.5">
                        {posterSrc ? (
                          <img
                            src={posterSrc}
                            alt={item.title}
                            loading="lazy"
                            className="size-7 shrink-0 rounded bg-muted object-cover sm:size-9"
                          />
                        ) : (
                          <div className="flex size-7 shrink-0 items-center justify-center rounded border border-border bg-muted/60 text-muted-foreground sm:size-9">
                            {item.mediaType === "movie" ? (
                              <IconMovie className="size-4 sm:size-5" />
                            ) : (
                              <IconDeviceTv className="size-4 sm:size-5" />
                            )}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span
                              className="truncate text-xs font-semibold"
                              title={item.title}
                            >
                              {item.title}
                            </span>
                            {item.year && (
                              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                                ({item.year})
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground uppercase">
                            <span>{item.mediaType}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="hidden sm:inline">
                              Req: {item.requester.username}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {item.isWhitelisted && (
                              <Badge
                                variant="outline"
                                className="border-primary/50 px-1 py-0 text-[9px] text-primary"
                              >
                                Whitelisted
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={`px-1 py-0 text-[9px] uppercase ${
                                item.conflictStatus === "safe"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                  : item.conflictStatus === "new"
                                    ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                                    : item.conflictStatus === "conflict"
                                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                      : "border-rose-500/40 bg-rose-500/10 text-rose-400"
                              }`}
                            >
                              {item.conflictStatus === "safe"
                                ? "Safe"
                                : item.conflictStatus === "new"
                                  ? "New"
                                  : item.conflictStatus === "conflict"
                                    ? "Conflict"
                                    : "Ghost"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* User Progress Cells */}
                    {userColumns.map((col) => {
                      const { state, isRequester } = getUserCellState(item, col)
                      const progress = state?.progressPercent ?? 0
                      const status = state?.status ?? "unplayed"
                      const lastPlayed = state?.lastPlayedDate
                        ? new Date(state.lastPlayedDate).toLocaleDateString()
                        : "Never"
                      const playCount = state?.playCount ?? 0

                      return (
                        <TableCell
                          key={col.key}
                          className={`border-l border-border/50 p-2.5 text-center ${
                            isRequester ? "bg-primary/5" : ""
                          }`}
                        >
                          <Tooltip>
                            <TooltipTrigger
                              className={`inline-flex w-full flex-col items-center justify-center border p-1 text-[11px] select-none ${
                                status === "completed"
                                  ? "border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-400"
                                  : status === "in_progress"
                                    ? "border-amber-500/40 bg-amber-500/10 font-semibold text-amber-400"
                                    : "border-border bg-muted/10 text-muted-foreground"
                              } ${isRequester ? "ring-1 ring-primary/60" : ""}`}
                            >
                              <div className="flex items-center gap-1">
                                <span>{progress}%</span>
                                {isRequester && (
                                  <span className="rounded bg-primary px-1 text-[8px] font-bold text-primary-foreground">
                                    REQ
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] tracking-tighter uppercase opacity-70">
                                {status === "in_progress" ? "in-prog" : status}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                              <div className="font-semibold">
                                {col.username}{" "}
                                {isRequester ? "(Requester)" : ""}
                              </div>
                              <div>
                                Status:{" "}
                                {status === "in_progress" ? "in-prog" : status}{" "}
                                ({progress}%)
                              </div>
                              <div>Last played: {lastPlayed}</div>
                              <div>Play count: {playCount}</div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2 text-xs text-muted-foreground">
        <div className="font-mono">
          Page {clampedPageIndex + 1} of {pageCount} (
          {filteredAndSortedItems.length} items)
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span>Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                if (val) {
                  setPageSize(Number(val))
                  setPageIndex(0)
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-7 w-16 bg-background text-xs"
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
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={clampedPageIndex === 0}
            >
              <IconChevronLeft className="mr-0.5 size-3" /> Previous
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                setPageIndex((p) => Math.min(pageCount - 1, p + 1))
              }
              disabled={clampedPageIndex >= pageCount - 1}
            >
              Next <IconChevronRight className="ml-0.5 size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Shared Media Detail Sheet & Purge Dialog */}
      <MediaDetailSheet
        selectedItem={selectedItem}
        disableDelete={effectiveDisableDelete}
        onClose={() => setSelectedItem(null)}
        onItemUpdated={(itemId, updates) => {
          setData((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
          )
          setSelectedItem((prev) =>
            prev && prev.id === itemId ? { ...prev, ...updates } : prev
          )
        }}
        onItemDeleted={({ item }) => {
          setData((prev) => prev.filter((i) => i.id !== item.id))
          setSelectedItem(null)
        }}
        deleteCandidate={deleteCandidate}
        onDeleteCandidateChange={setDeleteCandidate}
      />
    </div>
  )
}

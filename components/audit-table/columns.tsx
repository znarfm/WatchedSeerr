import type { ColumnDef } from "@tanstack/react-table"
import type { AuditMediaItem } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  IconBookmark,
  IconBookmarkFilled,
  IconClock,
  IconDeviceTv,
  IconMovie,
  IconTrash,
  IconUser,
  IconAlertTriangle,
  IconCheck,
  IconGhost,
  IconArrowsSort,
  IconChevronDown,
  IconChevronRight,
  IconLoader2,
} from "@tabler/icons-react"

export interface TableMeta {
  onToggleWhitelist: (item: AuditMediaItem) => void
  onDelete: (item: AuditMediaItem, target?: "all" | "single_episode", episodeFileId?: number) => void
  onSelectRow: (item: AuditMediaItem) => void
  onToggleExpand?: (item: AuditMediaItem) => void
  loadingEpisodes?: Record<string, boolean>
  isPending: boolean
}

export const columns: ColumnDef<AuditMediaItem>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div onClick={(e) => e.stopPropagation()} className="flex items-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => {
      // Don't show selection checkbox for sub-rows (episodes)
      if (row.depth > 0) return null
      return (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(!!checked)}
            aria-label="Select row"
          />
        </div>
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="xs"
        className="text-[11px] font-semibold uppercase tracking-wider p-0 hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Media
        <IconArrowsSort className="ml-1 size-3" />
      </Button>
    ),
    cell: ({ row, table }) => {
      const item = row.original
      const meta = table.options.meta as TableMeta | undefined
      const isSubRow = row.depth > 0
      const isTvSeries = item.mediaType === "tv" && !isSubRow
      const isLoading = meta?.loadingEpisodes?.[item.id]

      if (isSubRow) {
        return (
          <div className="flex items-center gap-2 pl-6">
            <span className="font-mono text-xs text-muted-foreground">↳</span>
            <span className="font-medium text-xs text-foreground truncate">{item.title}</span>
          </div>
        )
      }

      return (
        <div className="flex items-center gap-2">
          {isTvSeries ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-5 p-0 shrink-0 text-muted-foreground hover:text-foreground"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation()
                if (meta?.onToggleExpand) {
                  meta.onToggleExpand(item)
                }
                row.toggleExpanded()
              }}
            >
              {isLoading ? (
                <IconLoader2 className="size-3.5 animate-spin" />
              ) : row.getIsExpanded() ? (
                <IconChevronDown className="size-3.5" />
              ) : (
                <IconChevronRight className="size-3.5" />
              )}
            </Button>
          ) : (
            <div className="size-5 shrink-0" />
          )}

          {(() => {
            const posterUrl = item.jellyfinItemId
              ? `/api/proxy/poster?jellyfinItemId=${item.jellyfinItemId}`
              : item.posterPath
              ? `/api/proxy/poster?posterPath=${encodeURIComponent(item.posterPath)}`
              : item.tmdbId
              ? `/api/proxy/poster?tmdbId=${item.tmdbId}&mediaType=${item.mediaType}`
              : null

            return (
              <div className="relative size-9 shrink-0 overflow-hidden bg-muted border border-border flex items-center justify-center">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={item.title}
                    className="size-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none"
                    }}
                  />
                ) : item.mediaType === "tv" ? (
                  <IconDeviceTv className="size-4 text-muted-foreground" />
                ) : (
                  <IconMovie className="size-4 text-muted-foreground" />
                )}
              </div>
            )
          })()}
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate">{item.title}</span>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {item.year && <span>{item.year}</span>}
              <span>•</span>
              <span className="uppercase">{item.mediaType}</span>
              {item.isWhitelisted && (
                <span className="text-amber-500 font-semibold">• Whitelisted</span>
              )}
            </div>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "mediaType",
    id: "mediaType",
    header: () => null,
    cell: () => null,
    enableHiding: true,
  },
  {
    accessorKey: "requester.username",
    id: "requester",
    header: "Requester",
    cell: ({ row }) => {
      const item = row.original
      const avatarSrc = item.requester.requesterAvatarUrl || (
        item.requester.matchedJellyfinUserId
          ? `/api/proxy/avatar?userId=${item.requester.matchedJellyfinUserId}`
          : item.requester.avatar
          ? `/api/proxy/avatar?avatar=${encodeURIComponent(item.requester.avatar)}`
          : undefined
      )

      return (
        <div className="flex items-center gap-2">
          <Avatar className="size-5 shrink-0">
            {avatarSrc && <AvatarImage src={avatarSrc} alt={item.requester.username} />}
            <AvatarFallback className="text-[10px] uppercase font-mono">
              {item.requester.username.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{item.requester.username}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "requesterState.progressPercent",
    id: "progress",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="xs"
        className="text-[11px] font-semibold uppercase tracking-wider p-0 hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Requester Progress
        <IconArrowsSort className="ml-1 size-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const state = row.original.requesterState
      return (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="capitalize text-muted-foreground">
              {state.status.replace("_", " ")}
            </span>
            <span className="font-mono">{state.progressPercent}%</span>
          </div>
          <Progress value={state.progressPercent} className="h-1.5" />
        </div>
      )
    },
  },
  {
    accessorKey: "daysSinceLastPlayed",
    id: "inactive",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="xs"
        className="text-[11px] font-semibold uppercase tracking-wider p-0 hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Inactive
        <IconArrowsSort className="ml-1 size-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const days = row.original.daysSinceLastPlayed
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <IconClock className="size-3.5 shrink-0" />
          <span>{days !== null ? `${days}d ago` : "Never"}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "conflictStatus",
    id: "status",
    header: "Retention Status",
    cell: ({ row }) => {
      const status = row.original.conflictStatus
      if (status === "safe") {
        return (
          <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 gap-1">
            <IconCheck className="size-3" /> Safe
          </Badge>
        )
      }
      if (status === "conflict") {
        return (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30 gap-1">
            <IconAlertTriangle className="size-3" /> Conflict
          </Badge>
        )
      }
      return (
        <Badge variant="outline" className="text-rose-500 border-rose-500/30 gap-1">
          <IconGhost className="size-3" /> Ghost
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="text-right block">Actions</span>,
    cell: ({ row, table }) => {
      const item = row.original
      const meta = table.options.meta as TableMeta | undefined
      const isSubRow = row.depth > 0
      const sonarrEpisodeFileId = item.episodes?.[0]?.sonarrEpisodeFileId

      return (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {!isSubRow && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={meta?.isPending}
                    onClick={() => meta?.onToggleWhitelist(item)}
                  />
                }
              >
                {item.isWhitelisted ? (
                  <IconBookmarkFilled className="size-4 text-amber-500" />
                ) : (
                  <IconBookmark className="size-4" />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {item.isWhitelisted ? "Remove whitelist" : "Add to whitelist"}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                  disabled={meta?.isPending}
                  onClick={() => {
                    if (isSubRow) {
                      meta?.onDelete(item, "single_episode", sonarrEpisodeFileId)
                    } else {
                      meta?.onDelete(item, "all")
                    }
                  }}
                />
              }
            >
              <IconTrash className="size-4" />
            </TooltipTrigger>
            <TooltipContent>
              {isSubRow ? "Delete episode file" : "Delete media"}
            </TooltipContent>
          </Tooltip>
        </div>
      )
    },
  },
]

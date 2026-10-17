import type { ColumnDef } from "@tanstack/react-table"
import type { AuditMediaItem } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
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
} from "@tabler/icons-react"

export interface TableMeta {
  onToggleWhitelist: (item: AuditMediaItem) => void
  onDelete: (item: AuditMediaItem) => void
  onSelectRow: (item: AuditMediaItem) => void
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
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()} className="flex items-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(!!checked)}
          aria-label="Select row"
        />
      </div>
    ),
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
    cell: ({ row }) => {
      const item = row.original
      return (
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center bg-muted text-muted-foreground">
            {item.mediaType === "tv" ? (
              <IconDeviceTv className="size-4" />
            ) : (
              <IconMovie className="size-4" />
            )}
          </div>
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
      return (
        <div className="flex items-center gap-1.5">
          <IconUser className="size-3.5 text-muted-foreground shrink-0" />
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

      return (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
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

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                  disabled={meta?.isPending}
                  onClick={() => meta?.onDelete(item)}
                />
              }
            >
              <IconTrash className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Delete media</TooltipContent>
          </Tooltip>
        </div>
      )
    },
  },
]

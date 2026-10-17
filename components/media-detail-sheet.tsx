"use client"

import * as React from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/components/ui/toast"
import { toggleWhitelistAction, deleteMediaAction } from "@/lib/actions"
import type { AuditMediaItem, MediaExternalLinks } from "@/types"
import { IconExternalLink } from "@tabler/icons-react"
import { cn, formatMediaSize, isDeleteDisabled } from "@/lib/utils"

export interface DeleteTarget {
  item: AuditMediaItem
  target: "all" | "single_episode"
  episodeFileId?: number
}

export interface MediaDetailSheetProps {
  selectedItem: AuditMediaItem | null
  onClose: () => void
  onItemUpdated: (itemId: string, updates: Partial<AuditMediaItem>) => void
  onItemDeleted: (target: DeleteTarget) => void
  deleteCandidate?: DeleteTarget | null
  onDeleteCandidateChange?: (candidate: DeleteTarget | null) => void
  disableDelete?: boolean
}

export function resolveExternalLinks(item: AuditMediaItem): MediaExternalLinks {
  const fallback: MediaExternalLinks = {
    imdb: item.imdbId
      ? `https://www.imdb.com/title/${item.imdbId}/`
      : undefined,
    letterboxd:
      item.mediaType === "movie"
        ? `https://letterboxd.com/tmdb/${item.tmdbId}/`
        : undefined,
  }

  return {
    ...fallback,
    ...(item.externalLinks || {}),
  }
}

export interface MediaDetailSheetBodyProps {
  selectedItem: AuditMediaItem
  onToggleWhitelist?: () => void
  onPurge?: () => void
  isPending?: boolean
  disableDelete?: boolean
}

export function MediaDetailSheetBody({
  selectedItem,
  onToggleWhitelist,
  onPurge,
  isPending = false,
  disableDelete,
}: MediaDetailSheetBodyProps) {
  const effectiveDisableDelete = disableDelete ?? isDeleteDisabled()
  const links = resolveExternalLinks(selectedItem)
  const formattedSize = formatMediaSize(selectedItem.sizeBytes)

  const posterSrc = selectedItem.jellyfinItemId
    ? `/api/proxy/poster?jellyfinItemId=${selectedItem.jellyfinItemId}&w=400${
        selectedItem.jellyfinImageTag
          ? `&tag=${encodeURIComponent(selectedItem.jellyfinImageTag)}`
          : ""
      }`
    : selectedItem.posterPath
      ? `/api/proxy/poster?posterPath=${encodeURIComponent(selectedItem.posterPath)}`
      : selectedItem.tmdbId
        ? `/api/proxy/poster?tmdbId=${selectedItem.tmdbId}&mediaType=${selectedItem.mediaType}`
        : null

  const formattedRequested = selectedItem.requestedAt
    ? new Date(selectedItem.requestedAt).toLocaleDateString()
    : "—"

  const formattedInactive =
    selectedItem.daysSinceLastPlayed !== null &&
    selectedItem.daysSinceLastPlayed !== undefined
      ? `${selectedItem.daysSinceLastPlayed}d`
      : "Never"

  const statusBannerClass =
    selectedItem.conflictStatus === "safe"
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
      : selectedItem.conflictStatus === "new"
        ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
        : selectedItem.conflictStatus === "conflict"
          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
          : "bg-rose-500/10 border-rose-500/30 text-rose-400"

  return (
    <>
      {/* Pinned Header */}
      <SheetHeader className="shrink-0 space-y-3 border-b border-border bg-popover p-5 pr-10 text-left">
        <div className="flex gap-4">
          <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted">
            {posterSrc ? (
              <img
                src={posterSrc}
                alt={selectedItem.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                {selectedItem.mediaType}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <SheetTitle className="line-clamp-2 text-base leading-snug font-semibold">
              {selectedItem.title}
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-muted-foreground">
              {selectedItem.year && <span>{selectedItem.year} • </span>}
              <span className="uppercase">{selectedItem.mediaType}</span>
              {formattedSize && <span> • {formattedSize}</span>}
            </SheetDescription>

            <div className="mt-2 flex flex-wrap gap-1">
              {(selectedItem.qualityFull || selectedItem.quality) && (
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 font-mono text-[10px]"
                >
                  {selectedItem.qualityFull || selectedItem.quality}
                </Badge>
              )}
              {selectedItem.genres?.map((g) => (
                <Badge
                  key={g}
                  variant="outline"
                  className="px-1.5 py-0 text-[10px]"
                >
                  {g}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* External Service Links Row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {links.jellyfin && (
            <a
              href={links.jellyfin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span>Jellyfin</span>
              <IconExternalLink className="size-3" />
            </a>
          )}
          {links.seerr && (
            <a
              href={links.seerr}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span>Seerr</span>
              <IconExternalLink className="size-3" />
            </a>
          )}
          {selectedItem.mediaType === "movie" && links.arr && (
            <a
              href={links.arr}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span>Radarr</span>
              <IconExternalLink className="size-3" />
            </a>
          )}
          {selectedItem.mediaType === "tv" && links.arr && (
            <a
              href={links.arr}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span>Sonarr</span>
              <IconExternalLink className="size-3" />
            </a>
          )}
          {links.imdb && (
            <a
              href={links.imdb}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span>IMDb</span>
              <IconExternalLink className="size-3" />
            </a>
          )}
          {links.letterboxd && (
            <a
              href={links.letterboxd}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span>Letterboxd</span>
              <IconExternalLink className="size-3" />
            </a>
          )}
        </div>
      </SheetHeader>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* 3-Column Metadata Strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Requested
            </div>
            <div className="mt-1 truncate font-mono text-xs font-medium">
              {formattedRequested}
            </div>
          </div>
          <div className="border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Inactive
            </div>
            <div className="mt-1 truncate font-mono text-xs font-medium">
              {formattedInactive}
            </div>
          </div>
          <div className="border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Protection
            </div>
            <div
              className={cn(
                "mt-1 truncate text-xs font-semibold",
                selectedItem.isWhitelisted
                  ? "text-emerald-400"
                  : "text-muted-foreground"
              )}
            >
              {selectedItem.isWhitelisted ? "Whitelisted" : "Unprotected"}
            </div>
          </div>
        </div>

        {/* Retention Status Banner */}
        <div className={cn("border p-3 text-xs", statusBannerClass)}>
          <span className="mb-1 block font-semibold tracking-wider uppercase">
            {selectedItem.conflictStatus} Status
          </span>
          {selectedItem.conflictReason}
        </div>

        {/* Synopsis Overview */}
        {selectedItem.overview && (
          <div className="space-y-1">
            <h4 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Overview
            </h4>
            <p className="border border-border bg-muted/20 p-2.5 text-xs leading-relaxed text-foreground/90">
              {selectedItem.overview}
            </p>
          </div>
        )}

        {/* Household Playback Breakdown */}
        <div>
          <h4 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Household Playback Breakdown
          </h4>
          <div className="space-y-3">
            <Card className="space-y-2 border border-primary/40 bg-muted/40 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-medium">
                  <Avatar className="size-5 shrink-0">
                    {selectedItem.requester.requesterAvatarUrl && (
                      <AvatarImage
                        src={selectedItem.requester.requesterAvatarUrl}
                        alt={selectedItem.requester.username}
                      />
                    )}
                    <AvatarFallback className="font-mono text-[10px] uppercase">
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
                    ? new Date(
                        selectedItem.requesterState.lastPlayedDate
                      ).toLocaleDateString()
                    : "Never"}
                </span>
              </div>
            </Card>

            {selectedItem.householdStates.map((user) => (
              <Card
                key={user.userId}
                className="space-y-2 border border-border bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium">
                    <Avatar className="size-5 shrink-0">
                      {user.avatarUrl && (
                        <AvatarImage src={user.avatarUrl} alt={user.username} />
                      )}
                      <AvatarFallback className="font-mono text-[10px] uppercase">
                        {user.username.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {user.username}
                  </span>
                  <span className="font-mono text-xs">
                    {user.progressPercent}%
                  </span>
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
      </div>

      {/* Pinned Footer */}
      <SheetFooter className="mt-0 shrink-0 flex-row items-center justify-between gap-2 border-t border-border bg-popover p-4">
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={onToggleWhitelist}
        >
          {selectedItem.isWhitelisted ? "Remove Whitelist" : "Whitelist Media"}
        </Button>
        {!effectiveDisableDelete && (
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={onPurge}
          >
            Purge Media
          </Button>
        )}
      </SheetFooter>
    </>
  )
}

export function MediaDetailSheet({
  selectedItem,
  onClose,
  onItemUpdated,
  onItemDeleted,
  deleteCandidate,
  onDeleteCandidateChange,
  disableDelete,
}: MediaDetailSheetProps) {
  const effectiveDisableDelete = disableDelete ?? isDeleteDisabled()
  const [isPending, startTransition] = React.useTransition()
  const [internalCandidate, setInternalCandidate] =
    React.useState<DeleteTarget | null>(null)

  const candidate =
    deleteCandidate !== undefined ? deleteCandidate : internalCandidate

  const setCandidate = (c: DeleteTarget | null) => {
    if (onDeleteCandidateChange) {
      onDeleteCandidateChange(c)
    }
    setInternalCandidate(c)
  }

  const handleToggleWhitelist = () => {
    if (!selectedItem) return
    const targetItem = selectedItem
    startTransition(async () => {
      try {
        const res = await toggleWhitelistAction({
          id: targetItem.id,
          tmdbId: targetItem.tmdbId,
          title: targetItem.title,
          mediaType: targetItem.mediaType,
        })
        if (res.success) {
          const nextWhitelisted = !!res.isWhitelisted
          onItemUpdated(targetItem.id, { isWhitelisted: nextWhitelisted })
          try {
            toast.add({
              title: nextWhitelisted
                ? "Media Whitelisted"
                : "Removed from Whitelist",
              description: targetItem.title,
              type: "success",
            })
          } catch {}
        } else {
          try {
            const errVal = "error" in res ? (res as any).error : undefined
            const description =
              typeof errVal === "string"
                ? errVal
                : errVal
                  ? JSON.stringify(errVal)
                  : "Failed to update whitelist status"
            toast.add({
              title: "Whitelist Update Failed",
              description,
              type: "error",
            })
          } catch {}
        }
      } catch (err: any) {
        try {
          toast.add({
            title: "Whitelist Update Failed",
            description: err?.message || "Unknown error occurred",
            type: "error",
          })
        } catch {}
      }
    })
  }

  const handlePurge = () => {
    if (effectiveDisableDelete || !selectedItem) return
    setCandidate({ item: selectedItem, target: "all" })
  }

  const confirmDelete = () => {
    if (effectiveDisableDelete || !candidate) return
    const currentCandidate = candidate
    startTransition(async () => {
      try {
        const res = await deleteMediaAction({
          id: currentCandidate.item.id,
          tmdbId: currentCandidate.item.tmdbId,
          mediaType: currentCandidate.item.mediaType,
          target: currentCandidate.target,
          episodeFileId: currentCandidate.episodeFileId,
        })
        if (res.success) {
          onItemDeleted(currentCandidate)
          setCandidate(null)
          if (
            selectedItem?.id === currentCandidate.item.id &&
            currentCandidate.target === "all"
          ) {
            onClose()
          }
          try {
            toast.add({
              title:
                currentCandidate.target === "single_episode"
                  ? "Episode Purged"
                  : "Media Purged",
              description: `${currentCandidate.item.title} was removed.`,
              type: "success",
            })
          } catch {}
        } else {
          try {
            const errVal = "error" in res ? (res as any).error : undefined
            const description =
              typeof errVal === "string"
                ? errVal
                : errVal
                  ? JSON.stringify(errVal)
                  : "Failed to purge media"
            toast.add({
              title: "Purge Failed",
              description,
              type: "error",
            })
          } catch {}
        }
      } catch (err: any) {
        try {
          toast.add({
            title: "Purge Failed",
            description: err?.message || "Unknown error occurred",
            type: "error",
          })
        } catch {}
      }
    })
  }

  return (
    <>
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && onClose()}>
        {selectedItem && (
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
          >
            <MediaDetailSheetBody
              selectedItem={selectedItem}
              onToggleWhitelist={handleToggleWhitelist}
              onPurge={handlePurge}
              isPending={isPending}
              disableDelete={effectiveDisableDelete}
            />
          </SheetContent>
        )}
      </Sheet>

      {/* Confirmation Dialog for Purge */}
      {!effectiveDisableDelete && (
        <Dialog
          open={!!candidate}
          onOpenChange={(open) => !open && setCandidate(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {candidate?.target === "single_episode"
                  ? "Confirm Episode Purge"
                  : "Confirm Media Purge"}
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-foreground">
                  {candidate?.item.title}
                </span>
                ?{" "}
                {candidate?.target === "single_episode"
                  ? "This will delete this episode file from Sonarr disk storage."
                  : "This triggers immediate deletion in Radarr/Sonarr and purges local files."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setCandidate(null)}
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
      )}
    </>
  )
}

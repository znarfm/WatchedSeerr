import * as React from "react"
import { isSearchShortcut } from "@/components/audit-table/data-table"

export function useTableShortcuts(
  searchInputRef: React.RefObject<HTMLInputElement | null>,
  onRefresh: () => void
) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isSearchShortcut({
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          targetTagName: (e.target as HTMLElement)?.tagName,
        })
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      } else if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault()
        onRefresh()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [searchInputRef, onRefresh])
}

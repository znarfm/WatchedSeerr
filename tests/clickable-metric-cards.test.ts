import { describe, it } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  computeMetricCounts,
  resolveStatusCardClick,
  DataTable,
  isSearchShortcut,
} from "../components/audit-table/data-table"
import { sortInactiveDays, columns } from "../components/audit-table/columns"
import { TooltipProvider } from "../components/ui/tooltip"
import type { AuditMediaItem } from "../types"

const mockItems: AuditMediaItem[] = [
  {
    id: "item-1",
    requestId: 1,
    tmdbId: 101,
    jellyfinItemId: "jf-101",
    jellyfinImageTag: "tag-101",
    title: "Inception",
    year: 2010,
    mediaType: "movie",
    sizeBytes: 15_000_000_000, // 14.0 GB
    quality: "4K",
    requestedAt: "2024-01-15T00:00:00Z",
    requester: {
      id: 1,
      username: "alice",
      requesterAvatarUrl: "/api/proxy/avatar?userId=u-1&tag=tag-1",
    },
    requesterState: {
      userId: "u-1",
      username: "alice",
      isRequester: true,
      status: "completed",
      progressPercent: 100,
      playCount: 1,
    },
    householdStates: [
      {
        userId: "u-2",
        username: "bob",
        avatarUrl: "/api/proxy/avatar?userId=u-2&tag=tag-2",
        isRequester: false,
        status: "in_progress",
        progressPercent: 45,
        playCount: 0,
      },
    ],
    daysSinceLastPlayed: 45,
    conflictStatus: "safe",
    conflictReason: "Completed by requester",
    isWhitelisted: false,
  },
  {
    id: "item-2",
    requestId: 2,
    tmdbId: 102,
    jellyfinItemId: "jf-102",
    title: "Stranger Things",
    year: 2016,
    mediaType: "tv",
    sizeBytes: 800_000_000, // 763 MB (< 1 GB)
    quality: "1080p",
    requestedAt: "2024-02-01T00:00:00Z",
    requester: {
      id: 2,
      username: "bob",
      // No requesterAvatarUrl (tagless)
    },
    requesterState: {
      userId: "u-2",
      username: "bob",
      isRequester: true,
      status: "in_progress",
      progressPercent: 60,
      playCount: 0,
    },
    householdStates: [],
    daysSinceLastPlayed: 5,
    conflictStatus: "conflict",
    conflictReason: "Currently being watched",
    isWhitelisted: true,
  },
  {
    id: "item-3",
    requestId: 3,
    tmdbId: 103,
    jellyfinItemId: "jf-103",
    title: "The Matrix",
    year: 1999,
    mediaType: "movie",
    requestedAt: "2023-11-20T00:00:00Z",
    requester: {
      id: 3,
      username: "charlie",
    },
    requesterState: {
      userId: "u-3",
      username: "charlie",
      isRequester: true,
      status: "unplayed",
      progressPercent: 0,
      playCount: 0,
    },
    householdStates: [],
    daysSinceLastPlayed: null, // "Never"
    conflictStatus: "ghost",
    conflictReason: "Unplayed request > 30 days",
    isWhitelisted: false,
  },
  {
    id: "item-4",
    requestId: 4,
    tmdbId: 104,
    title: "Agatha All Along",
    year: 2024,
    mediaType: "tv",
    requestedAt: "2026-03-01T00:00:00Z",
    requester: {
      id: 4,
      username: "dave",
    },
    requesterState: {
      userId: "u-4",
      username: "dave",
      isRequester: true,
      status: "unplayed",
      progressPercent: 0,
      playCount: 0,
    },
    householdStates: [],
    daysSinceLastPlayed: null,
    conflictStatus: "new",
    conflictReason: "Recently requested (2 days ago) — awaiting first watch",
    isWhitelisted: false,
  },
]

describe("Clickable Metric Cards & Table UX Seam", () => {
  it("computeMetricCounts tallies total, safe, newCount, conflict, and ghost items correctly", () => {
    const counts = computeMetricCounts(mockItems)
    assert.deepEqual(counts, {
      total: 4,
      safe: 1,
      newCount: 1,
      conflict: 1,
      ghost: 1,
    })

    // After purging first item
    const reduced = computeMetricCounts(mockItems.slice(1))
    assert.deepEqual(reduced, {
      total: 3,
      safe: 0,
      newCount: 1,
      conflict: 1,
      ghost: 1,
    })
  })

  it("resolveStatusCardClick handles status selection and toggling back to all", () => {
    // Clicking a category sets it
    assert.equal(resolveStatusCardClick("all", "safe"), "safe")
    assert.equal(resolveStatusCardClick("all", "new"), "new")
    assert.equal(resolveStatusCardClick("all", "conflict"), "conflict")
    assert.equal(resolveStatusCardClick("all", "ghost"), "ghost")

    // Clicking the already-active category toggles it back to undefined ("all")
    assert.equal(resolveStatusCardClick("safe", "safe"), undefined)
    assert.equal(resolveStatusCardClick("new", "new"), undefined)
    assert.equal(resolveStatusCardClick("conflict", "conflict"), undefined)
    assert.equal(resolveStatusCardClick("ghost", "ghost"), undefined)

    // Switching between categories selects the newly clicked one
    assert.equal(resolveStatusCardClick("safe", "new"), "new")
    assert.equal(resolveStatusCardClick("new", "conflict"), "conflict")
    assert.equal(resolveStatusCardClick("conflict", "ghost"), "ghost")

    // Clicking "Total Audited" ("all") always clears filter to undefined
    assert.equal(resolveStatusCardClick("safe", "all"), undefined)
    assert.equal(resolveStatusCardClick("new", "all"), undefined)
    assert.equal(resolveStatusCardClick("all", "all"), undefined)
  })

  it("isSearchShortcut identifies search shortcut keystrokes across platforms and inputs", () => {
    // Ctrl+K and ⌘K trigger search
    assert.equal(isSearchShortcut({ key: "k", ctrlKey: true }), true)
    assert.equal(isSearchShortcut({ key: "K", ctrlKey: true }), true)
    assert.equal(isSearchShortcut({ key: "k", metaKey: true }), true)
    assert.equal(
      isSearchShortcut({ key: "k", ctrlKey: true, targetTagName: "INPUT" }),
      true
    )

    // Alt modifier blocks Ctrl+K
    assert.equal(
      isSearchShortcut({ key: "k", ctrlKey: true, altKey: true }),
      false
    )

    // Slash triggers search when not inside an editable tag
    assert.equal(isSearchShortcut({ key: "/", targetTagName: "DIV" }), true)
    assert.equal(isSearchShortcut({ key: "/", targetTagName: "BODY" }), true)
    assert.equal(isSearchShortcut({ key: "/", targetTagName: undefined }), true)

    // Slash is ignored inside INPUT, TEXTAREA, and SELECT
    assert.equal(isSearchShortcut({ key: "/", targetTagName: "INPUT" }), false)
    assert.equal(
      isSearchShortcut({ key: "/", targetTagName: "TEXTAREA" }),
      false
    )
    assert.equal(isSearchShortcut({ key: "/", targetTagName: "SELECT" }), false)

    // Other keys do not trigger search
    assert.equal(isSearchShortcut({ key: "r", ctrlKey: true }), false)
    assert.equal(isSearchShortcut({ key: "Escape" }), false)
  })

  it("sortInactiveDays treats null ('Never') as Infinity", () => {
    // Both numbers
    assert.ok(sortInactiveDays(10, 20) < 0)
    assert.ok(sortInactiveDays(20, 10) > 0)
    assert.equal(sortInactiveDays(15, 15), 0)

    // One null (Infinity)
    assert.ok(sortInactiveDays(10, null) < 0)
    assert.ok(sortInactiveDays(null, 10) > 0)

    // Both null
    assert.equal(sortInactiveDays(null, null), 0)
  })

  it("requester column only instantiates AvatarImage when requesterAvatarUrl is defined", () => {
    const reqCol = columns.find((c) => c.id === "requester")
    assert.ok(reqCol, "Requester column found")

    // Alice has requesterAvatarUrl
    const cellAlice: any = (reqCol.cell as any)({
      row: { original: mockItems[0] },
    })
    const aliceAvatarChildren = cellAlice.props.children[0].props.children
    assert.ok(aliceAvatarChildren[0], "Alice Avatar has AvatarImage element")
    assert.equal(
      aliceAvatarChildren[0].props.src,
      "/api/proxy/avatar?userId=u-1&tag=tag-1"
    )

    // Bob does NOT have requesterAvatarUrl
    const cellBob: any = (reqCol.cell as any)({
      row: { original: mockItems[1] },
    })
    const bobAvatarChildren = cellBob.props.children[0].props.children
    assert.equal(
      bobAvatarChildren[0],
      undefined,
      "Bob Avatar does NOT have AvatarImage element"
    )
  })

  it("renders DataTable SSR markup with 5 clickable metric card buttons, toolbar filters, Kbd hints, and responsive columns", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(DataTable, { initialData: mockItems })
      )
    )

    // Metric cards rendered in responsive 5-card grid
    assert.ok(
      html.includes(
        "grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5"
      ),
      "Metric cards arranged in responsive grid"
    )

    // Metric cards rendered as buttons with aria-pressed
    assert.ok(
      html.includes('aria-pressed="true"'),
      "Initial 'Total Audited' card has aria-pressed='true'"
    )
    assert.ok(html.includes("Total Audited"))
    assert.ok(html.includes("Safe to Purge"))
    assert.ok(html.includes("New / Unwatched"))
    assert.ok(html.includes("text-sky-500"))
    assert.ok(html.includes("Active Conflicts"))
    assert.ok(html.includes("Ghost Requests"))

    // Keyboard shortcut hints rendered
    assert.ok(html.includes("Ctrl"), "Search bar contains Ctrl Kbd")
    assert.ok(html.includes("K"), "Search bar contains K Kbd")
    assert.ok(
      html.includes('data-slot="kbd"'),
      "Search bar renders Kbd shortcut"
    )
    assert.ok(html.includes("Refresh"), "Toolbar contains Refresh button")

    // Responsive table columns rendered with responsive classes
    assert.ok(html.includes("Size"), "Header contains Size column")
    assert.ok(html.includes("Requested"), "Header contains Requested column")
    assert.ok(html.includes("Household"), "Header contains Household column")
    assert.ok(
      html.includes("hidden md:table-cell"),
      "Columns contain hidden md:table-cell"
    )
    assert.ok(
      html.includes("hidden lg:table-cell"),
      "Columns contain hidden lg:table-cell"
    )
    assert.ok(
      html.includes("hidden sm:table-cell"),
      "Columns contain hidden sm:table-cell"
    )

    // Sky-blue "New" status badge for item-4
    assert.ok(
      html.includes("bg-sky-500/15"),
      "Status cell contains sky-blue New badge"
    )
    assert.ok(
      html.includes("text-sky-400"),
      "Status cell contains text-sky-400"
    )

    // Disk size formatted in GB and MB
    assert.ok(html.includes("14.0 GB"), "Table row formats 15 GB as 14.0 GB")
    assert.ok(html.includes("763 MB"), "Table row formats 800 MB as 763 MB")

    // Directional sort icons present in headers
    assert.ok(
      html.includes("tabler-icon-arrows-sort"),
      "Sortable headers include sort icon"
    )

    // Poster thumbnail contains jellyfinImageTag when available
    assert.ok(
      html.includes("/api/proxy/poster?jellyfinItemId=jf-101&amp;tag=tag-101"),
      "Poster proxy URL includes &tag=tag-101"
    )

    // Old status tabs removed from toolbar
    assert.ok(
      !html.includes('data-slot="tabs-trigger" value="safe"'),
      "Old status tabs removed from toolbar"
    )

    // Toolbar filters: All Requesters, All Watch States, All Items
    assert.ok(
      html.includes("All Requesters"),
      "Toolbar includes Requester dropdown"
    )
    assert.ok(
      html.includes("All Watch States"),
      "Toolbar includes Watch State dropdown"
    )
    assert.ok(html.includes("All Items"), "Toolbar includes Whitelist dropdown")

    // Pagination rows-per-page selector
    assert.ok(
      html.includes("Rows per page:"),
      "Pagination footer includes rows-per-page label"
    )

    // Delete buttons rendered when disableDelete is false
    assert.ok(
      html.includes("tabler-icon-trash"),
      "Delete icon button rendered when disableDelete is not set"
    )

    const disabledHtml = renderToStaticMarkup(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(DataTable, {
          initialData: mockItems,
          disableDelete: true,
        })
      )
    )
    assert.ok(
      !disabledHtml.includes("tabler-icon-trash"),
      "Delete icon button is hidden when disableDelete is true"
    )
  })
})

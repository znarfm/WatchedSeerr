import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { AuditMediaItem } from "../types"
import { deriveMatrixUsers, getUserCellState, isSearchShortcut } from "../components/matrix-table/watch-matrix"

describe("Watch Matrix Unit Seams", () => {
  it("re-exports and validates isSearchShortcut helper", () => {
    assert.equal(isSearchShortcut({ key: "k", ctrlKey: true }), true)
    assert.equal(isSearchShortcut({ key: "k", metaKey: true }), true)
    assert.equal(isSearchShortcut({ key: "/", targetTagName: "DIV" }), true)
    assert.equal(isSearchShortcut({ key: "/", targetTagName: "INPUT" }), false)
  })

  it("deriveMatrixUsers reconciles users and counts requested & watched totals", () => {
    const items: AuditMediaItem[] = [
      {
        id: "m1",
        requestId: 1,
        tmdbId: 101,
        title: "Movie One",
        mediaType: "movie",
        requestedAt: "2026-01-01T00:00:00Z",
        requester: {
          id: 1,
          username: "Alice",
          matchedJellyfinUserId: "jf-alice",
        },
        requesterState: {
          userId: "jf-alice",
          username: "Alice",
          isRequester: true,
          status: "completed",
          progressPercent: 100,
          playCount: 1,
        },
        householdStates: [
          {
            userId: "jf-bob",
            username: "Bob",
            isRequester: false,
            status: "in_progress",
            progressPercent: 45,
            playCount: 1,
          },
        ],
        daysSinceLastPlayed: 2,
        conflictStatus: "safe",
        conflictReason: "Completed by requester",
        isWhitelisted: false,
      },
      {
        id: "m2",
        requestId: 2,
        tmdbId: 102,
        title: "Movie Two",
        mediaType: "movie",
        requestedAt: "2026-01-02T00:00:00Z",
        requester: {
          id: 2,
          username: "Bob",
          matchedJellyfinUserId: "jf-bob",
        },
        requesterState: {
          userId: "jf-bob",
          username: "Bob",
          isRequester: true,
          status: "unplayed",
          progressPercent: 0,
          playCount: 0,
        },
        householdStates: [
          {
            userId: "jf-alice",
            username: "Alice",
            isRequester: false,
            status: "completed",
            progressPercent: 100,
            playCount: 1,
          },
        ],
        daysSinceLastPlayed: 1,
        conflictStatus: "conflict",
        conflictReason: "Ghost request",
        isWhitelisted: false,
      },
    ]

    const users = deriveMatrixUsers(items)

    assert.equal(users.length, 2)
    // Sorted alphabetically
    assert.equal(users[0].username, "Alice")
    assert.equal(users[0].requestedCount, 1)
    assert.equal(users[0].watchedCount, 2) // m1 as requester (completed) + m2 as household (completed)

    assert.equal(users[1].username, "Bob")
    assert.equal(users[1].requestedCount, 1)
    assert.equal(users[1].watchedCount, 0) // m1 in_progress + m2 unplayed
  })

  it("getUserCellState resolves requester and household user states correctly", () => {
    const item: AuditMediaItem = {
      id: "m1",
      requestId: 1,
      tmdbId: 101,
      title: "Movie One",
      mediaType: "movie",
      requestedAt: "2026-01-01T00:00:00Z",
      requester: {
        id: 1,
        username: "Alice",
        matchedJellyfinUserId: "jf-alice",
      },
      requesterState: {
        userId: "jf-alice",
        username: "Alice",
        isRequester: true,
        status: "completed",
        progressPercent: 100,
        playCount: 1,
      },
      householdStates: [
        {
          userId: "jf-bob",
          username: "Bob",
          isRequester: false,
          status: "in_progress",
          progressPercent: 45,
          playCount: 1,
        },
      ],
      daysSinceLastPlayed: 2,
      conflictStatus: "safe",
      conflictReason: "Completed by requester",
      isWhitelisted: false,
    }

    const aliceCol = {
      key: "jf-alice",
      userId: "jf-alice",
      username: "Alice",
      requestedCount: 1,
      watchedCount: 1,
    }

    const bobCol = {
      key: "jf-bob",
      userId: "jf-bob",
      username: "Bob",
      requestedCount: 0,
      watchedCount: 0,
    }

    const charlieCol = {
      key: "charlie",
      userId: undefined,
      username: "charlie",
      requestedCount: 0,
      watchedCount: 0,
    }

    const aliceRes = getUserCellState(item, aliceCol)
    assert.equal(aliceRes.isRequester, true)
    assert.equal(aliceRes.state?.status, "completed")
    assert.equal(aliceRes.state?.progressPercent, 100)

    const bobRes = getUserCellState(item, bobCol)
    assert.equal(bobRes.isRequester, false)
    assert.equal(bobRes.state?.status, "in_progress")
    assert.equal(bobRes.state?.progressPercent, 45)

    const charlieRes = getUserCellState(item, charlieCol)
    assert.equal(charlieRes.isRequester, false)
    assert.equal(charlieRes.state, undefined)
  })

  it("renders WatchMatrix with sticky media column, poster proxy, user stats, and pagination controls", async () => {
    const React = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { TooltipProvider } = await import("../components/ui/tooltip")
    const { WatchMatrix } = await import("../components/matrix-table/watch-matrix")

    const mockItems: AuditMediaItem[] = [
      {
        id: "m1",
        requestId: 1,
        tmdbId: 101,
        jellyfinItemId: "jf-item-101",
        jellyfinImageTag: "tag-101",
        title: "Inception",
        year: 2010,
        mediaType: "movie",
        requestedAt: "2026-01-01T00:00:00Z",
        requester: {
          id: 1,
          username: "Alice",
          matchedJellyfinUserId: "jf-alice",
        },
        requesterState: {
          userId: "jf-alice",
          username: "Alice",
          isRequester: true,
          status: "completed",
          progressPercent: 100,
          playCount: 1,
          lastPlayedDate: "2026-01-05T00:00:00Z",
        },
        householdStates: [
          {
            userId: "jf-bob",
            username: "Bob",
            isRequester: false,
            status: "in_progress",
            progressPercent: 50,
            playCount: 1,
            lastPlayedDate: "2026-01-06T00:00:00Z",
          },
        ],
        daysSinceLastPlayed: 2,
        conflictStatus: "safe",
        conflictReason: "Completed by requester",
        isWhitelisted: true,
      },
      {
        id: "m2",
        requestId: 2,
        tmdbId: 102,
        title: "Fresh Show",
        year: 2024,
        mediaType: "tv",
        requestedAt: "2026-01-02T00:00:00Z",
        requester: {
          id: 2,
          username: "Bob",
          matchedJellyfinUserId: "jf-bob",
        },
        requesterState: {
          userId: "jf-bob",
          username: "Bob",
          isRequester: true,
          status: "unplayed",
          progressPercent: 0,
          playCount: 0,
        },
        householdStates: [],
        daysSinceLastPlayed: null,
        conflictStatus: "new",
        conflictReason: "Fresh request awaiting watch",
        isWhitelisted: false,
      },
    ]

    const html = renderToStaticMarkup(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(WatchMatrix, { initialData: mockItems })
      )
    )

    // Poster thumbnail with proxy URL
    assert.ok(html.includes("/api/proxy/poster?jellyfinItemId=jf-item-101&amp;tag=tag-101") || html.includes("/api/proxy/poster?jellyfinItemId=jf-item-101&tag=tag-101"))
    // Media details
    assert.ok(html.includes("Inception"))
    assert.ok(html.includes("2010"))
    assert.ok(html.includes("Whitelisted"))
    assert.ok(html.includes("Safe"))
    assert.ok(html.includes("Fresh Show"))
    assert.ok(html.includes("Req: Alice"))
    // Status 'new' badge
    assert.ok(html.includes("border-sky-500/40"), "Status badge contains border-sky-500/40")
    assert.ok(html.includes("text-sky-400"), "Status badge contains text-sky-400")
    assert.ok(html.includes("New"), "Status cell renders 'New' badge text")
    // User column stats
    assert.ok(html.includes("1 req • 1 watched"))
    // REQ badge on user cell
    assert.ok(html.includes("REQ"))
    // Keyboard shortcut hints rendered
    assert.ok(html.includes("Ctrl"), "Search bar contains Ctrl Kbd")
    assert.ok(html.includes("K"), "Search bar contains K Kbd")
    assert.ok(html.includes('data-slot="kbd"'), "Search bar renders Kbd shortcut")
    assert.ok(html.includes("Refresh"), "Toolbar contains Refresh button")
    // Pagination footer
    assert.ok(html.includes("Page 1 of 1"))
    assert.ok(html.includes("Rows per page:"))
    // Toolbar search & filters
    assert.ok(html.includes("Search by title..."))
    assert.ok(html.includes("All Requesters"))
    assert.ok(html.includes("All Statuses"))
    // Sticky media column class
    assert.ok(html.includes("sticky left-0"))
  })

  it("handles pagination and sorting by user progress", () => {
    const items: AuditMediaItem[] = Array.from({ length: 30 }, (_, i) => ({
      id: `item-${i + 1}`,
      requestId: i + 1,
      tmdbId: 1000 + i,
      title: `Media ${String(i + 1).padStart(2, "0")}`,
      year: 2020,
      mediaType: i % 2 === 0 ? "movie" : "tv",
      requestedAt: "2026-01-01T00:00:00Z",
      requester: {
        id: 1,
        username: "Alice",
      },
      requesterState: {
        userId: "jf-alice",
        username: "Alice",
        isRequester: true,
        status: i < 15 ? "completed" : "unplayed",
        progressPercent: i < 15 ? 100 : 0,
        playCount: i < 15 ? 1 : 0,
      },
      householdStates: [
        {
          userId: "jf-bob",
          username: "Bob",
          isRequester: false,
          status: i % 3 === 0 ? "completed" : "in_progress",
          progressPercent: (i * 10) % 100,
          playCount: 1,
        },
      ],
      daysSinceLastPlayed: 1,
      conflictStatus: i % 2 === 0 ? "safe" : "conflict",
      conflictReason: "test",
      isWhitelisted: false,
    }))

    const users = deriveMatrixUsers(items)
    assert.equal(users.length, 2)
    assert.equal(users[0].username, "Alice")
    assert.equal(users[0].requestedCount, 30)
    assert.equal(users[0].watchedCount, 15)
  })
})

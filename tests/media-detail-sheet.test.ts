import { describe, it } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  MediaDetailSheet,
  MediaDetailSheetBody,
  resolveExternalLinks,
  type DeleteTarget,
  type MediaDetailSheetProps,
} from "../components/media-detail-sheet"
import { Sheet } from "../components/ui/sheet"
import Loading from "../app/loading"
import MatrixLoading from "../app/matrix/loading"
import type { AuditMediaItem } from "../types"

const mockMovie: AuditMediaItem = {
  id: "item-movie-1",
  requestId: 1,
  tmdbId: 27205,
  imdbId: "tt1375666",
  jellyfinItemId: "jf-movie-1",
  jellyfinImageTag: "tag-movie-1",
  title: "Inception",
  year: 2010,
  mediaType: "movie",
  sizeBytes: 15_000_000_000, // 14.0 GB
  quality: "4K",
  qualityFull: "4K Remux",
  genres: ["Action", "Sci-Fi"],
  overview:
    "A thief who steals corporate secrets through dream-sharing technology.",
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
    lastPlayedDate: "2024-02-01T00:00:00Z",
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
      lastPlayedDate: "2024-02-10T00:00:00Z",
    },
    {
      userId: "u-3",
      username: "charlie",
      // No avatarUrl to test AvatarImage absence
      isRequester: false,
      status: "unplayed",
      progressPercent: 0,
      playCount: 0,
    },
  ],
  daysSinceLastPlayed: 45,
  conflictStatus: "safe",
  conflictReason: "Completed by requester and safe to purge",
  isWhitelisted: false,
}

const mockTvSeries: AuditMediaItem = {
  id: "item-tv-1",
  requestId: 2,
  tmdbId: 1396,
  imdbId: "tt0903747",
  jellyfinItemId: "jf-tv-1",
  title: "Breaking Bad",
  year: 2008,
  mediaType: "tv",
  sizeBytes: 850_000_000, // 811 MB (< 1 GB)
  quality: "1080p",
  genres: ["Crime", "Drama"],
  requestedAt: "2024-03-01T00:00:00Z",
  requester: {
    id: 2,
    username: "dave",
    // No requester avatar
  },
  requesterState: {
    userId: "u-4",
    username: "dave",
    isRequester: true,
    status: "in_progress",
    progressPercent: 60,
    playCount: 12,
  },
  householdStates: [],
  daysSinceLastPlayed: null, // "Never"
  conflictStatus: "conflict",
  conflictReason: "Active playback in progress",
  isWhitelisted: true,
  externalLinks: {
    jellyfin: "https://jf.example.com/web/index.html#!/details?id=jf-tv-1",
    seerr: "https://seerr.example.com/tv/1396",
    arr: "https://sonarr.example.com/series/breaking-bad",
  },
}

describe("MediaDetailSheet Seam", () => {
  describe("resolveExternalLinks helper", () => {
    it("generates fallback IMDb and Letterboxd links for movies when externalLinks is undefined", () => {
      const links = resolveExternalLinks(mockMovie)
      assert.equal(links.imdb, "https://www.imdb.com/title/tt1375666/")
      assert.equal(links.letterboxd, "https://letterboxd.com/tmdb/27205/")
      assert.equal(links.arr, undefined)
      assert.equal(links.jellyfin, undefined)
      assert.equal(links.seerr, undefined)
    })

    it("omits Letterboxd for TV series and merges provided externalLinks", () => {
      const links = resolveExternalLinks(mockTvSeries)
      assert.equal(links.imdb, "https://www.imdb.com/title/tt0903747/")
      assert.equal(links.letterboxd, undefined)
      assert.equal(
        links.jellyfin,
        "https://jf.example.com/web/index.html#!/details?id=jf-tv-1"
      )
      assert.equal(links.seerr, "https://seerr.example.com/tv/1396")
      assert.equal(links.arr, "https://sonarr.example.com/series/breaking-bad")
    })
  })

  const renderBody = (
    props: React.ComponentProps<typeof MediaDetailSheetBody>
  ) =>
    renderToStaticMarkup(
      React.createElement(
        Sheet,
        { open: true },
        React.createElement(MediaDetailSheetBody, props)
      )
    )

  describe("MediaDetailSheetBody SSR Markup", () => {
    it("renders pinned header with poster proxy, title, formatted size, and quality badge", () => {
      const html = renderBody({ selectedItem: mockMovie })

      // SheetHeader slot
      assert.ok(html.includes('data-slot="sheet-header"'), "Has sheet-header")

      // Poster proxy thumbnail
      assert.ok(
        html.includes(
          "/api/proxy/poster?jellyfinItemId=jf-movie-1&amp;w=400&amp;tag=tag-movie-1"
        ),
        "Renders poster proxy with w=400 and tag"
      )
      assert.ok(html.includes("Inception"), "Renders title")
      assert.ok(html.includes("2010"), "Renders year")
      assert.ok(html.includes("movie"), "Renders media type")
      assert.ok(
        html.includes("uppercase"),
        "Applies uppercase style to media type"
      )
      assert.ok(html.includes("14.0 GB"), "Renders formatted GB size")
      assert.ok(
        html.includes("4K Remux"),
        "Renders qualityFull badge preference"
      )
      assert.ok(html.includes("Action"), "Renders genre badge")
      assert.ok(html.includes("Sci-Fi"), "Renders genre badge")
    })

    it("renders external service links with target=_blank and rel=noopener noreferrer", () => {
      const html = renderBody({ selectedItem: mockTvSeries })

      // External link pills
      assert.ok(
        html.includes('target="_blank"'),
        "External links open in new tab"
      )
      assert.ok(
        html.includes('rel="noopener noreferrer"'),
        "External links have secure rel"
      )
      assert.ok(html.includes("Sonarr"), "Renders Sonarr pill for TV series")
      assert.ok(html.includes("Jellyfin"), "Renders Jellyfin pill")
      assert.ok(html.includes("Seerr"), "Renders Seerr pill")
      assert.ok(html.includes("IMDb"), "Renders IMDb pill")
      assert.ok(!html.includes("Letterboxd"), "Omits Letterboxd for TV series")
      assert.ok(html.includes("811 MB"), "Formats < 1 GB size as MB")
    })

    it("renders 3-column metadata strip (Requested, Inactive, Protection)", () => {
      const htmlMovie = renderBody({ selectedItem: mockMovie })
      assert.ok(htmlMovie.includes("Requested"), "Strip has Requested")
      assert.ok(htmlMovie.includes("Inactive"), "Strip has Inactive")
      assert.ok(htmlMovie.includes("Protection"), "Strip has Protection")
      assert.ok(htmlMovie.includes("45d"), "Inactive formatted as 45d")
      assert.ok(htmlMovie.includes("Unprotected"), "Unprotected label rendered")

      const htmlTv = renderBody({ selectedItem: mockTvSeries })
      assert.ok(
        htmlTv.includes("Never"),
        "DaysSinceLastPlayed null formatted as Never"
      )
      assert.ok(
        htmlTv.includes("Whitelisted"),
        "Whitelisted protection rendered"
      )
    })

    it("renders retention status banner for safe, new, conflict, and ghost", () => {
      const safeHtml = renderBody({ selectedItem: mockMovie })
      assert.ok(safeHtml.includes("safe Status"), "Renders safe Status")
      assert.ok(safeHtml.includes("text-emerald-400"), "Emerald text for safe")

      const conflictHtml = renderBody({ selectedItem: mockTvSeries })
      assert.ok(
        conflictHtml.includes("conflict Status"),
        "Renders conflict Status"
      )
      assert.ok(
        conflictHtml.includes("text-amber-400"),
        "Amber text for conflict"
      )

      const newHtml = renderBody({
        selectedItem: {
          ...mockMovie,
          conflictStatus: "new",
          conflictReason: "Newly added",
        },
      })
      assert.ok(newHtml.includes("new Status"), "Renders new Status")
      assert.ok(newHtml.includes("bg-sky-500/10"), "Sky styling for new")

      const ghostHtml = renderBody({
        selectedItem: {
          ...mockMovie,
          conflictStatus: "ghost",
          conflictReason: "No media file found",
        },
      })
      assert.ok(ghostHtml.includes("ghost Status"), "Renders ghost Status")
      assert.ok(ghostHtml.includes("text-rose-400"), "Rose styling for ghost")
    })

    it("renders overview when present and omits when absent", () => {
      const withOverview = renderBody({ selectedItem: mockMovie })
      assert.ok(withOverview.includes("Overview"), "Includes Overview header")
      assert.ok(
        withOverview.includes("A thief who steals corporate secrets"),
        "Includes overview text"
      )

      const withoutOverview = renderBody({ selectedItem: mockTvSeries })
      assert.ok(
        !withoutOverview.includes("Overview"),
        "Omits Overview header when empty"
      )
    })

    it("renders household playback breakdown and selectively renders AvatarImage only when URL is truthy", () => {
      const html = renderBody({ selectedItem: mockMovie })
      assert.ok(
        html.includes("Household Playback Breakdown"),
        "Household header present"
      )
      assert.ok(
        html.includes("border-primary/40"),
        "Requester card has primary border highlight"
      )
      assert.ok(html.includes("alice (Requester)"), "Requester label present")
      assert.ok(html.includes("bob"), "Household member bob present")
      assert.ok(html.includes("charlie"), "Household member charlie present")

      // Check AvatarImage element instantiation in JSX tree
      const bodyTree = MediaDetailSheetBody({ selectedItem: mockMovie })
      const scrollableBody = bodyTree.props.children[1]
      const householdSection = scrollableBody.props.children[3]
      const cardsContainer = householdSection.props.children[1]
      const requesterCard = cardsContainer.props.children[0]
      const householdCards = cardsContainer.props.children[1]

      // Alice (requester) has avatar URL -> AvatarImage present
      const aliceAvatar =
        requesterCard.props.children[0].props.children[0].props.children[0]
      assert.ok(
        aliceAvatar.props.children[0],
        "Alice Avatar has AvatarImage element"
      )
      assert.equal(
        aliceAvatar.props.children[0].props.src,
        "/api/proxy/avatar?userId=u-1&tag=tag-1"
      )

      // Bob has avatarUrl -> AvatarImage present
      const bobAvatar =
        householdCards[0].props.children[0].props.children[0].props.children[0]
      assert.ok(
        bobAvatar.props.children[0],
        "Bob Avatar has AvatarImage element"
      )
      assert.equal(
        bobAvatar.props.children[0].props.src,
        "/api/proxy/avatar?userId=u-2&tag=tag-2"
      )

      // Charlie has NO avatarUrl -> AvatarImage is undefined/falsy
      const charlieAvatar =
        householdCards[1].props.children[0].props.children[0].props.children[0]
      assert.equal(
        charlieAvatar.props.children[0],
        undefined,
        "Charlie Avatar has NO AvatarImage element"
      )
    })

    it("renders pinned footer with Whitelist Media and Purge Media buttons", () => {
      const unwhitelistedHtml = renderBody({ selectedItem: mockMovie })
      assert.ok(
        unwhitelistedHtml.includes('data-slot="sheet-footer"'),
        "Has sheet-footer"
      )
      assert.ok(
        unwhitelistedHtml.includes("Whitelist Media"),
        "Button says Whitelist Media when unwhitelisted"
      )
      assert.ok(
        unwhitelistedHtml.includes("Purge Media"),
        "Purge Media button exists"
      )

      const whitelistedHtml = renderBody({ selectedItem: mockTvSeries })
      assert.ok(
        whitelistedHtml.includes("Remove Whitelist"),
        "Button says Remove Whitelist when whitelisted"
      )
    })
  })
})

describe("Route-Level Skeleton Loaders Seam", () => {
  it("renders Audit Queue route skeleton (app/loading.tsx) with 5 metric cards, toolbar, and 10 rows", () => {
    const html = renderToStaticMarkup(React.createElement(Loading))

    // Header presence
    assert.ok(
      html.includes("WatchedSeerr"),
      "Loading skeleton has WatchedSeerr header"
    )

    // 5 metric card grid
    assert.ok(
      html.includes(
        "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4"
      ),
      "Contains 5-card responsive metric grid"
    )

    // Toolbar skeleton
    assert.ok(
      html.includes("w-full sm:w-64"),
      "Contains responsive search skeleton"
    )

    // 10 table rows
    const rowMatches = html.match(/data-slot="table-row"/g) || []
    // 1 header row + 10 body rows = 11 total
    assert.equal(
      rowMatches.length,
      11,
      "Contains 1 header row and 10 body skeleton rows"
    )
  })

  it("renders Watch Matrix route skeleton (app/matrix/loading.tsx) with sticky media column and 4 user columns", () => {
    const html = renderToStaticMarkup(React.createElement(MatrixLoading))

    // Header presence
    assert.ok(
      html.includes("Watch Matrix"),
      "Matrix loading skeleton has Watch Matrix header"
    )

    // Sticky media column
    assert.ok(
      html.includes("sticky left-0"),
      "Sticky left media column present"
    )

    // 10 table rows
    const rowMatches = html.match(/data-slot="table-row"/g) || []
    assert.equal(
      rowMatches.length,
      11,
      "Contains 1 header row and 10 matrix skeleton rows"
    )
  })
})

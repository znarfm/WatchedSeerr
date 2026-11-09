import type { JellyfinItem, JellyfinItemsResponse, JellyfinUser } from "@/types"

export class JellyfinClient {
  private baseUrl: string
  private apiKey: string

  constructor(
    baseUrl = process.env.JELLYFIN_URL || "",
    apiKey = process.env.JELLYFIN_API_KEY || ""
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.apiKey = apiKey
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error("Jellyfin URL or API Key is missing")
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `MediaBrowser Token="${this.apiKey}"`,
        Accept: "application/json",
        ...options?.headers,
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      throw new Error(`Jellyfin API error ${res.status}: ${res.statusText}`)
    }

    return res.json() as Promise<T>
  }

  async getUsers(): Promise<JellyfinUser[]> {
    return this.request<JellyfinUser[]>("/Users")
  }

  /**
   * Fetches the entire library in calls (Movie & Series) with ProviderIds.
   */
  async getAllLibraryItems(): Promise<JellyfinItem[]> {
    const allItems: JellyfinItem[] = []
    let startIndex = 0
    const limit = 2000

    while (true) {
      const res = await this.request<JellyfinItemsResponse>(
        `/Items?Recursive=true&IncludeItemTypes=Movie,Series&CollapseBoxSetItems=false&Fields=ProviderIds,ProductionYear,RunTimeTicks,Path,Overview,Genres,MediaStreams,MediaSources,Size,ImageTags&EnableUserData=false&StartIndex=${startIndex}&Limit=${limit}`
      )
      const items = res.Items || []
      allItems.push(...items)

      if (
        items.length < limit ||
        (res.TotalRecordCount && allItems.length >= res.TotalRecordCount)
      ) {
        break
      }
      startIndex += limit
    }

    return allItems
  }

  /**
   * Fetches all user items with watch progress for a user in calls.
   */
  async getAllUserItems(userId: string): Promise<JellyfinItem[]> {
    const allItems: JellyfinItem[] = []
    let startIndex = 0
    const limit = 2000

    while (true) {
      const res = await this.request<JellyfinItemsResponse>(
        `/Users/${userId}/Items?Recursive=true&IncludeItemTypes=Movie,Series&CollapseBoxSetItems=false&Fields=UserData&EnableImages=false&StartIndex=${startIndex}&Limit=${limit}`
      )
      const items = res.Items || []
      allItems.push(...items)

      if (
        items.length < limit ||
        (res.TotalRecordCount && allItems.length >= res.TotalRecordCount)
      ) {
        break
      }
      startIndex += limit
    }

    return allItems
  }

  async getEpisodes(
    seriesId: string,
    userId?: string
  ): Promise<JellyfinItem[]> {
    const userParam = userId
      ? `?userId=${userId}&Fields=UserData,RunTimeTicks,MediaSources,MediaStreams,Size`
      : "?Fields=UserData,RunTimeTicks,MediaSources,MediaStreams,Size"

    try {
      const res = await this.request<JellyfinItemsResponse>(
        `/Shows/${seriesId}/Episodes${userParam}`
      )
      return res.Items || []
    } catch (err: unknown) {
      // If 404 and userId was specified, user might have restricted permissions; retry without userId
      if (userId && err instanceof Error && err.message.includes("404")) {
        try {
          const fallbackRes = await this.request<JellyfinItemsResponse>(
            `/Shows/${seriesId}/Episodes?Fields=UserData,RunTimeTicks,MediaSources,MediaStreams,Size`
          )
          return fallbackRes.Items || []
        } catch {
          // Fall through to generic parent query
        }
      }

      // If still 404, item might be a Season/Folder or empty series; query /Items with ParentId
      if (err instanceof Error && err.message.includes("404")) {
        try {
          const itemsRes = await this.request<JellyfinItemsResponse>(
            `/Items?ParentId=${seriesId}&Recursive=true&IncludeItemTypes=Episode&Fields=UserData,RunTimeTicks,MediaSources,MediaStreams,Size`
          )
          return itemsRes.Items || []
        } catch {
          return []
        }
      }

      throw err
    }
  }

  /**
   * Fetches episode size and media stream metadata across the library in a single call
   * so parent TV Series items can aggregate total disk size and video resolution/codec.
   */
  async getAllEpisodesMetadata(): Promise<JellyfinItem[]> {
    const res = await this.request<JellyfinItemsResponse>(
      "/Items?Recursive=true&IncludeItemTypes=Episode&Fields=MediaSources,MediaStreams,Size&EnableUserData=false&EnableImages=false&EnableTotalRecordCount=false&Limit=10000"
    )
    return res.Items || []
  }
}

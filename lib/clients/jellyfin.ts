import type {
  JellyfinItem,
  JellyfinItemsResponse,
  JellyfinUser,
} from "@/types"

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

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
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

  async findItemsByTmdbId(tmdbId: number, mediaType?: "movie" | "tv"): Promise<JellyfinItem[]> {
    const typeFilter = mediaType === "tv" ? "&IncludeItemTypes=Series" : mediaType === "movie" ? "&IncludeItemTypes=Movie" : ""
    const query = `/Items?HasTmdbId=true&AnyProviderIdEquals=Tmdb.${tmdbId}&Recursive=true&Fields=ProviderIds,ProductionYear,RunTimeTicks,Path,Overview${typeFilter}`
    const res = await this.request<JellyfinItemsResponse>(query)
    return res.Items || []
  }

  async getUserItemData(userId: string, itemId: string): Promise<JellyfinItem> {
    return this.request<JellyfinItem>(`/Users/${userId}/Items/${itemId}`)
  }

  async getEpisodes(seriesId: string, userId?: string): Promise<JellyfinItem[]> {
    const userParam = userId ? `?userId=${userId}&Fields=UserData,RunTimeTicks` : "?Fields=UserData,RunTimeTicks"
    const res = await this.request<JellyfinItemsResponse>(
      `/Shows/${seriesId}/Episodes${userParam}`
    )
    return res.Items || []
  }
}

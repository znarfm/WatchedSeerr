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

  /**
   * Fetches the entire library in one single call (Movie & Series) with ProviderIds.
   */
  async getAllLibraryItems(): Promise<JellyfinItem[]> {
    const res = await this.request<JellyfinItemsResponse>(
      "/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds,ProductionYear,RunTimeTicks,Path,Overview,Genres,MediaStreams,MediaSources,Size,ImageTags&EnableUserData=false&Limit=5000"
    )
    return res.Items || []
  }

  /**
   * Fetches all user items with watch progress for a user in one single call.
   */
  async getAllUserItems(userId: string): Promise<JellyfinItem[]> {
    const res = await this.request<JellyfinItemsResponse>(
      `/Users/${userId}/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=UserData&EnableImages=false&EnableTotalRecordCount=false&Limit=5000`
    )
    return res.Items || []
  }

  async getEpisodes(seriesId: string, userId?: string): Promise<JellyfinItem[]> {
    const userParam = userId ? `?userId=${userId}&Fields=UserData,RunTimeTicks` : "?Fields=UserData,RunTimeTicks"
    const res = await this.request<JellyfinItemsResponse>(
      `/Shows/${seriesId}/Episodes${userParam}`
    )
    return res.Items || []
  }
}

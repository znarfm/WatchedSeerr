import type { SeerrRequest, SeerrRequestResponse, SeerrUser } from "@/types"

export class SeerrClient {
  private baseUrl: string
  private apiKey: string

  constructor(
    baseUrl = process.env.SEERR_URL || "",
    apiKey = process.env.SEERR_API_KEY || ""
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.apiKey = apiKey
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error("Seerr URL or API Key is missing")
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "X-Api-Key": this.apiKey,
        Accept: "application/json",
        ...options?.headers,
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      throw new Error(`Seerr API error ${res.status}: ${res.statusText}`)
    }

    return res.json() as Promise<T>
  }

  async getRequests(
    take = 200,
    skip = 0,
    filter = "all"
  ): Promise<SeerrRequestResponse> {
    return this.request<SeerrRequestResponse>(
      `/api/v1/request?take=${take}&skip=${skip}&filter=${filter}&sort=added`
    )
  }

  async getAllRequests(filter = "all"): Promise<SeerrRequest[]> {
    const allResults: SeerrRequest[] = []
    let skip = 0
    const take = 100

    while (true) {
      const data = await this.getRequests(take, skip, filter)
      const results = data.results || []
      allResults.push(...results)

      if (results.length < take || allResults.length >= (data.pageInfo?.results || 0)) {
        break
      }
      skip += take
    }

    return allResults
  }

  async getUsers(take = 100): Promise<SeerrUser[]> {
    const data = await this.request<{ results: SeerrUser[] }>(
      `/api/v1/user?take=${take}`
    )
    return data.results || []
  }

  async getMediaDetails(mediaType: "movie" | "tv", tmdbId: number) {
    return this.request<{
      id: number
      title?: string
      name?: string
      releaseDate?: string
      firstAirDate?: string
      posterPath?: string
      overview?: string
      genres?: { id: number; name: string }[]
    }>(`/api/v1/${mediaType}/${tmdbId}`)
  }
}

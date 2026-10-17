import type { SeerrRequest, SeerrRequestResponse } from "@/types"

export class SeerrClient {
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl = process.env.SEERR_URL || "", apiKey = process.env.SEERR_API_KEY || "") {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.apiKey = apiKey
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
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

  async getRequests(take = 200, filter = "all"): Promise<SeerrRequest[]> {
    const data = await this.request<SeerrRequestResponse>(
      `/api/v1/request?take=${take}&filter=${filter}&sort=added`
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
    }>(`/api/v1/${mediaType}/${tmdbId}`)
  }
}

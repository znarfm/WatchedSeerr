export interface SonarrSeries {
  id: number
  title: string
  tmdbId?: number
  tvdbId?: number
  monitored: boolean
  path?: string
  statistics?: {
    sizeOnDisk: number
    episodeFileCount: number
    episodeCount: number
  }
}

export interface SonarrEpisodeFile {
  id: number
  seriesId: number
  seasonNumber: number
  relativePath: string
  path: string
  size: number
  dateAdded: string
}

export class SonarrClient {
  private baseUrl: string
  private apiKey: string
  private static seriesCache: {
    data: SonarrSeries[]
    expiresAt: number
  } | null = null

  constructor(
    baseUrl = process.env.SONARR_URL || "",
    apiKey = process.env.SONARR_API_KEY || ""
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.apiKey = apiKey
  }

  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey)
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error("Sonarr URL or API Key is missing")
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
      throw new Error(`Sonarr API error ${res.status}: ${res.statusText}`)
    }

    return res.json() as Promise<T>
  }

  async getAllSeries(forceFresh = false): Promise<SonarrSeries[]> {
    const now = Date.now()
    if (
      !forceFresh &&
      SonarrClient.seriesCache &&
      SonarrClient.seriesCache.expiresAt > now
    ) {
      return SonarrClient.seriesCache.data
    }

    const series = await this.request<SonarrSeries[]>("/api/v3/series")
    SonarrClient.seriesCache = { data: series, expiresAt: now + 60_000 } // 60s TTL cache
    return series
  }

  async getSeriesByTvdbId(tvdbId: number): Promise<SonarrSeries | null> {
    const all = await this.getAllSeries()
    return all.find((s) => s.tvdbId === tvdbId) || null
  }

  async getSeriesByTmdbId(tmdbId: number): Promise<SonarrSeries | null> {
    const all = await this.getAllSeries()
    return all.find((s) => s.tmdbId === tmdbId) || null
  }

  async getEpisodeFiles(seriesId: number): Promise<SonarrEpisodeFile[]> {
    return this.request<SonarrEpisodeFile[]>(
      `/api/v3/episodefile?seriesId=${seriesId}`
    )
  }

  async deleteEpisodeFile(episodeFileId: number): Promise<boolean> {
    await this.request<unknown>(`/api/v3/episodefile/${episodeFileId}`, {
      method: "DELETE",
    })
    return true
  }

  async unmonitorEpisodes(episodeIds: number[]): Promise<boolean> {
    if (episodeIds.length === 0) return true
    await this.request<unknown>("/api/v3/episode/monitor", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeIds, monitored: false }),
    })
    return true
  }

  async deleteSeries(
    sonarrId: number,
    deleteFiles = true,
    addImportExclusion = false
  ): Promise<boolean> {
    const query = `?deleteFiles=${deleteFiles}&addImportListExclusion=${addImportExclusion}`
    await this.request<unknown>(`/api/v3/series/${sonarrId}${query}`, {
      method: "DELETE",
    })
    return true
  }
}

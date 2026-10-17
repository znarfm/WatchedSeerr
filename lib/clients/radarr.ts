export interface RadarrMovie {
  id: number
  title: string
  tmdbId: number
  hasFile: boolean
  monitored: boolean
  sizeOnDisk?: number
  movieFileId?: number
}

export class RadarrClient {
  private baseUrl: string
  private apiKey: string

  constructor(
    baseUrl = process.env.RADARR_URL || "",
    apiKey = process.env.RADARR_API_KEY || ""
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
      throw new Error("Radarr URL or API Key is missing")
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
      throw new Error(`Radarr API error ${res.status}: ${res.statusText}`)
    }

    if (res.status === 204) {
      return undefined as T
    }

    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  async getMoviesByTmdbId(tmdbId: number): Promise<RadarrMovie[]> {
    return this.request<RadarrMovie[]>(`/api/v3/movie?tmdbId=${tmdbId}`)
  }

  async getMovieByTmdbId(tmdbId: number): Promise<RadarrMovie | null> {
    const movies = await this.getMoviesByTmdbId(tmdbId)
    if (!movies || movies.length === 0) return null
    // Prioritize movie entry that actually has files downloaded on disk
    return movies.find((m) => m.hasFile) || movies[0]
  }

  async deleteMovie(
    radarrId: number,
    deleteFiles = true,
    addImportExclusion = false
  ): Promise<boolean> {
    const query = `?deleteFiles=${deleteFiles}&addImportExclusion=${addImportExclusion}`
    await this.request<unknown>(`/api/v3/movie/${radarrId}${query}`, {
      method: "DELETE",
    })
    return true
  }

  async unmonitorMovie(radarrId: number): Promise<boolean> {
    const movie = await this.request<RadarrMovie>(`/api/v3/movie/${radarrId}`)
    if (!movie) return false
    await this.request<unknown>(`/api/v3/movie/${radarrId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...movie, monitored: false }),
    })
    return true
  }

  async deleteMovieFile(movieFileId: number): Promise<boolean> {
    await this.request<unknown>(`/api/v3/moviefile/${movieFileId}`, {
      method: "DELETE",
    })
    return true
  }
}

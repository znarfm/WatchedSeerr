export type MediaType = "movie" | "tv"
export type ConflictStatus = "safe" | "conflict" | "ghost"
export type WatchStatus = "unplayed" | "in_progress" | "completed"

// --- Seerr API Types ---
export interface SeerrUser {
  id: number
  email?: string
  username: string
  avatar?: string
}

export interface SeerrMediaInfo {
  id: number
  tmdbId: number
  tvdbId?: number
  status: number
  mediaType: MediaType
  createdAt: string
  updatedAt: string
}

export interface SeerrRequest {
  id: number
  status: number // 1: PENDING_APPROVAL, 2: APPROVED, 3: DECLINED
  media: SeerrMediaInfo
  createdAt: string
  updatedAt: string
  requestedBy: SeerrUser
  modifiedBy?: SeerrUser
  is4k: boolean
  serverId?: number
  profileId?: number
  rootFolder?: string
}

export interface SeerrPageInfo {
  pages: number
  pageSize: number
  results: number
  page: number
}

export interface SeerrRequestResponse {
  pageInfo: SeerrPageInfo
  results: SeerrRequest[]
}

// --- Jellyfin API Types ---
export interface JellyfinUser {
  Id: string
  Name: string
  ServerId?: string
}

export interface JellyfinUserData {
  PlaybackPositionTicks: number
  PlayCount: number
  IsFavorite: boolean
  Played: boolean
  LastPlayedDate?: string
  Key?: string
}

export interface JellyfinItem {
  Id: string
  Name: string
  ServerId?: string
  RunTimeTicks?: number
  ProductionYear?: number
  IndexNumber?: number
  ParentIndexNumber?: number
  Type: "Movie" | "Series" | "Season" | "Episode"
  UserData?: JellyfinUserData
  ProviderIds?: {
    Tmdb?: string
    Tvdb?: string
    Imdb?: string
    [key: string]: string | undefined
  }
  SeriesId?: string
  SeriesName?: string
  SeasonId?: string
  SeasonName?: string
  Path?: string
  Size?: number
}

export interface JellyfinItemsResponse {
  Items: JellyfinItem[]
  TotalRecordCount: number
  StartIndex?: number
}

// --- WatchedSeerr Domain Models ---
export interface UserPlaybackState {
  userId: string
  username: string
  isRequester: boolean
  status: WatchStatus
  progressPercent: number
  lastPlayedDate?: string
  playCount: number
  episodesWatched?: number
  totalEpisodes?: number
}

export interface EpisodePlaybackState {
  episodeId: string
  episodeNumber: number
  seasonNumber: number
  name: string
  usersWatched: {
    userId: string
    username: string
    played: boolean
    progressPercent: number
    lastPlayedDate?: string
  }[]
}

export interface AuditMediaItem {
  id: string
  requestId: number
  tmdbId: number
  jellyfinItemId?: string
  title: string
  year?: number
  mediaType: MediaType
  posterPath?: string
  sizeBytes?: number
  requestedAt: string
  requester: {
    id: number
    username: string
    avatar?: string
    matchedJellyfinUserId?: string
  }
  requesterState: UserPlaybackState
  householdStates: UserPlaybackState[]
  daysSinceLastPlayed: number | null
  conflictStatus: ConflictStatus
  conflictReason: string
  isWhitelisted: boolean
}

export interface AuditReport {
  generatedAt: string
  totalItems: number
  safeCount: number
  conflictCount: number
  ghostCount: number
  whitelistedCount: number
  items: AuditMediaItem[]
}

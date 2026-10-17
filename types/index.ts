export type MediaType = "movie" | "tv"
export type ConflictStatus = "safe" | "conflict" | "ghost" | "new"
export type WatchStatus = "unplayed" | "in_progress" | "completed"

// --- Seerr API Types ---
export interface SeerrUser {
  id: number
  email?: string
  username: string
  displayName?: string
  jellyfinUsername?: string | null
  jellyfinUserId?: string | null
  avatar?: string
}

export interface SeerrMediaInfo {
  id: number
  tmdbId: number
  tvdbId?: number
  imdbId?: string
  status: number
  mediaType: MediaType
  serviceUrl?: string
  externalServiceSlug?: string
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
  PrimaryImageTag?: string
}

export interface JellyfinUserData {
  PlaybackPositionTicks: number
  PlayCount: number
  IsFavorite: boolean
  Played: boolean
  PlayedPercentage?: number
  UnplayedItemCount?: number
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
  Overview?: string
  Genres?: string[]
  ImageTags?: {
    Primary?: string
    [key: string]: string | undefined
  }
  MediaSources?: {
    Size?: number
    MediaStreams?: {
      Type?: string
      DisplayTitle?: string
      Width?: number
      Height?: number
      Codec?: string
      VideoRange?: string
      [key: string]: any
    }[]
  }[]
  Path?: string
  Size?: number
}

export interface JellyfinItemsResponse {
  Items: JellyfinItem[]
  TotalRecordCount: number
  StartIndex?: number
}

// --- WatchedSeerr Domain Models ---
export interface MediaExternalLinks {
  imdb?: string
  letterboxd?: string
  arr?: string
  jellyfin?: string
  seerr?: string
}

export interface UserPlaybackState {
  userId: string
  username: string
  avatarUrl?: string
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

export interface AuditEpisodeItem {
  id: string
  episodeId: string // Jellyfin Episode ID
  seriesId: string
  sonarrEpisodeFileId?: number
  seasonNumber: number
  episodeNumber: number
  name: string
  progressPercent: number
  status: WatchStatus
  lastPlayedDate?: string
  sizeBytes?: number
  quality?: string
  qualityFull?: string
}

export interface AuditMediaItem {
  id: string
  requestId: number
  tmdbId: number
  imdbId?: string
  jellyfinItemId?: string
  title: string
  year?: number
  mediaType: MediaType
  posterPath?: string
  overview?: string
  genres?: string[]
  quality?: string
  qualityFull?: string
  jellyfinImageTag?: string
  sizeBytes?: number
  externalLinks?: MediaExternalLinks
  requestedAt: string
  requester: {
    id: number
    username: string
    avatar?: string
    requesterAvatarUrl?: string
    matchedJellyfinUserId?: string
  }
  requesterState: UserPlaybackState
  householdStates: UserPlaybackState[]
  daysSinceLastPlayed: number | null
  conflictStatus: ConflictStatus
  conflictReason: string
  isWhitelisted: boolean
  episodes?: AuditEpisodeItem[]
  subRows?: AuditMediaItem[]
}

export interface AuditReport {
  generatedAt: string
  totalItems: number
  safeCount: number
  newCount?: number
  conflictCount: number
  ghostCount: number
  whitelistedCount: number
  items: AuditMediaItem[]
}

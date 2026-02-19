/**
 * Media Source Plugin System — Core Type Definitions (SDK)
 *
 * These types define the contract between media sources and the app's
 * playback/UI layer. All sources must conform to these types.
 *
 * Supports both music (tracks, albums, playlists) and video content
 * (movies, series, episodes) through a unified MediaItem model.
 */

// ─── Content Types ──────────────────────────────────────────────

/** The kind of content a MediaItem represents. */
export type ContentType = 'track' | 'movie' | 'series' | 'episode';

// ─── Capabilities ───────────────────────────────────────────────

/** Declares what a source can do. The app uses this to route requests. */
export interface MediaCapabilities {
  audio: boolean;
  video: boolean;
  search: boolean;
  feed: boolean;
  suggestions: boolean;
  playlists: boolean;
  /** Source provides movie/series content */
  movies: boolean;
  /** Source can provide subtitle tracks */
  subtitles: boolean;
}

// ─── MediaItem (unified content model) ──────────────────────────

/**
 * Source-agnostic content representation.
 *
 * Works for both music tracks and video content. Music-specific fields
 * (artist) and movie-specific fields (description, year, genres, etc.)
 * are optional — sources populate what's relevant.
 */
export interface MediaItem {
  id: string;
  sourceId: string;
  contentId: string;
  title: string;
  duration: number;

  /** Content type: track (music), movie, series, or episode */
  type: ContentType;

  /** Primary image (album art for music, poster for movies) */
  artwork: string;

  /** Wide banner image (used for movie/series backdrops) */
  backdrop?: string;

  // ─── Music fields ───────────────────────────────────────────

  artist?: string;
  album?: string;

  // ─── Movie / Series fields ──────────────────────────────────

  description?: string;
  year?: number;
  genres?: string[];
  rating?: string;
  trailerUrl?: string;

  // ─── Episode-specific fields ────────────────────────────────

  seasonNumber?: number;
  episodeNumber?: number;
  seriesId?: string;
  seriesTitle?: string;
}

// ─── Playback ───────────────────────────────────────────────────

export interface AudioPlaybackInfo {
  url: string;
  headers?: Record<string, string>;
  expiresAt?: number;
}

export interface VideoPlaybackInfo {
  url: string;
  isDash: boolean;
  isHLS: boolean;
  hasAudio: boolean;
  qualities: VideoQuality[];
  defaultHeight: number;
  headers?: Record<string, string>;
}

export interface VideoQuality {
  label: string;
  height: number;
  hasAudio: boolean;
  bitrate?: number;
  variantUrl?: string;
}

// ─── Subtitles ──────────────────────────────────────────────────

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  url: string;
  format: 'srt' | 'vtt' | 'ass' | 'ttml';
  isDefault?: boolean;
}

// ─── Feed & Browse ──────────────────────────────────────────────

export interface MediaFeedSection {
  title: string;
  type: string;
  items: MediaFeedItem[];
  sourceId: string;
}

export interface MediaFeedItem {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  type: 'playlist' | 'album' | 'song' | 'artist' | 'movie' | 'series' | 'episode' | 'category' | 'unknown';
  trackId?: string;
  browseId?: string;
  backdrop?: string;
  year?: number;
  rating?: string;
}

// ─── Collections ────────────────────────────────────────────────

export interface MediaCollection {
  title: string;
  subtitle: string;
  thumbnail: string;
  backdrop?: string;
  description?: string;
  collectionType?: 'playlist' | 'album' | 'season' | 'series' | 'category';
  items: MediaItem[];
  children?: MediaCollection[];
}

// ─── Download ───────────────────────────────────────────────────

export interface DownloadInfo {
  url: string;
  contentLength: number;
  headers?: Record<string, string>;
}


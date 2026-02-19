/**
 * Media Source Interface (SDK)
 *
 * Every media source must implement this interface.
 * Sources are standalone JS bundles that export a factory function:
 *
 *   export default function createSource(host: SourceHost): MediaSource { ... }
 */

import type {
  MediaCapabilities,
  MediaItem,
  AudioPlaybackInfo,
  VideoPlaybackInfo,
  MediaFeedSection,
  MediaCollection,
  SubtitleTrack,
  DownloadInfo,
} from './media';

export interface MediaSource {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: MediaCapabilities;

  // ─── Lifecycle ──────────────────────────────────────────────

  initialize(): Promise<void>;
  dispose(): Promise<void>;

  // ─── Audio ──────────────────────────────────────────────────

  getAudioUrl(contentId: string): Promise<AudioPlaybackInfo>;
  getDirectAudioUrl(contentId: string): Promise<AudioPlaybackInfo>;
  getDownloadInfo(contentId: string): Promise<DownloadInfo>;

  // ─── Video ──────────────────────────────────────────────────

  getVideoInfo?(contentId: string): Promise<VideoPlaybackInfo | null>;
  getVideoUrlForQuality?(contentId: string, height: number): Promise<{ url: string; hasAudio: boolean } | null>;
  getFilteredHlsUrl?(height: number): string | null;

  // ─── Search ─────────────────────────────────────────────────

  search?(query: string): Promise<MediaItem[]>;
  getSearchSuggestions?(query: string): Promise<string[]>;

  // ─── Feed ───────────────────────────────────────────────────

  getHomeFeed?(): Promise<MediaFeedSection[]>;

  // ─── Collections ────────────────────────────────────────────

  getCollection?(browseId: string): Promise<MediaCollection>;

  // ─── Suggestions ────────────────────────────────────────────

  getSuggestions?(contentId: string): Promise<MediaItem[]>;

  // ─── Subtitles ──────────────────────────────────────────────

  getSubtitles?(contentId: string): Promise<SubtitleTrack[]>;

  // ─── Watch Progress ─────────────────────────────────────────

  reportProgress?(contentId: string, positionSeconds: number, durationSeconds: number): void;
  getWatchProgress?(contentId: string): number;
}

export type SourceFactory = (host: import('./host').SourceHost) => MediaSource;

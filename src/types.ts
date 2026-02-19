/**
 * YouTube Source — Internal Type Definitions
 *
 * These types model the untyped responses from the youtubei.js library.
 * They are internal to the YouTube source and not part of the public SDK.
 */

import type { Innertube } from 'youtubei.js';

// ─── Streaming / Format Types ───────────────────────────────────

export interface InnertubeFormat {
  has_video: boolean;
  has_audio: boolean;
  height?: number;
  mime_type?: string;
  quality_label?: string;
  content_length?: number;
  decipher(player: unknown): Promise<string>;
}

export interface InnertubeStreamingData {
  hls_manifest_url?: string;
  formats?: InnertubeFormat[];
  adaptive_formats?: InnertubeFormat[];
}

export interface InnertubeVideoInfo {
  streaming_data?: InnertubeStreamingData;
  basic_info?: { title?: string; channel?: { name?: string }; author?: string };
  chooseFormat(options: { quality: string; type: string }): InnertubeFormat;
  toDash(): Promise<string>;
}

export interface VideoFormatEntry {
  format: InnertubeFormat;
  hasAudio: boolean;
  label: string;
}

// ─── Cache Types ────────────────────────────────────────────────

export interface VideoInfoCache {
  contentId: string;
  info: InnertubeVideoInfo;
  innertube: Innertube;
}

export interface HlsManifestCache {
  contentId: string;
  text: string;
  hlsUrl: string;
}

// ─── Content / Shelf Types ──────────────────────────────────────

export interface InnertubeTextRun {
  text: string;
  endpoint?: { payload?: { browseId?: string } };
}

export interface InnertubeText {
  text?: string;
  runs?: InnertubeTextRun[];
  toString?(): string;
}

export interface InnertubeFlexColumn {
  title?: InnertubeText;
  text?: InnertubeText;
}

export interface InnertubeArtist {
  name?: string;
  text?: string;
}

export interface InnertubeEndpoint {
  payload?: {
    browseId?: string;
    videoId?: string;
  };
}

export interface InnertubeListItem {
  type?: string;
  id?: string;
  title?: InnertubeText;
  subtitle?: InnertubeText;
  endpoint?: InnertubeEndpoint;
  navigation_endpoint?: InnertubeEndpoint;
  overlay?: { content?: { endpoint?: InnertubeEndpoint; payload?: { videoId?: string } } };
  on_tap?: { payload?: { videoId?: string } };
  flex_columns?: InnertubeFlexColumn[];
  flexColumns?: InnertubeFlexColumn[];
  artists?: InnertubeArtist[];
  author?: { name?: string };
  thumbnail?: unknown;
  thumbnails?: Array<{ url?: string }>;
  thumbnail_renderer?: unknown;
  thumbnailRenderer?: unknown;
  [key: string]: unknown;
}

export interface InnertubeSection {
  type?: string;
  header?: { title?: InnertubeText };
  contents?: InnertubeListItem[];
}

// ─── Search Result Types ────────────────────────────────────────

export interface InnertubeVideoResult {
  id?: string;
  video_id?: string;
  title?: string | InnertubeText;
  author?: { name?: string } | string;
  best_thumbnail?: { url?: string };
  thumbnails?: Array<{ url?: string }>;
  duration?: { seconds?: number } | number;
}

// ─── Lockup / Next Endpoint Types ───────────────────────────────

export interface LockupThumbnail {
  url?: string;
}

export interface LockupContentImage {
  collectionThumbnailViewModel?: { primaryThumbnail?: { thumbnailViewModel?: { image?: { sources?: LockupThumbnail[] } } } };
  thumbnailViewModel?: { image?: { sources?: LockupThumbnail[] } };
  decoratedThumbnailViewModel?: { thumbnail?: { thumbnailViewModel?: { image?: { sources?: LockupThumbnail[] } } } };
}

export interface LockupMetadataPart {
  text?: { content?: string };
}

export interface LockupMetadataRow {
  metadataParts?: LockupMetadataPart[];
}

export interface LockupViewModel {
  contentId?: string;
  metadata?: {
    lockupMetadataViewModel?: {
      title?: { content?: string };
      metadata?: {
        contentMetadataViewModel?: {
          metadataRows?: LockupMetadataRow[];
        };
      };
    };
  };
  contentImage?: LockupContentImage;
}

export interface CompactVideoRenderer {
  videoId?: string;
  title?: { simpleText?: string; runs?: Array<{ text?: string }> };
  longBylineText?: { runs?: Array<{ text?: string }> };
  shortBylineText?: { runs?: Array<{ text?: string }> };
  thumbnail?: { thumbnails?: Array<{ url?: string }> };
  lengthText?: { simpleText?: string };
}

export interface NextEndpointResult {
  lockupViewModel?: LockupViewModel;
  compactVideoRenderer?: CompactVideoRenderer;
}

/**
 * YouTube Source — Standalone Bundle Entry Point
 *
 * This file is the entry point for building the YouTube source as a
 * standalone JS bundle. It uses ONLY the SourceHost APIs (no @/ imports).
 *
 * Build: esbuild/rollup bundles this + youtubei.js into a single JS file.
 *
 * Bundle format:
 *   module.exports = function createSource(host) { ... return source; }
 */

import { Innertube, ClientType, Platform as YTPlatform } from 'youtubei.js';
import type { SourceHost } from '../types/host';
import type { MediaSource } from '../types/source';
import type {
  MediaItem,
  AudioPlaybackInfo,
  VideoPlaybackInfo,
  VideoQuality,
  MediaFeedSection,
  MediaFeedItem,
  MediaCollection,
  DownloadInfo,
} from '../types/media';

const SOURCE_ID = 'youtube';
const YT_USER_AGENT = 'com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip';

import type {
  InnertubeFormat,
  InnertubeVideoInfo,
  VideoFormatEntry,
  VideoInfoCache,
  HlsManifestCache,
  InnertubeText,
  InnertubeListItem,
  InnertubeSection,
  InnertubeVideoResult,
  LockupViewModel,
  NextEndpointResult,
} from './types';

// ─── Player Cacher (fetch-only, no file system) ─────────────────

class PlayerCacher {
  cache_dir = '';
  private _fetch: typeof globalThis.fetch;

  constructor(fetchFn: typeof globalThis.fetch) {
    this._fetch = fetchFn;
  }

  async get(player_id: string): Promise<ArrayBuffer | undefined> {
    const req = await this._fetch(
      `https://raw.githubusercontent.com/lovegaoshi/my-express-api/refs/heads/ghactions/cachedPlayers/${player_id}`,
    );
    if (req.ok) return req.arrayBuffer();
    const latestReq = await this._fetch(
      'https://raw.githubusercontent.com/lovegaoshi/my-express-api/refs/heads/ghactions/cachedPlayers/latest',
    );
    const ghCache = await latestReq.text();
    const req2 = await this._fetch(
      `https://raw.githubusercontent.com/lovegaoshi/my-express-api/refs/heads/ghactions/cachedPlayers/${ghCache}`,
    );
    if (req2.ok) return req2.arrayBuffer();
    const req3 = await this._fetch(
      `https://ytb-cache.netlify.app/api?playerURL=${player_id}`,
    );
    if (req3.ok) return req3.arrayBuffer();
    return undefined;
  }

  async set(): Promise<void> { }
  async remove(): Promise<void> { }
}

// ─── Factory ────────────────────────────────────────────────────

export default function createYouTubeSource(host: SourceHost): MediaSource {
  // ── Innertube Client Management ─────────────────────────────

  const clientsMap: Record<string, Innertube> = {};
  const pendingMap: Record<string, Promise<Innertube>> = {};

  function setupEval(): void {
    YTPlatform.shim.eval = async (
      code: string,
      env: Record<string, string | number | boolean | null | undefined>,
    ) => {
      const properties: string[] = [];
      if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
      if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
      const fullCode = `${code}\nreturn { ${properties.join(', ')} }`;
      return new Function(fullCode)();
    };
  }
  setupEval();

  function getInnertube(
    type: ClientType = ClientType.MWEB,
    forceRecreate = false,
  ): Promise<Innertube> {
    if (clientsMap[type] && !forceRecreate) return Promise.resolve(clientsMap[type]);
    if (type in pendingMap && !forceRecreate) return pendingMap[type];
    pendingMap[type] = Innertube.create({
      retrieve_player: false,
      enable_session_cache: false,
      generate_session_locally: false,
      client_type: type,
      cache: new PlayerCacher(host.fetch),
    }).then((instance) => {
      clientsMap[type] = instance;
      delete pendingMap[type];
      return instance;
    });
    return pendingMap[type];
  }

  // ── Video Info Cache ────────────────────────────────────────

  let _videoInfoCache: VideoInfoCache | null = null;
  let _hlsManifestCache: HlsManifestCache | null = null;

  async function getCachedVideoInfo(contentId: string): Promise<{ info: InnertubeVideoInfo; innertube: Innertube }> {
    if (_videoInfoCache?.contentId === contentId) {
      return { info: _videoInfoCache.info, innertube: _videoInfoCache.innertube };
    }
    const innertube = await getInnertube();
    const info = await innertube.getShortsVideoInfo(contentId, 'ANDROID') as unknown as InnertubeVideoInfo;
    _videoInfoCache = { contentId, info, innertube };
    return { info, innertube };
  }

  // ── Source Implementation ───────────────────────────────────

  const source: MediaSource = {
    id: SOURCE_ID,
    name: 'YouTube Music',
    version: '1.0.0',
    capabilities: {
      audio: true,
      video: true,
      search: true,
      feed: true,
      suggestions: true,
      playlists: true,
      movies: false,
      subtitles: false,
    },

    async initialize(): Promise<void> {
      await Promise.allSettled([
        getInnertube(ClientType.MWEB),
        getInnertube(ClientType.WEB),
        getInnertube(ClientType.ANDROID_MUSIC),
      ]);
    },

    async dispose(): Promise<void> {
      Object.keys(clientsMap).forEach((key) => delete clientsMap[key]);
      Object.keys(pendingMap).forEach((key) => delete pendingMap[key]);
    },

    // ── Audio ─────────────────────────────────────────────────

    async getAudioUrl(contentId: string): Promise<AudioPlaybackInfo> {
      const innertube = await getInnertube();

      if (host.platform === 'ios') {
        try {
          const basicInfo = await innertube.getBasicInfo(contentId, 'IOS' as 'IOS');
          const hlsUrl = basicInfo.streaming_data?.hls_manifest_url;
          if (hlsUrl) {
            host.log('Got HLS URL for', contentId);
            return { url: hlsUrl, headers: { 'User-Agent': YT_USER_AGENT } };
          }
        } catch (e) {
          host.log('IOS client failed for', contentId, e);
        }
        host.log('No HLS URL for', contentId, ', trying ANDROID');
      }

      const info = await innertube.getShortsVideoInfo(contentId, 'ANDROID') as unknown as InnertubeVideoInfo;
      const format = info.chooseFormat({ quality: 'best', type: 'audio' });
      const url = await format.decipher(innertube.session.player);
      host.log('Got direct URL for', contentId, `(${format.mime_type})`);
      return { url, headers: { 'User-Agent': YT_USER_AGENT } };
    },

    async getDirectAudioUrl(contentId: string): Promise<AudioPlaybackInfo> {
      const innertube = await getInnertube();
      const info = await innertube.getShortsVideoInfo(contentId, 'ANDROID') as unknown as InnertubeVideoInfo;
      const format = info.chooseFormat({ quality: 'best', type: 'audio' });
      const url = await format.decipher(innertube.session.player);
      return { url, headers: { 'User-Agent': YT_USER_AGENT } };
    },

    async getDownloadInfo(contentId: string): Promise<DownloadInfo> {
      const innertube = await getInnertube();
      const info = await innertube.getShortsVideoInfo(contentId, 'ANDROID') as unknown as InnertubeVideoInfo;
      const format = info.chooseFormat({ quality: 'best', type: 'audio' });
      const url = await format.decipher(innertube.session.player);
      return {
        url,
        contentLength: format.content_length ?? 0,
        headers: { 'User-Agent': YT_USER_AGENT },
      };
    },

    // ── Video ─────────────────────────────────────────────────

    async getVideoInfo(contentId: string): Promise<VideoPlaybackInfo | null> {
      try {
        const { info, innertube } = await getCachedVideoInfo(contentId);
        const sd = info.streaming_data;
        if (!sd) return null;

        // iOS → HLS
        if (host.platform === 'ios') {
          let hlsUrl: string | undefined = sd.hls_manifest_url;

          if (!hlsUrl) {
            try {
              const basicInfo = await innertube.getBasicInfo(contentId, 'IOS' as 'IOS');
              hlsUrl = basicInfo.streaming_data?.hls_manifest_url;
            } catch (e) {
              host.log('IOS client getBasicInfo failed:', e);
            }
          }

          if (hlsUrl) {
            let hlsQualities: VideoQuality[] = [];
            try {
              hlsQualities = await parseHlsQualities(hlsUrl, contentId);
            } catch (e) {
              host.log('Quality parsing failed, using Auto:', e);
            }
            return { url: hlsUrl, isDash: false, isHLS: true, hasAudio: true, qualities: hlsQualities, defaultHeight: 0 };
          }
        }

        // Android → DASH
        if (host.platform === 'android') {
          try {
            const manifest = await info.toDash();
            const uri = host.writeCacheFile('dash_manifest.mpd', manifest);
            return { url: uri, isDash: true, isHLS: false, hasAudio: true, qualities: [], defaultHeight: 0 };
          } catch (e) {
            host.log('DASH generation failed:', e);
          }
        }

        // Fallback → progressive
        const muxedFormats = (sd.formats ?? []).filter((f) => f.has_video && f.has_audio && f.mime_type?.startsWith('video/'));
        const adaptiveVideoFormats = (sd.adaptive_formats ?? []).filter((f) => f.has_video && !f.has_audio && f.mime_type?.startsWith('video/'));

        const byHeight = new Map<number, VideoFormatEntry>();
        for (const f of muxedFormats) { const h = f.height; if (h) byHeight.set(h, { format: f, hasAudio: true, label: f.quality_label || `${h}p` }); }
        for (const f of adaptiveVideoFormats) { const h = f.height; if (h && !byHeight.has(h)) byHeight.set(h, { format: f, hasAudio: false, label: f.quality_label || `${h}p` }); }

        const qualities: VideoQuality[] = [];
        for (const [height, entry] of byHeight) qualities.push({ label: entry.label, height, hasAudio: entry.hasAudio });
        qualities.sort((a, b) => a.height - b.height);

        if (qualities.length === 0) return null;

        const defaultQ = qualities.reduce((best, q) => Math.abs(q.height - 720) < Math.abs(best.height - 720) ? q : best);
        const entry = byHeight.get(defaultQ.height)!;
        const url = await entry.format.decipher(innertube.session.player);
        return { url, isDash: false, isHLS: false, hasAudio: entry.hasAudio, qualities, defaultHeight: defaultQ.height };
      } catch (e) {
        host.log('Failed to fetch video info:', e);
        return null;
      }
    },

    async getVideoUrlForQuality(contentId: string, targetHeight: number): Promise<{ url: string; hasAudio: boolean } | null> {
      try {
        const { info, innertube } = await getCachedVideoInfo(contentId);
        const sd = info.streaming_data;
        if (!sd) return null;

        const muxed = (sd.formats ?? []).find((f) => f.has_video && f.has_audio && f.height === targetHeight && f.mime_type?.startsWith('video/'));
        if (muxed) return { url: await muxed.decipher(innertube.session.player), hasAudio: true };

        const adaptive = (sd.adaptive_formats ?? []).find((f) => f.has_video && !f.has_audio && f.height === targetHeight && f.mime_type?.startsWith('video/'));
        if (adaptive) return { url: await adaptive.decipher(innertube.session.player), hasAudio: false };
        return null;
      } catch { return null; }
    },

    getFilteredHlsUrl(height: number): string | null {
      if (!_hlsManifestCache) return null;
      const { text } = _hlsManifestCache;
      const lines = text.split('\n');
      const filtered: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('#EXT-X-STREAM-INF:')) { filtered.push(lines[i]); continue; }
        const codecsMatch = line.match(/CODECS="([^"]+)"/);
        const isH264 = !codecsMatch || codecsMatch[1].includes('avc1');
        const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
        const matchesHeight = resMatch && resMatch[2] === String(height);

        if (isH264 && matchesHeight) {
          filtered.push(lines[i]);
          for (let j = i + 1; j < lines.length; j++) { const next = lines[j].trim(); if (next && !next.startsWith('#')) { filtered.push(lines[j]); i = j; break; } }
        } else {
          for (let j = i + 1; j < lines.length; j++) { const next = lines[j].trim(); if (next && !next.startsWith('#')) { i = j; break; } }
        }
      }

      return host.writeCacheFile(`hls_${height}p.m3u8`, filtered.join('\n'));
    },

    // ── Search ────────────────────────────────────────────────

    async search(query: string): Promise<MediaItem[]> {
      const innertube = await getInnertube(ClientType.WEB);
      const results = await innertube.search(query, { type: 'video' });
      const videos = (results.videos ?? []) as InnertubeVideoResult[];
      return videos.map((video): MediaItem | null => {
        const videoId = video.id;
        if (!videoId) return null;
        const rawTitle = video.title;
        const title = typeof rawTitle === 'string'
          ? rawTitle
          : (rawTitle as InnertubeText)?.text ?? 'Unknown';
        const rawAuthor = video.author;
        const artist = typeof rawAuthor === 'string'
          ? rawAuthor
          : (rawAuthor as { name?: string })?.name ?? 'Unknown';
        const artwork = video.best_thumbnail?.url ?? '';
        const rawDur = video.duration;
        const duration = typeof rawDur === 'number'
          ? rawDur
          : (rawDur as { seconds?: number })?.seconds ?? 0;
        return { id: videoId, sourceId: SOURCE_ID, type: 'track', title, artist, artwork, duration, contentId: videoId };
      }).filter((t): t is MediaItem => t !== null);
    },

    async getSearchSuggestions(query: string): Promise<string[]> {
      try {
        const innertube = await getInnertube(ClientType.ANDROID_MUSIC);
        const shelves = await innertube.music.getSearchSuggestions(query);
        const suggestions: string[] = [];
        for (const shelf of shelves) {
          if (shelf.type === 'SearchSuggestionsSection') {
            for (const item of shelf.contents) {
              if (item.type === 'SearchSuggestion') {
                const suggestion = (item as unknown as { suggestion: InnertubeText }).suggestion;
                if (suggestion?.text) suggestions.push(suggestion.text);
              }
            }
          }
        }
        return suggestions.filter(Boolean);
      } catch { return []; }
    },

    // ── Feed ──────────────────────────────────────────────────

    async getHomeFeed(): Promise<MediaFeedSection[]> {
      try {
        const innertube = await getInnertube(ClientType.ANDROID_MUSIC);
        const music = innertube.music as unknown as { getHomeFeed?(): Promise<{ sections?: InnertubeSection[] }> };
        if (!music?.getHomeFeed) return [];

        const feed = await music.getHomeFeed();
        const sections: MediaFeedSection[] = [];

        for (const section of feed?.sections ?? []) {
          if ((section.type ?? '') === 'MusicTasteBuilderShelf') continue;
          const title = section?.header?.title?.text ?? '';
          if (!title) continue;

          const items: MediaFeedItem[] = [];
          for (const item of section?.contents ?? []) {
            try {
              const parsed = parseMusicItem(item);
              if (parsed) items.push(parsed);
            } catch { /* skip malformed items */ }
          }
          if (items.length > 0) sections.push({ title, type: section.type ?? 'Unknown', items, sourceId: SOURCE_ID });
        }
        return sections;
      } catch (e) {
        host.log('getHomeFeed error:', e);
        return [];
      }
    },

    // ── Collections ───────────────────────────────────────────

    async getCollection(browseId: string): Promise<MediaCollection> {
      if (browseId.startsWith('MPRE')) return fetchAlbum(browseId);

      const innertube = await getInnertube(ClientType.ANDROID_MUSIC);
      const music = innertube.music as unknown as { getPlaylist(id: string): Promise<Record<string, unknown>> };
      const playlist = await music.getPlaylist(browseId);
      const header = playlist.header as { title?: InnertubeText; subtitle?: InnertubeText; thumbnail?: { contents?: Array<{ url?: string }> }; thumbnails?: Array<{ url?: string }> } | undefined;
      const title = header?.title?.text ?? (playlist.title as string) ?? 'Playlist';
      const subtitle = header?.subtitle?.text ?? '';
      const thumbnail = extractHeaderThumbnail(playlist);

      const collectionItems: MediaItem[] = [];
      const contents = (playlist.contents ?? []) as InnertubeListItem[];
      for (const item of contents) {
        try { const t = parseMusicListItem(item); if (t) collectionItems.push(t); } catch { /* skip */ }
      }
      return { title, subtitle, thumbnail, items: collectionItems, collectionType: 'playlist' };
    },

    // ── Suggestions ───────────────────────────────────────────

    async getSuggestions(contentId: string): Promise<MediaItem[]> {
      // Strategy 1: /next endpoint
      try {
        const innertube = await getInnertube(ClientType.WEB);
        const actions = innertube.actions as unknown as { execute(endpoint: string, params: Record<string, string>): Promise<{ data: Record<string, unknown> }> };
        const response = await actions.execute('/next', { videoId: contentId, client: 'WEB' });
        const secondaryResults = (
          response?.data?.contents as Record<string, unknown> | undefined
        )?.twoColumnWatchNextResults as Record<string, unknown> | undefined;
        const results = (
          (secondaryResults?.secondaryResults as Record<string, unknown>)?.secondaryResults as Record<string, unknown>
        )?.results as NextEndpointResult[] | undefined;

        if (Array.isArray(results)) {
          const tracks: MediaItem[] = [];
          for (const item of results) {
            try {
              if (item.lockupViewModel) {
                const t = parseLockupViewModel(item.lockupViewModel);
                if (t && t.id !== contentId) tracks.push(t);
                continue;
              }
              if (item.compactVideoRenderer?.videoId) {
                const renderer = item.compactVideoRenderer;
                tracks.push({
                  id: renderer.videoId!,
                  sourceId: SOURCE_ID,
                  type: 'track',
                  title: renderer.title?.simpleText ?? renderer.title?.runs?.[0]?.text ?? 'Unknown',
                  artist: renderer.longBylineText?.runs?.[0]?.text ?? renderer.shortBylineText?.runs?.[0]?.text ?? 'Unknown',
                  artwork: getBestThumbnail(renderer.thumbnail?.thumbnails),
                  duration: parseDuration(renderer.lengthText?.simpleText),
                  contentId: renderer.videoId!,
                });
              }
            } catch { /* skip */ }
          }
          if (tracks.length > 0) return tracks.slice(0, 20);
        }
      } catch { /* fall through to search */ }

      // Strategy 2: search fallback
      try {
        const innertube = await getInnertube(ClientType.WEB);
        let searchQuery = contentId;
        try {
          const info = await innertube.getBasicInfo(contentId);
          const bi = info.basic_info;
          if (bi?.title) searchQuery = `${bi.title} ${bi.channel?.name ?? bi.author ?? ''}`.trim();
        } catch { /* use contentId */ }
        const sr = await innertube.search(searchQuery, { type: 'video' });
        const videos = ((sr as unknown as { results?: InnertubeVideoResult[] }).results ?? (sr.videos ?? [])) as InnertubeVideoResult[];
        return videos
          .filter((v) => {
            const id = v.id ?? v.video_id;
            return id && id !== contentId;
          })
          .slice(0, 20)
          .map((v): MediaItem | null => {
            const id = v.id ?? v.video_id;
            if (!id) return null;
            const rawTitle = v.title;
            const title = typeof rawTitle === 'string'
              ? rawTitle
              : (rawTitle as InnertubeText)?.text ?? 'Unknown';
            const rawAuthor = v.author;
            const artist = typeof rawAuthor === 'string'
              ? rawAuthor
              : (rawAuthor as { name?: string })?.name ?? 'Unknown';
            return {
              id, sourceId: SOURCE_ID, type: 'track', title, artist,
              artwork: v.best_thumbnail?.url ?? v.thumbnails?.[0]?.url ?? '',
              duration: typeof v.duration === 'number' ? v.duration : ((v.duration as { seconds?: number })?.seconds ?? 0),
              contentId: id,
            };
          })
          .filter((t): t is MediaItem => t !== null);
      } catch { /* give up */ }
      return [];
    },
  };

  return source;

  // ─── Internal Helpers ───────────────────────────────────────

  async function parseHlsQualities(hlsUrl: string, contentId: string): Promise<VideoQuality[]> {
    const res = await host.fetch(hlsUrl, { headers: { 'User-Agent': YT_USER_AGENT } });
    const text = await res.text();
    _hlsManifestCache = { contentId, text, hlsUrl };

    const lines = text.split('\n');
    const byHeight = new Map<number, VideoQuality>();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
      const codecsMatch = line.match(/CODECS="([^"]+)"/);
      if (codecsMatch && !codecsMatch[1].includes('avc1')) continue;
      const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
      const bwMatch = line.match(/BANDWIDTH=(\d+)/);
      if (!resMatch || !bwMatch) continue;
      const height = parseInt(resMatch[2], 10);
      const bitrate = parseInt(bwMatch[1], 10);
      const existing = byHeight.get(height);
      if (!existing || (existing.bitrate ?? 0) < bitrate) {
        byHeight.set(height, { label: `${height}p`, height, hasAudio: true, bitrate });
      }
    }
    return Array.from(byHeight.values()).sort((a, b) => a.height - b.height);
  }

  async function fetchAlbum(browseId: string): Promise<MediaCollection> {
    const innertube = await getInnertube(ClientType.ANDROID_MUSIC);
    const music = innertube.music as unknown as { getAlbum(id: string): Promise<Record<string, unknown>> };
    const album = await music.getAlbum(browseId);
    const header = album.header as { title?: InnertubeText; subtitle?: InnertubeText; strapline_text_one?: InnertubeText; thumbnail?: { contents?: Array<{ url?: string }> }; thumbnails?: Array<{ url?: string }> } | undefined;
    const title = header?.title?.text ?? (album.title as string) ?? 'Album';
    const subtitle = header?.subtitle?.text ?? '';
    const thumbnail = extractHeaderThumbnail(album);

    const rawItems = (
      album.contents ?? (album.music_shelf as Record<string, unknown>)?.contents ??
      ((album.section_list as Record<string, unknown>)?.contents as InnertubeListItem[] | undefined)?.[0]?.contents ??
      []
    ) as InnertubeListItem[];

    // Extract album artist
    let albumArtist = header?.strapline_text_one?.text ?? '';
    if (!albumArtist && header?.subtitle?.runs) {
      for (const run of header.subtitle.runs) {
        const ep = run?.endpoint?.payload;
        if (ep?.browseId && !ep.browseId.startsWith('MPRE')) { albumArtist = run.text; break; }
      }
    }
    if (!albumArtist && subtitle.includes('•')) {
      const parts = subtitle.split('•').map((s) => s.trim());
      albumArtist = parts.find((p) => p && !/^\d{4}$/.test(p) && !/^\d+\s*(song|track|bài)/i.test(p) && !/^album$/i.test(p)) ?? '';
    }

    const collectionItems: MediaItem[] = [];
    for (const item of rawItems) {
      try {
        const t = parseMusicListItem(item, albumArtist);
        if (t) {
          if (!t.artwork && thumbnail) t.artwork = thumbnail;
          collectionItems.push(t);
        }
      } catch { /* skip */ }
    }
    return { title, subtitle, thumbnail, items: collectionItems, collectionType: 'album' };
  }

  function extractHeaderThumbnail(obj: Record<string, unknown>): string {
    try {
      const header = obj.header as Record<string, unknown> | undefined;
      const thumbContents = (header?.thumbnail as Record<string, unknown>)?.contents as Array<{ url?: string }> | undefined;
      const headerThumbs = header?.thumbnails as Array<{ url?: string }> | undefined;
      const bgContents = (obj.background as Record<string, unknown>)?.contents as Array<{ url?: string }> | undefined;
      const thumbs = thumbContents ?? headerThumbs ?? bgContents;
      if (Array.isArray(thumbs) && thumbs.length > 0) return thumbs[thumbs.length - 1]?.url ?? thumbs[0]?.url ?? '';
    } catch { /* ignore */ }
    return '';
  }

  function parseMusicListItem(item: InnertubeListItem, fallbackArtist?: string): MediaItem | null {
    const itemType = item.type ?? '';
    if (itemType === 'MusicResponsiveListItem') {
      const flexCols = item.flex_columns ?? item.flexColumns ?? [];
      let title = '', artist = '';
      if (flexCols[0]) {
        const col = flexCols[0].title ?? flexCols[0].text;
        title = col?.text ?? col?.runs?.[0]?.text ?? '';
      }
      if (flexCols[1]) {
        const col = flexCols[1].title ?? flexCols[1].text;
        artist = col?.text ?? '';
        if (!artist && col?.runs) artist = col.runs.map((r) => r.text).filter(Boolean).join(', ');
      }
      if (!artist) {
        if (Array.isArray(item.artists)) artist = item.artists.map((a) => a?.name ?? a?.text ?? '').filter(Boolean).join(', ');
        else if (item.author?.name) artist = item.author.name;
      }
      const videoId = item.overlay?.content?.endpoint?.payload?.videoId ?? item.id ?? '';
      if (!videoId || !title) return null;
      return { id: videoId, sourceId: SOURCE_ID, type: 'track', title, artist: artist || fallbackArtist || 'Unknown', artwork: deepExtractThumbnail(item), duration: 0, contentId: videoId };
    }
    if (itemType === 'MusicTwoRowItem') {
      const title = item.title?.text ?? '';
      const subtitle = item.subtitle?.text ?? '';
      const videoId = item.endpoint?.payload?.videoId ?? item.id ?? '';
      if (!videoId || !title) return null;
      return { id: videoId, sourceId: SOURCE_ID, type: 'track', title, artist: subtitle || fallbackArtist || 'Unknown', artwork: deepExtractThumbnail(item), duration: 0, contentId: videoId };
    }
    return null;
  }

  function parseMusicItem(item: InnertubeListItem): MediaFeedItem | null {
    if ((item.type ?? '') !== 'MusicTwoRowItem') return null;
    const title = item.title?.text ?? item.title?.toString?.() ?? '';
    const subtitle = item.subtitle?.text ?? item.subtitle?.toString?.() ?? '';
    const endpoint = item.endpoint ?? item.navigation_endpoint;
    const browseId = endpoint?.payload?.browseId ?? '';
    const videoId = endpoint?.payload?.videoId ?? item.overlay?.content?.payload?.videoId ?? item.on_tap?.payload?.videoId ?? item.id ?? '';
    const isValidVideoId = !!videoId && videoId.length === 11 && !videoId.startsWith('VL') && !videoId.startsWith('MPR');

    let type: MediaFeedItem['type'] = 'unknown';
    if (isValidVideoId) {
      type = 'song';
    } else if (browseId) {
      const lower = subtitle.toLowerCase();
      if (lower.includes('album')) type = 'album';
      else if (lower.includes('artist')) type = 'artist';
      else if (lower.includes('song') || lower.includes('single')) type = 'song';
      else type = 'playlist';
    }
    if (!title) return null;
    return { id: browseId || videoId || title, title, subtitle, thumbnail: deepExtractThumbnail(item), type, trackId: isValidVideoId ? videoId : undefined, browseId: browseId || undefined };
  }

  function parseLockupViewModel(lockup: LockupViewModel): MediaItem | null {
    const videoId = lockup.contentId;
    if (!videoId) return null;
    const title = lockup.metadata?.lockupMetadataViewModel?.title?.content ?? 'Unknown';
    let artist = 'Unknown';
    try {
      const rows = lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows;
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const parts = row?.metadataParts;
          if (Array.isArray(parts)) {
            for (const part of parts) {
              if (part?.text?.content && artist === 'Unknown') artist = part.text.content;
            }
          }
        }
      }
    } catch { /* ignore */ }
    let artwork = '';
    try {
      const ci = lockup.contentImage;
      const sources =
        ci?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources ??
        ci?.thumbnailViewModel?.image?.sources ??
        ci?.decoratedThumbnailViewModel?.thumbnail?.thumbnailViewModel?.image?.sources;
      if (Array.isArray(sources) && sources.length > 0) artwork = sources[sources.length - 1]?.url ?? '';
    } catch { /* ignore */ }
    if (!artwork) artwork = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return { id: videoId, sourceId: SOURCE_ID, type: 'track', title, artist, artwork, duration: 0, contentId: videoId };
  }

  function deepExtractThumbnail(item: InnertubeListItem): string {
    try {
      const thumb = item.thumbnail;
      if (Array.isArray(thumb)) {
        const best = thumb[thumb.length - 1] as { url?: string } | undefined;
        if (best?.url) return best.url;
      }
      if (thumb && typeof thumb === 'object' && 'contents' in thumb) {
        const contents = (thumb as { contents?: Array<{ url?: string }> }).contents;
        if (Array.isArray(contents) && contents.length > 0) {
          const best = contents[contents.length - 1];
          if (best?.url) return best.url;
        }
      }
      if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
        const best = item.thumbnails[item.thumbnails.length - 1];
        if (best?.url) return best.url;
      }
    } catch { /* ignore */ }
    try {
      const r = item.thumbnail_renderer ?? item.thumbnailRenderer;
      if (r && typeof r === 'object') {
        const renderer = r as { thumbnail?: { thumbnails?: Array<{ url?: string }> }; contents?: Array<{ url?: string }>; thumbnails?: Array<{ url?: string }> };
        const musicThumbs = renderer.thumbnail?.thumbnails ?? renderer.contents;
        if (Array.isArray(musicThumbs) && musicThumbs.length > 0) return musicThumbs[musicThumbs.length - 1]?.url ?? '';
        if (Array.isArray(renderer.thumbnails) && renderer.thumbnails.length > 0) return renderer.thumbnails[renderer.thumbnails.length - 1]?.url ?? '';
      }
    } catch { /* ignore */ }
    try {
      for (const key of Object.keys(item)) {
        const val = item[key];
        if (!val || typeof val !== 'object') continue;
        if (Array.isArray(val)) {
          for (const entry of val) {
            if (entry && typeof entry === 'object' && 'url' in entry && typeof (entry as { url: unknown }).url === 'string' && ((entry as { url: string }).url).startsWith('http')) return (entry as { url: string }).url;
          }
        }
        const objVal = val as Record<string, unknown>;
        if (objVal.thumbnails && Array.isArray(objVal.thumbnails)) {
          const best = (objVal.thumbnails as Array<{ url?: string }>)[objVal.thumbnails.length - 1];
          if (best?.url) return best.url;
        }
        if (objVal.contents && Array.isArray(objVal.contents)) {
          for (const c of objVal.contents as Array<Record<string, unknown>>) {
            if (c?.url && typeof c.url === 'string' && (c.url as string).startsWith('http')) return c.url as string;
            if (c?.thumbnails && Array.isArray(c.thumbnails)) {
              const best = (c.thumbnails as Array<{ url?: string }>)[(c.thumbnails as unknown[]).length - 1];
              if (best?.url) return best.url;
            }
          }
        }
      }
    } catch { /* ignore */ }
    return '';
  }

  function parseDuration(text?: string): number {
    if (!text) return 0;
    const parts = text.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function getBestThumbnail(thumbnails?: Array<{ url?: string }>): string {
    if (!Array.isArray(thumbnails) || thumbnails.length === 0) return '';
    return thumbnails[thumbnails.length - 1]?.url ?? '';
  }
}

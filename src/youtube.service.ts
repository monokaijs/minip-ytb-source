import Innertube, {ClientType} from "youtubei.js/react-native";
import {SearchResponse, Track, VideoSearchResult} from "./types/music";
import {YTNodes} from "youtubei.js";
import CookieManager from "@react-native-cookies/cookies";

const YOUTUBE_BASE = 'https://m.youtube.com';

class YoutubeService {
  clients: Map<ClientType, Innertube> = new Map();
  private lastSearch: any;
  private lastSearchQuery: string = '';

  async start() {
    await this.getClient(ClientType.WEB);
    await this.getClient(ClientType.ANDROID);
    await this.getClient(ClientType.MWEB);
    await this.getClient(ClientType.MUSIC);
  }

  async getClient(type: ClientType = ClientType.WEB): Promise<Innertube> {
    let client: Innertube;
    if (!this.clients.has(type)) {
      const cookies = await CookieManager.get(YOUTUBE_BASE, true);
      const cookieString = Object.entries(cookies).map(([key, value]) => `${key}=${value.value}`).join('; ');
      client = await Innertube.create({
        retrieve_player: false,
        enable_session_cache: false,
        generate_session_locally: false,
        client_type: type,
        player_id: "0004de42",
        ...(type !== ClientType.ANDROID && {cookie: cookieString}),
        fetch: (url, init) => {
          // @ts-ignore
          if (typeof init?.headers?.set === 'function') {
            (init?.headers as any)?.set('origin', 'https://www.youtube.com');
            (init?.headers as any)?.set('referer', 'https://www.youtube.com');
            (init?.headers as any)?.set('x-origin', 'https://www.youtube.com');
            (init?.headers as any)?.set('sec-fetch-dest', 'empty');
            (init?.headers as any)?.set('sec-fetch-mode', 'same-origin');
            (init?.headers as any)?.set('sec-fetch-site', 'same-origin');
          }
          return fetch(url, init);
        },
      })
      this.clients.set(type, client);
    } else {
      client = this.clients.get(type)!;
    }
    return client;
  }

  clearClients() {
    this.clients.clear();
  }

  async searchVideos(query: string, pageToken?: string): Promise<SearchResponse> {
    let search;
    if (pageToken && this.lastSearchQuery === query && this.lastSearch?.has_continuation) {
      search = await this.lastSearch.getContinuation();
    } else {
      const client = await this.getClient();
      search = await client.search(query);
      this.lastSearchQuery = query;
    }
    this.lastSearch = search;

    const results: VideoSearchResult[] = [];
    const seenIds = new Set<string>();

    for (const item of search.results) {
      if (item.type === 'Video' || item.type === 'MusicResponsiveListItem') {
        const video = item as any;
        const videoId = video.id || video.video_id;
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          results.push({
            id: videoId,
            title: video.title?.text || video.title || '',
            artist: video.author?.name || video.artists?.[0]?.name || video.author || '',
            thumbnail: video.thumbnails?.[0]?.url || video.thumbnail?.contents?.[0]?.url || '',
            duration: video.duration?.seconds || video.duration || 0,
            viewCount: video.view_count?.text || '',
          });
        }
      }
    }
    return {
      results,
      nextPageToken: search.has_continuation ? 'continue' : undefined,
    };
  }

  async getPlaylists() {
    const client = await this.getClient(ClientType.WEB);
    const library = await client.getLibrary();
    return library.playlists;
  }

  async getPlaylist(playlistId: string) {
    const client = await this.getClient(ClientType.MWEB);
    return await client.music.getPlaylist(playlistId);
  }

  async getPlayableUrl(videoId: string): Promise<string> {
    const client = await this.getClient(ClientType.ANDROID);
    const info = await client.getBasicInfo(videoId);
    const format = info.chooseFormat({
      type: 'audio',
      quality: 'best',
    });

    if (!format) {
      throw new Error('No audio format available');
    }

    return format.decipher(client.session.player);
  }

  async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      const client = await this.getClient();
      return await client.getSearchSuggestions(query);
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  async getYouTubeSuggestions(videoId: string, size: number = 10): Promise<Track[]> {
    try {
      const client = await this.getClient(ClientType.WEB);
      const info = await client.getInfo(videoId);
      const videoIds = info.watch_next_feed?.map((x: any) => x.as(YTNodes.LockupView).content_id) || [];
      const videos = await Promise.all(videoIds.map(async (id: string) => {
        try {
          return await client.getBasicInfo(id)
        } catch (error) {
          return null as any;
        }
      }));
      return (videos).filter(video => !!video).slice(0, size).filter(video => !!video.basic_info && !!video.basic_info.id).map(video => {
        const info = video.basic_info!;
        return {
          title: info.title || '',
          artist: info.author || '',
          artwork: info.thumbnail?.[0].url || '',
          duration: info.duration || 0,
          id: info.id!,
          videoId: info.id!,
          addedAt: Date.now(),
          source: 'minip-ytb',
        }
      });
    } catch (error) {
      console.log('error', error);
      return [];
    }
  }
}

export const youtubeService = new YoutubeService();

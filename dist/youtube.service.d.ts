import Innertube, { ClientType } from "youtubei.js/react-native";
import { SearchResponse, Track } from "./types/music";
import { YTNodes } from "youtubei.js";
declare class YoutubeService {
    clients: Map<ClientType, Innertube>;
    private lastSearch;
    private lastSearchQuery;
    start(): Promise<void>;
    getClient(type?: ClientType): Promise<Innertube>;
    clearClients(): void;
    searchVideos(query: string, pageToken?: string): Promise<SearchResponse>;
    getPlaylists(): Promise<import("node_modules/youtubei.js/dist/src/parser/helpers").ObservedArray<YTNodes.GridPlaylist | YTNodes.LockupView | YTNodes.Playlist>>;
    getPlaylist(playlistId: string): Promise<import("node_modules/youtubei.js/dist/src/parser/ytmusic").Playlist>;
    getPlayableUrl(videoId: string): Promise<string>;
    getSearchSuggestions(query: string): Promise<string[]>;
    getYouTubeSuggestions(videoId: string, size?: number): Promise<Track[]>;
}
export declare const youtubeService: YoutubeService;
export {};

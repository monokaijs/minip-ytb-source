import * as node_modules_youtubei_js_dist_src_parser_ytmusic from 'node_modules/youtubei.js/dist/src/parser/ytmusic';
import * as node_modules_youtubei_js_dist_src_parser_helpers from 'node_modules/youtubei.js/dist/src/parser/helpers';
import * as node_modules_youtubei_js_dist_src_parser_nodes from 'node_modules/youtubei.js/dist/src/parser/nodes';

interface Track {
    id: string;
    title: string;
    artist: string;
    artwork: string;
    duration: number;
    url?: string;
    videoId: string;
    isOffline?: boolean;
    localPath?: string;
    addedAt: number;
    isLoading?: boolean;
    source?: string;
}
interface VideoSearchResult {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: number;
    viewCount?: string;
}
interface SearchResponse {
    results: VideoSearchResult[];
    nextPageToken?: string;
}

interface MusicSource {
    id: string;
    name: string;
    version: string;
    initialize(): Promise<void>;
    search(query: string, pageToken?: string): Promise<SearchResponse>;
    getPlayableUrl(trackId: string, source?: string): Promise<string>;
    getSuggestions(trackId: string, size?: number): Promise<Track[]>;
    getPlaylists?(): Promise<any[]>;
    getPlaylist?(playlistId: string): Promise<any>;
    getSearchSuggestions?(query: string): Promise<string[]>;
}

declare class YouTubeSource implements MusicSource {
    id: string;
    name: string;
    version: string;
    initialize(): Promise<void>;
    search(query: string, pageToken: string | undefined): Promise<SearchResponse>;
    getPlayableUrl(trackId: string): Promise<string>;
    getSuggestions(trackId: string, size?: number): Promise<Track[]>;
    getPlaylists(): Promise<node_modules_youtubei_js_dist_src_parser_helpers.ObservedArray<node_modules_youtubei_js_dist_src_parser_nodes.GridPlaylist | node_modules_youtubei_js_dist_src_parser_nodes.LockupView | node_modules_youtubei_js_dist_src_parser_nodes.Playlist>>;
    getPlaylist(playlistId: string): Promise<node_modules_youtubei_js_dist_src_parser_ytmusic.Playlist>;
    getSearchSuggestions(query: string): Promise<string[]>;
}
declare const defaultSource: YouTubeSource;

declare const createSource: () => YouTubeSource;

export { createSource, defaultSource as default };

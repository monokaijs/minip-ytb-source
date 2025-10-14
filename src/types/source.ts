import {SearchResponse, Track} from './music';

export interface MusicSource {
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

export interface SourceManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  bundleUrl?: string;
  capabilities: SourceCapability[];
  icon?: string;
  homepage?: string;
  minAppVersion?: string;
  manifestUrl?: string;
}

export interface SourceUpdateInfo {
  sourceId: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
}

export type SourceCapability = 'search' | 'stream' | 'playlists' | 'suggestions' | 'top-tracks';


import {MusicSource} from "./types/source";
import {youtubeService} from "./youtube.service";

class YouTubeSource implements MusicSource {
  id: string = 'minip-ytb';
  name: string = 'YouTube Music';
  version: string = '1.0.3';

  async initialize() {
    await youtubeService.start();
  }

  async search(query: string, pageToken: string | undefined) {
    return youtubeService.searchVideos(query, pageToken);
  }

  async getPlayableUrl(trackId: string) {
    return youtubeService.getPlayableUrl(trackId);
  }

  async getSuggestions(trackId: string, size = 10) {
    return youtubeService.getYouTubeSuggestions(trackId, size);
  }

  async getPlaylists() {
    return youtubeService.getPlaylists();
  }

  async getPlaylist(playlistId: string) {
    return youtubeService.getPlaylist(playlistId);
  }

  async getSearchSuggestions(query: string) {
    return youtubeService.getSearchSuggestions(query);
  }
}

const defaultSource = new YouTubeSource();
export default defaultSource;
export const createSource = () => new YouTubeSource();


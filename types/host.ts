/**
 * Source Host — APIs that the app provides to source bundles at runtime.
 *
 * Sources are standalone JS bundles that cannot import from the app.
 * Instead, the app injects this host object which provides all native
 * capabilities a source might need (file system, downloads, platform, etc.).
 */

export interface SourceHost {
  /** Current platform */
  platform: 'ios' | 'android';

  /** Standard fetch (provided by the runtime) */
  fetch: typeof globalThis.fetch;

  // ─── File System ──────────────────────────────────────────

  /**
   * Check if a file exists at the given path.
   * Paths are relative to the app's document directory.
   */
  fileExists(relativePath: string): boolean;

  /** Read a text file. Returns the content string. */
  readFile(relativePath: string): string;

  /** Write text content to a file. Creates parent directories as needed. */
  writeFile(relativePath: string, content: string): void;

  /** Ensure a directory exists (creates recursively if needed). */
  ensureDirectory(relativePath: string): void;

  /** Get the absolute URI for a file (for TrackPlayer, Video, etc.). */
  getFileUri(relativePath: string): string;

  /**
   * Write to a cache file (as opposed to document directory).
   * Used for manifests, temp data, etc.
   */
  writeCacheFile(filename: string, content: string): string; // returns URI

  // ─── Downloads ────────────────────────────────────────────

  /** Download a file with parallel threads. Returns the local path. */
  downloadFile(
    url: string,
    contentLength: number,
    outputPath: string,
    threads: number,
  ): Promise<void>;

  /** Cancel the currently active download. */
  cancelDownload(): void;

  /** Subscribe to download progress. Returns an unsubscribe function. */
  onDownloadProgress(callback: (progress: number) => void): () => void;

  // ─── Storage ──────────────────────────────────────────────

  /** Key-value storage scoped to the source. */
  storage: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
  };

  // ─── Logging ──────────────────────────────────────────────

  log(...args: unknown[]): void;
}

import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const CACHE_DIR = FileSystem.cacheDirectory + "media/";
const MAX_CACHE_SIZE_MB = 131072; // 128 GB
const MAX_CACHE_AGE_DAYS = 90; // 3 months

interface CacheEntry {
  uri: string;
  timestamp: number;
  size: number;
}

interface CacheManifest {
  entries: { [key: string]: CacheEntry };
  totalSize: number;
}

export interface DownloadProgress {
  progress: number;
  bytesWritten: number;
  bytesTotal: number;
}

class MediaCacheService {
  private manifest: CacheManifest = { entries: {}, totalSize: 0 };
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private verifiedPaths: Set<string> = new Set();

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initialize();
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    if (Platform.OS === "web") {
      this.initialized = true;
      return;
    }

    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }

      await this.loadManifest();
      await this.cleanupOldEntries();
      this.initialized = true;
    } catch (error) {
      if (__DEV__) console.warn("[MediaCache] Init error:", error);
      this.initialized = true;
    }
  }

  private getManifestPath(): string {
    return CACHE_DIR + "manifest.json";
  }

  private async loadManifest(): Promise<void> {
    try {
      const manifestPath = this.getManifestPath();
      const info = await FileSystem.getInfoAsync(manifestPath);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(manifestPath);
        this.manifest = JSON.parse(content);
        this.recalculateTotalSize();
      }
    } catch (error) {
      this.manifest = { entries: {}, totalSize: 0 };
    }
  }

  private recalculateTotalSize(): void {
    let calculatedSize = 0;
    for (const entry of Object.values(this.manifest.entries)) {
      calculatedSize += entry.size || 0;
    }
    if (this.manifest.totalSize !== calculatedSize) {
      this.manifest.totalSize = calculatedSize;
    }
  }

  private async saveManifest(): Promise<void> {
    try {
      const manifestPath = this.getManifestPath();
      await FileSystem.writeAsStringAsync(
        manifestPath,
        JSON.stringify(this.manifest)
      );
    } catch (error) {
      if (__DEV__) console.warn("[MediaCache] Save manifest error:", error);
    }
  }

  private getCacheKey(url: string): string {
    const urlWithoutQuery = url.split("?")[0];
    const filename = urlWithoutQuery.split("/").pop() || "";
    const extension = this.getExtension(filename) || this.guessExtension(url);
    const hash = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return extension && !hash.endsWith(extension) ? `${hash}${extension}` : hash;
  }

  private getExtension(filename: string): string {
    const match = filename.match(/\.(jpg|jpeg|png|gif|webp|mp4|mov|m4a|aac|mp3|wav)$/i);
    return match ? match[0].toLowerCase() : "";
  }

  private guessExtension(url: string): string {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("image") || lowerUrl.includes("photo")) return ".jpg";
    if (lowerUrl.includes("video")) return ".mp4";
    if (lowerUrl.includes("audio") || lowerUrl.includes("voice")) return ".m4a";
    return ".jpg";
  }

  private getCachePath(key: string): string {
    return CACHE_DIR + key;
  }

  getQuickCachedUri(url: string): string | null {
    if (Platform.OS === "web") return null;
    if (!this.initialized) return null;
    
    const key = this.getCacheKey(url);
    const entry = this.manifest.entries[key];
    
    if (!entry) return null;
    
    if (this.verifiedPaths.has(entry.uri)) {
      return entry.uri;
    }
    
    return null;
  }

  async getCachedUri(url: string): Promise<string | null> {
    if (Platform.OS === "web") return null;
    
    await this.ensureInitialized();

    const key = this.getCacheKey(url);
    const entry = this.manifest.entries[key];

    if (!entry) {
      console.log("[MediaCache] Cache MISS for:", key);
      return null;
    }

    if (this.verifiedPaths.has(entry.uri)) {
      entry.timestamp = Date.now();
      return entry.uri;
    }

    try {
      const info = await FileSystem.getInfoAsync(entry.uri);
      if (info.exists) {
        console.log("[MediaCache] Cache HIT for:", key, "size:", this.formatCacheSize(entry.size));
        this.verifiedPaths.add(entry.uri);
        entry.timestamp = Date.now();
        await this.saveManifest();
        return entry.uri;
      } else {
        console.log("[MediaCache] Cache file missing for:", key);
        this.manifest.totalSize -= entry.size;
        if (this.manifest.totalSize < 0) this.manifest.totalSize = 0;
        delete this.manifest.entries[key];
        await this.saveManifest();
        return null;
      }
    } catch {
      return null;
    }
  }

  async cacheMedia(
    url: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    if (Platform.OS === "web") return url;
    
    if (!url || typeof url !== "string") {
      return url;
    }
    
    if (url.startsWith("file://") || url.startsWith("content://")) {
      return url;
    }
    
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return url;
    }
    
    await this.ensureInitialized();

    const cached = await this.getCachedUri(url);
    if (cached) {
      return cached;
    }

    const key = this.getCacheKey(url);
    const cachePath = this.getCachePath(key);

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        cachePath,
        {},
        (downloadProgress) => {
          const bytesWritten = downloadProgress.totalBytesWritten;
          const bytesTotal = downloadProgress.totalBytesExpectedToWrite;
          const progress = bytesTotal > 0 ? bytesWritten / bytesTotal : 0;
          onProgress?.({
            progress,
            bytesWritten,
            bytesTotal,
          });
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (result && result.uri) {
        const info = await FileSystem.getInfoAsync(result.uri);
        const size = (info as any).size || 0;

        if (size < 100) {
          console.log("[MediaCache] Downloaded file too small, discarding:", size, "bytes");
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
          return url;
        }

        console.log("[MediaCache] Downloaded and cached:", key, "size:", this.formatCacheSize(size));

        this.manifest.entries[key] = {
          uri: result.uri,
          timestamp: Date.now(),
          size,
        };
        this.manifest.totalSize += size;
        this.verifiedPaths.add(result.uri);

        await this.saveManifest();
        await this.enforceMaxSize();

        return result.uri;
      }
    } catch (error) {
      console.warn("[MediaCache] Download error:", error);
    }

    return url;
  }

  private async cleanupOldEntries(): Promise<void> {
    const maxAge = MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let changed = false;

    for (const [key, entry] of Object.entries(this.manifest.entries)) {
      if (now - entry.timestamp > maxAge) {
        try {
          await FileSystem.deleteAsync(entry.uri, { idempotent: true });
          this.manifest.totalSize -= entry.size;
          delete this.manifest.entries[key];
          changed = true;
        } catch {
        }
      }
    }

    if (changed) {
      await this.saveManifest();
    }
  }

  private async enforceMaxSize(): Promise<void> {
    const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;

    if (this.manifest.totalSize <= maxSizeBytes) return;

    const entries = Object.entries(this.manifest.entries).sort(
      ([, a], [, b]) => a.timestamp - b.timestamp
    );

    for (const [key, entry] of entries) {
      if (this.manifest.totalSize <= maxSizeBytes) break;

      try {
        await FileSystem.deleteAsync(entry.uri, { idempotent: true });
        this.manifest.totalSize -= entry.size;
        delete this.manifest.entries[key];
      } catch {
      }
    }

    await this.saveManifest();
  }

  async removeCacheEntry(url: string): Promise<void> {
    if (Platform.OS === "web") return;

    try {
      await this.ensureInitialized();
      const key = this.getCacheKey(url);
      const entry = this.manifest.entries[key];
      
      if (entry) {
        await FileSystem.deleteAsync(entry.uri, { idempotent: true });
        this.manifest.totalSize -= entry.size;
        delete this.manifest.entries[key];
        await this.saveManifest();
      }
    } catch (error) {
      if (__DEV__) console.warn("[MediaCache] Remove entry error:", error);
    }
  }

  async clearCache(): Promise<void> {
    if (Platform.OS === "web") return;

    try {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      this.manifest = { entries: {}, totalSize: 0 };
      await this.saveManifest();
    } catch (error) {
      if (__DEV__) console.warn("[MediaCache] Clear cache error:", error);
    }
  }

  async preCacheLocalFile(localUri: string, serverUrl: string): Promise<void> {
    if (Platform.OS === "web") return;
    if (!localUri || !serverUrl) return;
    if (!localUri.startsWith("file://") && !localUri.startsWith("content://")) return;

    try {
      await this.ensureInitialized();

      const key = this.getCacheKey(serverUrl);
      
      if (this.manifest.entries[key]) {
        return;
      }

      const cachePath = this.getCachePath(key);

      const sourceInfo = await FileSystem.getInfoAsync(localUri);
      if (!sourceInfo.exists) {
        return;
      }

      await FileSystem.copyAsync({
        from: localUri,
        to: cachePath,
      });

      const cachedInfo = await FileSystem.getInfoAsync(cachePath);
      const size = (cachedInfo as any).size || 0;

      this.manifest.entries[key] = {
        uri: cachePath,
        timestamp: Date.now(),
        size,
      };
      this.manifest.totalSize += size;

      await this.saveManifest();
    } catch (error) {
      if (__DEV__) console.warn("[MediaCache] Pre-cache error:", error);
    }
  }

  async getCacheSize(): Promise<number> {
    await this.ensureInitialized();
    return this.manifest.totalSize;
  }

  formatCacheSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export const mediaCache = new MediaCacheService();

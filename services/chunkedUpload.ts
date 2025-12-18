import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const TOKEN_KEY = "@shepot_token";
const UPLOAD_SESSIONS_KEY = "@shepot_upload_sessions";

export const CHUNKED_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 150 * 1024 * 1024,
  CHUNK_SIZE: 1 * 1024 * 1024,
  PARALLEL_UPLOADS: 3,
  LARGE_FILE_THRESHOLD: 5 * 1024 * 1024,
};

interface UploadSession {
  sessionId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  category: string;
  fileUri: string;
  createdAt: number;
}

type ProgressCallback = (percent: number, uploadedBytes?: number, totalBytes?: number) => void;

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function getSavedSessions(): Promise<UploadSession[]> {
  try {
    const data = await AsyncStorage.getItem(UPLOAD_SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function saveSession(session: UploadSession): Promise<void> {
  const sessions = await getSavedSessions();
  const existing = sessions.findIndex(s => s.sessionId === session.sessionId);
  if (existing >= 0) {
    sessions[existing] = session;
  } else {
    sessions.push(session);
  }
  await AsyncStorage.setItem(UPLOAD_SESSIONS_KEY, JSON.stringify(sessions));
}

async function removeSession(sessionId: string): Promise<void> {
  const sessions = await getSavedSessions();
  const filtered = sessions.filter(s => s.sessionId !== sessionId);
  await AsyncStorage.setItem(UPLOAD_SESSIONS_KEY, JSON.stringify(filtered));
}

async function findResumableSession(fileName: string, fileSize: number): Promise<UploadSession | null> {
  const sessions = await getSavedSessions();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return sessions.find(s => 
    s.fileName === fileName && 
    s.fileSize === fileSize && 
    s.createdAt > oneDayAgo
  ) || null;
}

class ChunkedUploadService {
  private abortController: AbortController | null = null;
  private isAborted = false;

  abort(): void {
    this.isAborted = true;
    this.abortController?.abort();
  }

  async getFileSize(uri: string): Promise<number> {
    try {
      const response = await fetch(uri, { method: "HEAD" });
      const contentLength = response.headers.get("Content-Length");
      if (contentLength) {
        return parseInt(contentLength, 10);
      }
      const fullResponse = await fetch(uri);
      const blob = await fullResponse.blob();
      return blob.size;
    } catch {
      return 0;
    }
  }

  shouldUseChunkedUpload(fileSize: number): boolean {
    return fileSize > CHUNKED_UPLOAD_CONFIG.LARGE_FILE_THRESHOLD;
  }

  async uploadChunked(
    uri: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    category: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    if (fileSize > CHUNKED_UPLOAD_CONFIG.MAX_FILE_SIZE) {
      return { 
        success: false, 
        error: `File size exceeds maximum of ${CHUNKED_UPLOAD_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB` 
      };
    }

    this.isAborted = false;
    this.abortController = new AbortController();

    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, error: "Not authenticated" };
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      let session = await findResumableSession(fileName, fileSize);
      let uploadedChunks: number[] = [];

      if (session) {
        console.log("[ChunkedUpload] Found resumable session:", session.sessionId);
        
        try {
          const statusRes = await fetch(
            `${API_BASE_URL}/api/upload/status/${session.sessionId}`,
            { headers, signal: this.abortController.signal }
          );
          
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.success && statusData.data) {
              uploadedChunks = statusData.data.uploadedChunks || [];
              session.uploadedChunks = uploadedChunks;
              await saveSession(session);
            }
          } else {
            session = null;
          }
        } catch {
          session = null;
        }
      }

      if (!session) {
        console.log("[ChunkedUpload] Initializing new upload session");
        const totalChunks = Math.ceil(fileSize / CHUNKED_UPLOAD_CONFIG.CHUNK_SIZE);
        
        const initRes = await fetch(`${API_BASE_URL}/api/upload/init`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            filename: fileName,
            fileSize,
            mimeType,
            category,
          }),
          signal: this.abortController.signal,
        });

        if (!initRes.ok) {
          return { success: false, error: "Failed to initialize upload session" };
        }

        const initData = await initRes.json();
        if (!initData.success || !initData.data?.sessionId) {
          return { success: false, error: initData.error || "Invalid init response" };
        }

        session = {
          sessionId: initData.data.sessionId,
          fileName,
          fileSize,
          totalChunks,
          uploadedChunks: [],
          category,
          fileUri: uri,
          createdAt: Date.now(),
        };
        
        await saveSession(session);
      }

      const chunksToUpload: number[] = [];
      for (let i = 0; i < session.totalChunks; i++) {
        if (!uploadedChunks.includes(i)) {
          chunksToUpload.push(i);
        }
      }

      console.log("[ChunkedUpload] Chunks to upload:", chunksToUpload.length, "of", session.totalChunks);

      let completedChunks = uploadedChunks.length;
      const totalChunks = session.totalChunks;
      const currentSession = session;

      const readChunkAsBase64 = async (chunkIndex: number): Promise<string> => {
        const start = chunkIndex * CHUNKED_UPLOAD_CONFIG.CHUNK_SIZE;
        const length = Math.min(CHUNKED_UPLOAD_CONFIG.CHUNK_SIZE, fileSize - start);
        
        if (Platform.OS === "web") {
          const response = await fetch(uri);
          const blob = await response.blob();
          const chunkBlob = blob.slice(start, start + length);
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(",")[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(chunkBlob);
          });
        } else {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
            position: start,
            length,
          });
          return base64;
        }
      };

      const uploadChunk = async (chunkIndex: number): Promise<void> => {
        if (this.isAborted) return;

        const chunkBase64 = await readChunkAsBase64(chunkIndex);

        let retries = 3;
        while (retries > 0) {
          try {
            const res = await fetch(
              `${API_BASE_URL}/api/upload/chunk/${currentSession.sessionId}/${chunkIndex}`,
              {
                method: "POST",
                headers: { 
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ chunkData: chunkBase64 }),
                signal: this.abortController?.signal,
              }
            );

            if (res.ok) {
              completedChunks++;
              const percent = Math.round((completedChunks / totalChunks) * 95);
              onProgress?.(percent, completedChunks * CHUNKED_UPLOAD_CONFIG.CHUNK_SIZE, fileSize);
              
              currentSession.uploadedChunks.push(chunkIndex);
              await saveSession(currentSession);
              return;
            }
            
            retries--;
          } catch (e) {
            retries--;
            if (retries === 0) throw e;
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        
        throw new Error(`Failed to upload chunk ${chunkIndex}`);
      };

      for (let i = 0; i < chunksToUpload.length; i += CHUNKED_UPLOAD_CONFIG.PARALLEL_UPLOADS) {
        if (this.isAborted) {
          return { success: false, error: "Upload aborted" };
        }

        const batch = chunksToUpload.slice(i, i + CHUNKED_UPLOAD_CONFIG.PARALLEL_UPLOADS);
        await Promise.all(batch.map(uploadChunk));
      }

      console.log("[ChunkedUpload] All chunks uploaded, completing...");
      onProgress?.(96, fileSize, fileSize);

      const completeRes = await fetch(
        `${API_BASE_URL}/api/upload/complete/${session.sessionId}`,
        {
          method: "POST",
          headers,
          signal: this.abortController.signal,
        }
      );

      if (!completeRes.ok) {
        return { success: false, error: "Failed to complete upload" };
      }

      const completeData = await completeRes.json();
      if (!completeData.success) {
        return { success: false, error: completeData.error || "Upload completion failed" };
      }

      const objectPath = completeData.data?.objectPath || completeData.data?.url;
      const mediaUrl = objectPath 
        ? `${API_BASE_URL}${objectPath}`
        : `${API_BASE_URL}/api/media/${session.sessionId}`;

      console.log("[ChunkedUpload] Upload complete:", mediaUrl);
      onProgress?.(100, fileSize, fileSize);

      await removeSession(session.sessionId);
      
      return { success: true, data: mediaUrl };

    } catch (err: any) {
      console.error("[ChunkedUpload] Error:", err);
      return { success: false, error: err?.message || "Upload failed" };
    }
  }
}

export const chunkedUploadService = new ChunkedUploadService();

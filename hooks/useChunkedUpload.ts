import { useState, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const TOKEN_KEY = "@shepot_token";
const UPLOAD_SESSIONS_KEY = "@shepot_upload_sessions";

const MAX_FILE_SIZE = 150 * 1024 * 1024;
const CHUNK_SIZE = 1 * 1024 * 1024;
const PARALLEL_UPLOADS = 3;

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

interface ChunkedUploadOptions {
  onProgress?: (percent: number, uploadedBytes?: number, totalBytes?: number) => void;
  onComplete?: (objectPath: string) => void;
  onError?: (error: Error) => void;
  onResume?: (sessionId: string) => void;
}

interface ChunkedUploadResult {
  upload: (file: { uri: string; name: string; size: number; mimeType: string }, category: string) => Promise<string | null>;
  progress: number;
  isUploading: boolean;
  error: Error | null;
  abort: () => void;
  resumableSession: UploadSession | null;
  clearSession: () => Promise<void>;
}

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

export function useChunkedUpload(options: ChunkedUploadOptions = {}): ChunkedUploadResult {
  const { onProgress, onComplete, onError, onResume } = options;
  
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [resumableSession, setResumableSession] = useState<UploadSession | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAbortedRef = useRef(false);

  const abort = useCallback(() => {
    isAbortedRef.current = true;
    abortControllerRef.current?.abort();
    setIsUploading(false);
  }, []);

  const clearSession = useCallback(async () => {
    if (resumableSession) {
      await removeSession(resumableSession.sessionId);
      setResumableSession(null);
    }
  }, [resumableSession]);

  const upload = useCallback(async (
    file: { uri: string; name: string; size: number; mimeType: string },
    category: string
  ): Promise<string | null> => {
    if (file.size > MAX_FILE_SIZE) {
      const err = new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      setError(err);
      onError?.(err);
      return null;
    }

    isAbortedRef.current = false;
    abortControllerRef.current = new AbortController();
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      let session = await findResumableSession(file.name, file.size);
      let uploadedChunks: number[] = [];

      if (session) {
        console.log("[ChunkedUpload] Found resumable session:", session.sessionId);
        setResumableSession(session);
        onResume?.(session.sessionId);
        
        const statusRes = await fetch(
          `${API_BASE_URL}/api/upload/status/${session.sessionId}`,
          { headers, signal: abortControllerRef.current.signal }
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
      }

      if (!session) {
        console.log("[ChunkedUpload] Initializing new upload session");
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        const initRes = await fetch(`${API_BASE_URL}/api/upload/init`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            filename: file.name,
            fileSize: file.size,
            mimeType: file.mimeType,
            category,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!initRes.ok) {
          throw new Error("Failed to initialize upload session");
        }

        const initData = await initRes.json();
        if (!initData.success || !initData.data?.sessionId) {
          throw new Error(initData.error || "Invalid init response");
        }

        session = {
          sessionId: initData.data.sessionId,
          fileName: file.name,
          fileSize: file.size,
          totalChunks,
          uploadedChunks: [],
          category,
          fileUri: file.uri,
          createdAt: Date.now(),
        };
        
        await saveSession(session);
        setResumableSession(session);
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

      const readChunkAsBase64 = async (chunkIndex: number): Promise<string> => {
        const start = chunkIndex * CHUNK_SIZE;
        const length = Math.min(CHUNK_SIZE, file.size - start);
        
        if (Platform.OS === "web") {
          const response = await fetch(file.uri);
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
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: "base64",
            position: start,
            length,
          });
          return base64;
        }
      };

      const uploadChunk = async (chunkIndex: number): Promise<void> => {
        if (isAbortedRef.current) return;

        const chunkBase64 = await readChunkAsBase64(chunkIndex);

        let retries = 3;
        while (retries > 0) {
          try {
            const res = await fetch(
              `${API_BASE_URL}/api/upload/chunk/${session!.sessionId}/${chunkIndex}`,
              {
                method: "POST",
                headers: { 
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ chunkData: chunkBase64 }),
                signal: abortControllerRef.current?.signal,
              }
            );

            if (res.ok) {
              completedChunks++;
              const percent = Math.round((completedChunks / totalChunks) * 95);
              setProgress(percent);
              onProgress?.(percent, completedChunks * CHUNK_SIZE, file.size);
              
              session!.uploadedChunks.push(chunkIndex);
              await saveSession(session!);
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

      for (let i = 0; i < chunksToUpload.length; i += PARALLEL_UPLOADS) {
        if (isAbortedRef.current) {
          throw new Error("Upload aborted");
        }

        const batch = chunksToUpload.slice(i, i + PARALLEL_UPLOADS);
        await Promise.all(batch.map(uploadChunk));
      }

      console.log("[ChunkedUpload] All chunks uploaded, completing...");
      setProgress(96);
      onProgress?.(96, file.size, file.size);

      const completeRes = await fetch(
        `${API_BASE_URL}/api/upload/complete/${session.sessionId}`,
        {
          method: "POST",
          headers,
          signal: abortControllerRef.current.signal,
        }
      );

      if (!completeRes.ok) {
        throw new Error("Failed to complete upload");
      }

      const completeData = await completeRes.json();
      if (!completeData.success) {
        throw new Error(completeData.error || "Upload completion failed");
      }

      const objectPath = completeData.data?.objectPath || completeData.data?.url;
      const mediaUrl = objectPath 
        ? `${API_BASE_URL}${objectPath}`
        : `${API_BASE_URL}/api/media/${session.sessionId}`;

      console.log("[ChunkedUpload] Upload complete:", mediaUrl);
      setProgress(100);
      onProgress?.(100, file.size, file.size);

      await removeSession(session.sessionId);
      setResumableSession(null);
      
      onComplete?.(mediaUrl);
      setIsUploading(false);
      
      return mediaUrl;

    } catch (err: any) {
      console.error("[ChunkedUpload] Error:", err);
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      setIsUploading(false);
      return null;
    }
  }, [onProgress, onComplete, onError, onResume]);

  return {
    upload,
    progress,
    isUploading,
    error,
    abort,
    resumableSession,
    clearSession,
  };
}

export const CHUNKED_UPLOAD_CONFIG = {
  MAX_FILE_SIZE,
  CHUNK_SIZE,
  PARALLEL_UPLOADS,
};

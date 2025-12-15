import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiService } from "./api";
import { chunkedUploadService, CHUNKED_UPLOAD_CONFIG } from "./chunkedUpload";
import { linkThumbnailToUrl } from "@/components/VideoThumbnail";
import { mediaCache } from "./mediaCache";

const QUEUE_KEY = "@shepot_message_queue";

export interface QueuedMessage {
  id: string;
  chatId: number;
  content?: string;
  type: "text" | "image" | "video" | "voice";
  mediaUri?: string;
  mediaUrl?: string;
  mediaSize?: number;
  audioDuration?: number;
  replyToId?: number;
  createdAt: number;
  retryCount: number;
  status: "pending" | "uploading" | "sending" | "failed";
  uploadProgress?: number;
  isChunkedUpload?: boolean;
}

type QueueUpdateCallback = (queue: QueuedMessage[]) => void;
type MessageSentCallback = (tempId: string, serverMessage: any, chatId: number) => void;
type MessageFailedCallback = (tempId: string, chatId: number, error: string) => void;

class MessageQueueService {
  private queue: QueuedMessage[] = [];
  private isProcessing = false;
  private isOnline = true;
  private listeners: Set<QueueUpdateCallback> = new Set();
  private onMessageSent: MessageSentCallback | null = null;
  private onMessageFailed: MessageFailedCallback | null = null;
  private maxRetries = 3;
  private retryDelay = 2000;

  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        this.queue = this.queue.map(m => ({ ...m, status: m.status === "uploading" || m.status === "sending" ? "pending" : m.status }));
        await this.saveQueue();
        console.log(`[MessageQueue] Loaded ${this.queue.length} pending messages`);
      }
    } catch (error) {
      __DEV__ && console.warn("[MessageQueue] Failed to load queue:", error);
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      __DEV__ && console.warn("[MessageQueue] Failed to save queue:", error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.queue]);
      } catch (error) {
        __DEV__ && console.warn("[MessageQueue] Listener error:", error);
      }
    });
  }

  subscribe(callback: QueueUpdateCallback): () => void {
    this.listeners.add(callback);
    callback([...this.queue]);
    return () => {
      this.listeners.delete(callback);
    };
  }

  setCallbacks(onSent: MessageSentCallback, onFailed: MessageFailedCallback): void {
    this.onMessageSent = onSent;
    this.onMessageFailed = onFailed;
  }

  async enqueue(message: Omit<QueuedMessage, "createdAt" | "retryCount" | "status">): Promise<void> {
    const queuedMessage: QueuedMessage = {
      ...message,
      createdAt: Date.now(),
      retryCount: 0,
      status: "pending",
    };

    this.queue.push(queuedMessage);
    await this.saveQueue();
    this.notifyListeners();
    console.log(`[MessageQueue] Enqueued message ${message.id} for chat ${message.chatId}`);

    if (this.isOnline && !this.isProcessing) {
      this.processQueue();
    }
  }

  async removeFromQueue(messageId: string): Promise<void> {
    this.queue = this.queue.filter(m => m.id !== messageId);
    await this.saveQueue();
    this.notifyListeners();
  }

  getQueueForChat(chatId: number): QueuedMessage[] {
    return this.queue.filter(m => m.chatId === chatId);
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  setOnline(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;
    console.log(`[MessageQueue] Online status: ${online}`);

    if (online && wasOffline && this.queue.length > 0) {
      console.log(`[MessageQueue] Connection restored, processing ${this.queue.length} pending messages`);
      this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`[MessageQueue] Processing queue (${this.queue.length} messages)`);

    while (this.isOnline && this.queue.length > 0) {
      const pendingMessages = this.queue
        .filter(m => m.status !== "failed" || m.retryCount < this.maxRetries)
        .sort((a, b) => a.createdAt - b.createdAt);

      if (pendingMessages.length === 0) {
        break;
      }

      for (const message of pendingMessages) {
        if (!this.isOnline) {
          console.log("[MessageQueue] Connection lost, pausing queue processing");
          break;
        }

        await this.sendMessage(message);

        if (!this.queue.find(m => m.id === message.id)) {
          continue;
        }
      }

      const stillPending = this.queue.filter(m => 
        m.status === "pending" && m.retryCount < this.maxRetries
      );
      if (stillPending.length === 0) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
    }

    this.isProcessing = false;
  }

  private async sendMessage(message: QueuedMessage): Promise<void> {
    const index = this.queue.findIndex(m => m.id === message.id);
    if (index === -1) return;

    try {
      let mediaUrl = message.mediaUrl;

      if (message.mediaUri && !mediaUrl && message.type !== "text") {
        this.queue[index].status = "uploading";
        await this.saveQueue();
        this.notifyListeners();

        const fileSize = message.mediaSize || await chunkedUploadService.getFileSize(message.mediaUri);
        this.queue[index].mediaSize = fileSize;
        await this.saveQueue();
        this.notifyListeners();
        const useChunked = chunkedUploadService.shouldUseChunkedUpload(fileSize);
        
        if (useChunked) {
          console.log(`[MessageQueue] Using chunked upload for large file (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
          this.queue[index].isChunkedUpload = true;
          this.notifyListeners();

          const fileName = message.mediaUri.split("/").pop() || `media_${Date.now()}`;
          const mimeType = message.type === "image" ? "image/jpeg" : message.type === "video" ? "video/mp4" : "audio/m4a";
          const category = message.type === "image" ? "images" : message.type === "video" ? "videos" : "voice";

          const uploadResult = await chunkedUploadService.uploadChunked(
            message.mediaUri,
            fileName,
            fileSize,
            mimeType,
            category,
            (progress) => {
              const idx = this.queue.findIndex(m => m.id === message.id);
              if (idx !== -1) {
                this.queue[idx].uploadProgress = progress;
                this.notifyListeners();
              }
            }
          );

          if (uploadResult.success && uploadResult.data) {
            mediaUrl = uploadResult.data;
            this.queue[index].mediaUrl = mediaUrl;
            if (message.type === "video" && message.mediaUri) {
              linkThumbnailToUrl(message.mediaUri, mediaUrl);
            }
            if (message.mediaUri && mediaUrl) {
              mediaCache.preCacheLocalFile(message.mediaUri, mediaUrl).catch(() => {});
            }
          } else {
            throw new Error(uploadResult.error || "Chunked upload failed");
          }
        } else {
          const uploadResult = await apiService.uploadMedia(
            message.mediaUri,
            message.type as "image" | "video" | "voice",
            (progress) => {
              const idx = this.queue.findIndex(m => m.id === message.id);
              if (idx !== -1) {
                this.queue[idx].uploadProgress = progress;
                this.notifyListeners();
              }
            }
          );

          if (uploadResult.success && uploadResult.data) {
            mediaUrl = uploadResult.data;
            this.queue[index].mediaUrl = mediaUrl;
            if (message.type === "video" && message.mediaUri) {
              linkThumbnailToUrl(message.mediaUri, mediaUrl);
            }
            if (message.mediaUri && mediaUrl) {
              mediaCache.preCacheLocalFile(message.mediaUri, mediaUrl).catch(() => {});
            }
          } else {
            throw new Error("Upload failed");
          }
        }
      }

      this.queue[index].status = "sending";
      await this.saveQueue();
      this.notifyListeners();

      const result = await apiService.sendMessage({
        chatId: message.chatId,
        content: message.content || "",
        type: message.type,
        mediaUrl,
        replyToId: message.replyToId,
      });

      if (result.success && result.data) {
        console.log(`[MessageQueue] Message ${message.id} sent successfully as ${result.data.id}`);
        
        if (this.onMessageSent) {
          this.onMessageSent(message.id, result.data, message.chatId);
        }

        await this.removeFromQueue(message.id);
      } else {
        throw new Error(result.error || "Send failed");
      }
    } catch (error: any) {
      __DEV__ && console.warn(`[MessageQueue] Failed to send message ${message.id}:`, error);

      const idx = this.queue.findIndex(m => m.id === message.id);
      if (idx !== -1) {
        this.queue[idx].retryCount++;
        this.queue[idx].status = this.queue[idx].retryCount >= this.maxRetries ? "failed" : "pending";
        await this.saveQueue();
        this.notifyListeners();

        if (this.queue[idx].retryCount >= this.maxRetries && this.onMessageFailed) {
          this.onMessageFailed(message.id, message.chatId, error?.message || "Failed to send");
        }
      }

      if (this.queue[idx]?.retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.queue[idx].retryCount));
      }
    }
  }

  async retryFailed(messageId: string): Promise<void> {
    const index = this.queue.findIndex(m => m.id === messageId);
    if (index !== -1) {
      this.queue[index].retryCount = 0;
      this.queue[index].status = "pending";
      await this.saveQueue();
      this.notifyListeners();
      
      if (this.isOnline && !this.isProcessing) {
        this.processQueue();
      }
    }
  }

  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    this.notifyListeners();
  }

  async clearChatQueue(chatId: number): Promise<void> {
    this.queue = this.queue.filter(m => m.chatId !== chatId);
    await this.saveQueue();
    this.notifyListeners();
  }
}

export const messageQueue = new MessageQueueService();

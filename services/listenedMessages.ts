import AsyncStorage from "@react-native-async-storage/async-storage";

const LISTENED_MESSAGES_KEY = "@shepot_listened_voice_messages";

type ListenerCallback = (messageId: string, isListened: boolean) => void;

class ListenedMessagesService {
  private listenedSet: Set<string> = new Set();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private listeners: Map<string, Set<ListenerCallback>> = new Map();
  private globalListeners: Set<() => void> = new Set();

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(LISTENED_MESSAGES_KEY);
      if (data) {
        const arr = JSON.parse(data) as string[];
        this.listenedSet = new Set(arr);
      }
    } catch (error) {
      console.warn("[ListenedMessages] Failed to load:", error);
    }
    
    this.initialized = true;
    this.notifyGlobalListeners();
  }

  isListened(messageId: string): boolean {
    return this.listenedSet.has(messageId);
  }
  
  async isListenedAsync(messageId: string): Promise<boolean> {
    await this.init();
    return this.listenedSet.has(messageId);
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }

  async waitForInit(): Promise<void> {
    if (this.initialized) return;
    await this.init();
  }

  async markAsListened(messageId: string): Promise<void> {
    if (!messageId) return;
    if (this.listenedSet.has(messageId)) return;
    
    this.listenedSet.add(messageId);
    this.notifyListeners(messageId, true);
    
    try {
      const arr = Array.from(this.listenedSet);
      if (arr.length > 2000) {
        const trimmed = arr.slice(-2000);
        this.listenedSet = new Set(trimmed);
        await AsyncStorage.setItem(LISTENED_MESSAGES_KEY, JSON.stringify(trimmed));
      } else {
        await AsyncStorage.setItem(LISTENED_MESSAGES_KEY, JSON.stringify(arr));
      }
    } catch (error) {
      console.warn("[ListenedMessages] Failed to save:", error);
    }
  }

  subscribe(messageId: string, callback: ListenerCallback): () => void {
    if (!this.listeners.has(messageId)) {
      this.listeners.set(messageId, new Set());
    }
    this.listeners.get(messageId)!.add(callback);
    
    return () => {
      const listeners = this.listeners.get(messageId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(messageId);
        }
      }
    };
  }

  subscribeToInit(callback: () => void): () => void {
    this.globalListeners.add(callback);
    if (this.initialized) {
      callback();
    }
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  private notifyListeners(messageId: string, isListened: boolean): void {
    const listeners = this.listeners.get(messageId);
    if (listeners) {
      listeners.forEach(cb => {
        try {
          cb(messageId, isListened);
        } catch (e) {
          console.warn("[ListenedMessages] Listener error:", e);
        }
      });
    }
  }

  private notifyGlobalListeners(): void {
    this.globalListeners.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.warn("[ListenedMessages] Global listener error:", e);
      }
    });
  }

  getListenedCount(): number {
    return this.listenedSet.size;
  }

  async clearAll(): Promise<void> {
    this.listenedSet.clear();
    try {
      await AsyncStorage.removeItem(LISTENED_MESSAGES_KEY);
    } catch (error) {
      console.warn("[ListenedMessages] Failed to clear:", error);
    }
    this.notifyGlobalListeners();
  }
}

export const listenedMessagesService = new ListenedMessagesService();

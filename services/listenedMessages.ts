import AsyncStorage from "@react-native-async-storage/async-storage";

const LISTENED_MESSAGES_KEY = "@shepot_listened_voice_messages";

class ListenedMessagesService {
  private listenedSet: Set<string> = new Set();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

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

  async markAsListened(messageId: string): Promise<void> {
    if (this.listenedSet.has(messageId)) return;
    
    this.listenedSet.add(messageId);
    
    try {
      const arr = Array.from(this.listenedSet);
      // Keep only last 1000 messages to avoid storage bloat
      if (arr.length > 1000) {
        const trimmed = arr.slice(-1000);
        this.listenedSet = new Set(trimmed);
        await AsyncStorage.setItem(LISTENED_MESSAGES_KEY, JSON.stringify(trimmed));
      } else {
        await AsyncStorage.setItem(LISTENED_MESSAGES_KEY, JSON.stringify(arr));
      }
    } catch (error) {
      console.warn("[ListenedMessages] Failed to save:", error);
    }
  }
}

export const listenedMessagesService = new ListenedMessagesService();

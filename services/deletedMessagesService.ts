import AsyncStorage from "@react-native-async-storage/async-storage";

const DELETED_MESSAGES_KEY = "@deleted_messages";
const MAX_DELETED_IDS = 500;

class DeletedMessagesService {
  private deletedIds: Set<string> = new Set();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.loadFromStorage();
    await this.initPromise;
    this.initialized = true;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(DELETED_MESSAGES_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        this.deletedIds = new Set(ids);
      }
    } catch (error) {
      console.warn("[DeletedMessagesService] Failed to load:", error);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const ids = Array.from(this.deletedIds).slice(-MAX_DELETED_IDS);
      await AsyncStorage.setItem(DELETED_MESSAGES_KEY, JSON.stringify(ids));
    } catch (error) {
      console.warn("[DeletedMessagesService] Failed to save:", error);
    }
  }

  async markAsDeleted(messageId: string | number): Promise<void> {
    await this.initialize();
    this.deletedIds.add(String(messageId));
    await this.saveToStorage();
    console.log(`[DeletedMessagesService] Marked ${messageId} as deleted, total: ${this.deletedIds.size}`);
  }

  isDeleted(messageId: string | number): boolean {
    return this.deletedIds.has(String(messageId));
  }

  async isDeletedAsync(messageId: string | number): Promise<boolean> {
    await this.initialize();
    return this.deletedIds.has(String(messageId));
  }

  filterDeleted<T extends { id: string | number }>(messages: T[]): T[] {
    const filtered = messages.filter(m => !this.deletedIds.has(String(m.id)));
    if (messages.length !== filtered.length) {
      console.log(`[DeletedMessagesService] Filtered out ${messages.length - filtered.length} deleted messages`);
    }
    return filtered;
  }

  async clearForChat(chatId: string): Promise<void> {
    await this.initialize();
  }
}

export const deletedMessagesService = new DeletedMessagesService();

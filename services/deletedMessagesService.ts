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

  async markAsDeleted(messageId: string): Promise<void> {
    await this.initialize();
    this.deletedIds.add(messageId);
    await this.saveToStorage();
  }

  isDeleted(messageId: string): boolean {
    return this.deletedIds.has(messageId);
  }

  async isDeletedAsync(messageId: string): Promise<boolean> {
    await this.initialize();
    return this.deletedIds.has(messageId);
  }

  filterDeleted<T extends { id: string }>(messages: T[]): T[] {
    return messages.filter(m => !this.deletedIds.has(m.id));
  }

  async clearForChat(chatId: string): Promise<void> {
    await this.initialize();
  }
}

export const deletedMessagesService = new DeletedMessagesService();

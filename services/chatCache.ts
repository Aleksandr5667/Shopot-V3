import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chat, Message, Contact } from "@/store/types";

const WELCOME_CHAT_ID = "welcome-chat";

const CACHE_KEYS = {
  CHATS: "@shepot_cache_chats",
  MESSAGES: "@shepot_cache_messages_",
  CONTACTS: "@shepot_cache_contacts",
  LAST_SYNC: "@shepot_cache_last_sync",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

class ChatCacheService {
  async getChats(): Promise<Chat[] | null> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.CHATS);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      console.log("[ChatCache] Loaded", parsed.length, "chats from cache");
      return parsed;
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error loading chats:", error);
      return null;
    }
  }

  async saveChats(chats: Chat[]): Promise<void> {
    try {
      const filteredChats = chats.filter(chat => chat.id !== WELCOME_CHAT_ID);
      await AsyncStorage.setItem(CACHE_KEYS.CHATS, JSON.stringify(filteredChats));
      console.log("[ChatCache] Saved", filteredChats.length, "chats to cache");
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error saving chats:", error);
    }
  }

  async getMessages(chatId: string): Promise<Message[] | null> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.MESSAGES + chatId);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      console.log("[ChatCache] Loaded", parsed.length, "messages for chat", chatId);
      return parsed;
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error loading messages:", error);
      return null;
    }
  }

  async saveMessages(chatId: string, messages: Message[]): Promise<void> {
    if (chatId === WELCOME_CHAT_ID) {
      return;
    }
    try {
      const seen = new Set<string>();
      const deduped = messages.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      
      await AsyncStorage.setItem(
        CACHE_KEYS.MESSAGES + chatId,
        JSON.stringify(deduped)
      );
      console.log("[ChatCache] Saved", deduped.length, "messages for chat", chatId);
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error saving messages:", error);
    }
  }

  async appendMessage(chatId: string, message: Message): Promise<void> {
    try {
      const messages = await this.getMessages(chatId) || [];
      if (!messages.some(m => m.id === message.id)) {
        messages.push(message);
        await this.saveMessages(chatId, messages);
      }
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error appending message:", error);
    }
  }

  async updateMessage(chatId: string, messageId: string, updatedMessage: Message): Promise<void> {
    try {
      const messages = await this.getMessages(chatId) || [];
      const updated = messages.map(m => m.id === messageId ? updatedMessage : m);
      await this.saveMessages(chatId, updated);
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error updating message:", error);
    }
  }

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    try {
      const messages = await this.getMessages(chatId) || [];
      const filtered = messages.filter(m => m.id !== messageId);
      await this.saveMessages(chatId, filtered);
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error deleting message:", error);
    }
  }

  async getContacts(): Promise<Contact[] | null> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.CONTACTS);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      console.log("[ChatCache] Loaded", parsed.length, "contacts from cache");
      return parsed;
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error loading contacts:", error);
      return null;
    }
  }

  async saveContacts(contacts: Contact[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.CONTACTS, JSON.stringify(contacts));
      console.log("[ChatCache] Saved", contacts.length, "contacts to cache");
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error saving contacts:", error);
    }
  }

  async updateChatLastMessage(chatId: string, lastMessage: Message): Promise<void> {
    try {
      const chats = await this.getChats() || [];
      const updated = chats.map(chat => 
        chat.id === chatId 
          ? { ...chat, lastMessage, updatedAt: lastMessage.timestamp }
          : chat
      );
      updated.sort((a, b) => 
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      await this.saveChats(updated);
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error updating chat:", error);
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    try {
      const chats = await this.getChats() || [];
      const filtered = chats.filter(c => c.id !== chatId);
      await this.saveChats(filtered);
      await AsyncStorage.removeItem(CACHE_KEYS.MESSAGES + chatId);
      console.log("[ChatCache] Deleted chat and messages:", chatId);
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error deleting chat:", error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith("@shepot_cache"));
      await AsyncStorage.multiRemove(cacheKeys);
      console.log("[ChatCache] Cleared all cache");
    } catch (error) {
      __DEV__ && console.warn("[ChatCache] Error clearing cache:", error);
    }
  }
}

export const chatCache = new ChatCacheService();

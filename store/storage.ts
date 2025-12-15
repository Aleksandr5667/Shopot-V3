import AsyncStorage from "@react-native-async-storage/async-storage";
import { User, Chat, Message, Contact, getRandomAvatarColor } from "./types";

const STORAGE_KEYS = {
  USER: "@shepot_user",
  CREDENTIALS: "@shepot_credentials",
  CHATS: "@shepot_chats",
  MESSAGES: "@shepot_messages",
  CONTACTS: "@shepot_contacts",
};

interface Credentials {
  email: string;
  passwordHash: string;
}

const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const storage = {
  async getUser(): Promise<User | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setUser(user: User): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  },

  async getCredentials(): Promise<Credentials | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CREDENTIALS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setCredentials(email: string, password: string): Promise<void> {
    const credentials: Credentials = {
      email: email.toLowerCase(),
      passwordHash: simpleHash(password),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials));
  },

  async verifyCredentials(email: string, password: string): Promise<boolean> {
    const stored = await this.getCredentials();
    if (!stored) return false;
    return (
      stored.email === email.toLowerCase() &&
      stored.passwordHash === simpleHash(password)
    );
  },

  async getChats(): Promise<Chat[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CHATS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async setChats(chats: Chat[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  },

  async addChat(chat: Chat): Promise<void> {
    const chats = await this.getChats();
    chats.unshift(chat);
    await this.setChats(chats);
  },

  async updateChat(chatId: string, updates: Partial<Chat>): Promise<void> {
    const chats = await this.getChats();
    const index = chats.findIndex((c) => c.id === chatId);
    if (index !== -1) {
      chats[index] = { ...chats[index], ...updates };
      chats.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      await this.setChats(chats);
    }
  },

  async deleteChat(chatId: string): Promise<void> {
    const chats = await this.getChats();
    const filtered = chats.filter((c) => c.id !== chatId);
    await this.setChats(filtered);
    await this.deleteMessages(chatId);
  },

  async getMessages(chatId: string): Promise<Message[]> {
    try {
      const data = await AsyncStorage.getItem(
        `${STORAGE_KEYS.MESSAGES}_${chatId}`
      );
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async setMessages(chatId: string, messages: Message[]): Promise<void> {
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.MESSAGES}_${chatId}`,
      JSON.stringify(messages)
    );
  },

  async addMessage(message: Message): Promise<void> {
    const messages = await this.getMessages(message.chatId);
    messages.push(message);
    await this.setMessages(message.chatId, messages);

    await this.updateChat(message.chatId, {
      lastMessage: message,
      updatedAt: message.timestamp,
    });
  },

  async deleteMessages(chatId: string): Promise<void> {
    await AsyncStorage.removeItem(`${STORAGE_KEYS.MESSAGES}_${chatId}`);
  },

  async getContacts(): Promise<Contact[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CONTACTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async setContacts(contacts: Contact[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
  },

  async addContact(contact: Contact): Promise<{ success: boolean; error?: string }> {
    const contacts = await this.getContacts();
    
    if (contact.email) {
      const normalizedEmail = contact.email.toLowerCase().trim();
      const duplicate = contacts.find(
        (c) => c.email?.toLowerCase().trim() === normalizedEmail
      );
      if (duplicate) {
        return { success: false, error: "contact_exists" };
      }
    }
    
    contacts.push(contact);
    await this.setContacts(contacts);
    return { success: true };
  },

  async initializeDemoData(userId: string): Promise<void> {
    const existingChats = await this.getChats();
    if (existingChats.length > 0) return;

    const demoContacts: Contact[] = [
      { id: "c1", displayName: "Alex Johnson", avatarColor: "#0088CC" },
      { id: "c2", displayName: "Maria Garcia", avatarColor: "#25D366" },
      { id: "c3", displayName: "Ivan Petrov", avatarColor: "#9B59B6" },
      { id: "c4", displayName: "Emma Wilson", avatarColor: "#E67E22" },
      { id: "c5", displayName: "Dmitry Volkov", avatarColor: "#1ABC9C" },
    ];

    await this.setContacts(demoContacts);

    const now = new Date();
    const demoChats: Chat[] = demoContacts.slice(0, 3).map((contact, i) => {
      const chatId = generateId();
      const messageTime = new Date(now.getTime() - i * 3600000).toISOString();
      return {
        id: chatId,
        participantIds: [userId, contact.id],
        participant: contact,
        lastMessage: {
          id: generateId(),
          chatId,
          senderId: contact.id,
          text:
            i === 0
              ? "Hey! How are you doing?"
              : i === 1
                ? "See you tomorrow!"
                : "Thanks for your help!",
          timestamp: messageTime,
          status: "read" as const,
        },
        unreadCount: i === 0 ? 2 : 0,
        updatedAt: messageTime,
      };
    });

    await this.setChats(demoChats);

    for (const chat of demoChats) {
      const messages: Message[] = [
        {
          id: generateId(),
          chatId: chat.id,
          senderId: userId,
          text: "Hello!",
          timestamp: new Date(
            new Date(chat.updatedAt).getTime() - 60000
          ).toISOString(),
          status: "read",
        },
        {
          id: generateId(),
          chatId: chat.id,
          senderId: chat.participant?.id || "",
          text: chat.lastMessage?.text || "",
          timestamp: chat.updatedAt,
          status: "read",
        },
      ];
      await this.setMessages(chat.id, messages);
    }
  },

  async clearAllData(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const shepotKeys = keys.filter((k) => k.startsWith("@shepot"));
    await AsyncStorage.multiRemove(shepotKeys);
  },
};

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chat, Message } from "@/store/types";
import i18next from "i18next";

const WELCOME_CHAT_DISMISSED_KEY = "@shepot_welcome_chat_dismissed";
const WELCOME_CHAT_ID = "welcome-chat";
const STABLE_TIMESTAMP = "2024-01-01T00:00:00.000Z";

class WelcomeChatService {
  async isWelcomeChatDismissed(): Promise<boolean> {
    try {
      const dismissed = await AsyncStorage.getItem(WELCOME_CHAT_DISMISSED_KEY);
      return dismissed === "true";
    } catch {
      return false;
    }
  }

  async dismissWelcomeChat(): Promise<void> {
    try {
      await AsyncStorage.setItem(WELCOME_CHAT_DISMISSED_KEY, "true");
    } catch (error) {
      __DEV__ && console.warn("[WelcomeChat] Failed to dismiss:", error);
    }
  }

  async resetWelcomeChat(): Promise<void> {
    try {
      await AsyncStorage.removeItem(WELCOME_CHAT_DISMISSED_KEY);
    } catch (error) {
      __DEV__ && console.warn("[WelcomeChat] Failed to reset:", error);
    }
  }

  getWelcomeChatId(): string {
    return WELCOME_CHAT_ID;
  }

  isWelcomeChat(chatId: string): boolean {
    return chatId === WELCOME_CHAT_ID;
  }

  createWelcomeChat(): Chat {
    const welcomeMessage: Message = {
      id: "welcome-message-1",
      chatId: WELCOME_CHAT_ID,
      senderId: "system",
      senderName: i18next.t("chats.welcomeChatName"),
      text: i18next.t("chats.welcomeMessage"),
      type: "text",
      timestamp: STABLE_TIMESTAMP,
      status: "read",
    };

    return {
      id: WELCOME_CHAT_ID,
      type: "private",
      participantIds: ["system"],
      participant: {
        id: "system",
        displayName: i18next.t("chats.welcomeChatName"),
        avatarColor: "#0088CC",
      },
      lastMessage: welcomeMessage,
      unreadCount: 0,
      updatedAt: STABLE_TIMESTAMP,
    };
  }

  getWelcomeMessages(): Message[] {
    return [
      {
        id: "welcome-message-1",
        chatId: WELCOME_CHAT_ID,
        senderId: "system",
        senderName: i18next.t("chats.welcomeChatName"),
        text: i18next.t("chats.welcomeMessage"),
        type: "text",
        timestamp: STABLE_TIMESTAMP,
        status: "read",
      },
    ];
  }
}

export const welcomeChatService = new WelcomeChatService();

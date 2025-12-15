import AsyncStorage from "@react-native-async-storage/async-storage";
import { ServerMessage, ServerUser } from "./api";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const TOKEN_KEY = "@shepot_token";

export type WebSocketEvent =
  | { type: "new_message"; message: ServerMessage }
  | { type: "message_updated"; message: ServerMessage }
  | { type: "message_deleted"; messageId: number; chatId: number }
  | { type: "message_delivered"; messageId: number; chatId: number; deliveredTo: number[] }
  | { type: "message_read"; messageId: number; chatId: number; readByUserId: number; readAt: string }
  | { type: "chat_read"; chatId: number; readByUserId: number; readAt: string }
  | { type: "chat_deleted"; chatId: number }
  | { type: "user_online"; userId: number }
  | { type: "user_offline"; userId: number }
  | { type: "ws_connected"; userId: number }
  | { type: "typing"; userId: number; chatId: number }
  | { type: "chat_updated"; chatId: number; chat: any }
  | { type: "members_added"; chatId: number; addedMembers: any[]; addedBy: number }
  | { type: "member_removed"; chatId: number; userId: number; removedBy: number }
  | { type: "removed_from_chat"; chatId: number; removedBy: number }
  | { type: "member_left"; chatId: number; userId: number; newAdminId?: number }
  | { type: "group_role_changed"; chatId: number; userId: number; role: string; changedBy: number }
  | { type: "group_owner_changed"; chatId: number; previousOwnerId: number; newOwnerId: number }
  | { type: "user_deleted"; userId: number };

export type WebSocketEventHandler = (event: WebSocketEvent) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<WebSocketEventHandler> = new Set();
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private lastPongTime = Date.now();

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        console.log("WebSocket: No token available");
        this.isConnecting = false;
        return;
      }

      const wsUrl = API_BASE_URL.replace("https://", "wss://").replace("http://", "ws://");
      const fullUrl = `${wsUrl}/ws?token=${token}`;

      console.log("WebSocket: Connecting...");
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        console.log("WebSocket: Connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastPongTime = Date.now();
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          __DEV__ && console.warn("WebSocket: Failed to parse message", error);
        }
      };

      this.ws.onclose = (event) => {
        console.log("WebSocket: Disconnected", event.code, event.reason || "No reason");
        this.isConnecting = false;
        this.ws = null;
        this.stopPing();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        console.log("WebSocket: Connection error, will reconnect...");
        this.isConnecting = false;
      };
    } catch (error) {
      __DEV__ && console.warn("WebSocket: Connection failed", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("WebSocket: Max reconnect attempts reached");
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPing = (): void => {
    this.stopPing();
    
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "ping" }));
        } catch {
        }
        
        const timeSinceLastPong = Date.now() - this.lastPongTime;
        if (timeSinceLastPong > 60000) {
          console.log("WebSocket: No pong received, reconnecting...");
          this.ws?.close();
        }
      }
    }, 30000);
  };

  private stopPing = (): void => {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  };

  private handleMessage(data: any): void {
    let event: WebSocketEvent | null = null;

    // Handle nested data format from server (payload or data might be used)
    const payload = data.payload || data.data || data;
    const eventType = data.type || data.event;

    console.log("[WebSocket] Received:", eventType, JSON.stringify(payload));

    if (eventType === "pong") {
      this.lastPongTime = Date.now();
      return;
    }

    // Handle connection confirmation - emit event to trigger online users refresh
    if (eventType === "connected") {
      console.log("[WebSocket] Connected as user:", payload.userId);
      const connectedEvent: WebSocketEvent = { type: "ws_connected", userId: payload.userId };
      this.listeners.forEach((listener) => {
        try {
          listener(connectedEvent);
        } catch (error) {
          __DEV__ && console.warn("WebSocket: Listener error on connected", error);
        }
      });
      return;
    }

    switch (eventType) {
      case "new_message":
      case "message:new": {
        const message = payload.message || payload;
        if (message && message.id) {
          console.log("[WebSocket] New message:", message.id, "in chat:", message.chatId);
          event = { type: "new_message", message };
        }
        break;
      }
      case "message_updated":
      case "message:updated": {
        const message = payload.message || payload;
        const messageId = message?.id || payload.messageId;
        const chatId = message?.chatId || payload.chatId;
        const content = message?.content || payload.content;
        const edited = message?.edited !== undefined ? message.edited : payload.edited;
        
        if (messageId && chatId) {
          console.log("[WebSocket] Message updated:", messageId, "content:", content);
          const updatedMessage = message?.id ? message : {
            ...message,
            id: messageId,
            chatId,
            content,
            edited: edited ?? true,
          };
          event = { type: "message_updated", message: updatedMessage };
        }
        break;
      }
      case "message_deleted":
      case "message:deleted": {
        const messageId = payload.messageId || payload.id;
        const deleteChatId = payload.chatId;
        if (messageId && deleteChatId) {
          console.log("[WebSocket] Message deleted:", messageId);
          event = { type: "message_deleted", messageId, chatId: deleteChatId };
        }
        break;
      }
      case "message_delivered":
      case "message:delivered": {
        const messageId = payload.messageId || payload.id;
        const deliveredChatId = payload.chatId;
        const deliveredTo = payload.deliveredTo || [];
        if (messageId && deliveredChatId) {
          console.log("[WebSocket] Message delivered:", messageId, "to:", deliveredTo);
          event = { type: "message_delivered", messageId, chatId: deliveredChatId, deliveredTo };
        }
        break;
      }
      case "chat_deleted":
      case "chat:deleted": {
        const deletedChatId = payload.chatId || payload.id;
        if (deletedChatId) {
          console.log("[WebSocket] Chat deleted:", deletedChatId);
          event = { type: "chat_deleted", chatId: deletedChatId };
        }
        break;
      }
      case "user_online":
      case "user:online": {
        const onlineUserId = payload.userId || payload.id;
        if (onlineUserId) {
          event = { type: "user_online", userId: onlineUserId };
        }
        break;
      }
      case "user_offline":
      case "user:offline": {
        const offlineUserId = payload.userId || payload.id;
        if (offlineUserId) {
          event = { type: "user_offline", userId: offlineUserId };
        }
        break;
      }
      case "typing":
      case "typing:start":
      case "typing:stop": {
        const typingUserId = payload.userId || payload.id;
        const typingChatId = payload.chatId;
        if (typingUserId && typingChatId) {
          event = { type: "typing", userId: typingUserId, chatId: typingChatId };
        }
        break;
      }
      case "presence": {
        const presenceUserId = payload.userId;
        const isOnline = payload.isOnline;
        if (presenceUserId !== undefined && isOnline !== undefined) {
          console.log("[WebSocket] Presence update:", presenceUserId, isOnline ? "online" : "offline");
          event = isOnline
            ? { type: "user_online", userId: presenceUserId }
            : { type: "user_offline", userId: presenceUserId };
        }
        break;
      }
      case "message": {
        const message = payload.message || payload;
        if (message && message.id) {
          console.log("[WebSocket] New message (via 'message' type):", message.id, "in chat:", message.chatId);
          event = { type: "new_message", message };
        }
        break;
      }
      case "members_added": {
        const { chatId, addedMembers, addedBy } = payload;
        if (chatId && addedMembers) {
          console.log("[WebSocket] Members added to chat:", chatId, "count:", addedMembers.length);
          event = { type: "members_added", chatId, addedMembers, addedBy };
        }
        break;
      }
      case "member_removed": {
        const { chatId, userId, removedBy } = payload;
        if (chatId && userId) {
          console.log("[WebSocket] Member removed:", userId, "from chat:", chatId);
          event = { type: "member_removed", chatId, userId, removedBy };
        }
        break;
      }
      case "removed_from_chat": {
        const { chatId, removedBy } = payload;
        if (chatId) {
          console.log("[WebSocket] You were removed from chat:", chatId, "by:", removedBy);
          event = { type: "removed_from_chat", chatId, removedBy };
        }
        break;
      }
      case "member_left": {
        const { chatId, userId, newAdminId } = payload;
        if (chatId && userId) {
          console.log("[WebSocket] Member left:", userId, "from chat:", chatId);
          event = { type: "member_left", chatId, userId, newAdminId };
        }
        break;
      }
      case "group_role_changed": {
        const { chatId, userId, role, changedBy } = payload;
        if (chatId && userId && role) {
          console.log("[WebSocket] Group role changed:", userId, "to", role, "in chat:", chatId);
          event = { type: "group_role_changed", chatId, userId, role, changedBy };
        }
        break;
      }
      case "chat_updated": {
        const { chatId, chat } = payload;
        if (chatId) {
          console.log("[WebSocket] Chat updated:", chatId);
          event = { type: "chat_updated", chatId, chat };
        }
        break;
      }
      case "group_owner_changed": {
        const { chatId, previousOwnerId, newOwnerId } = payload;
        if (chatId && newOwnerId) {
          console.log("[WebSocket] Group owner changed:", chatId, "from:", previousOwnerId, "to:", newOwnerId);
          event = { type: "group_owner_changed", chatId, previousOwnerId, newOwnerId };
        }
        break;
      }
      case "message:read":
      case "message_read": {
        const messageId = payload.messageId;
        const readChatId = payload.chatId;
        const readByUserId = payload.readByUserId;
        const readAt = payload.readAt || new Date().toISOString();
        if (messageId && readChatId && readByUserId) {
          console.log("[WebSocket] Message read:", messageId, "by:", readByUserId);
          event = { type: "message_read", messageId, chatId: readChatId, readByUserId, readAt };
        }
        break;
      }
      case "chat:read":
      case "chat_read": {
        const readChatId = payload.chatId;
        const readByUserId = payload.readByUserId;
        const readAt = payload.readAt || new Date().toISOString();
        if (readChatId && readByUserId) {
          console.log("[WebSocket] Chat read:", readChatId, "by:", readByUserId);
          event = { type: "chat_read", chatId: readChatId, readByUserId, readAt };
        }
        break;
      }
      case "user_deleted": {
        const deletedUserId = payload.userId;
        if (deletedUserId) {
          console.log("[WebSocket] User deleted:", deletedUserId);
          event = { type: "user_deleted", userId: deletedUserId };
        }
        break;
      }
      default:
        if (eventType) {
          console.log("[WebSocket] Unknown event type:", eventType, "payload:", JSON.stringify(payload));
        }
        break;
    }

    if (event) {
      this.listeners.forEach((listener) => {
        try {
          listener(event!);
        } catch (error) {
          __DEV__ && console.warn("WebSocket: Listener error", error);
        }
      });
    }
  }

  disconnect(): void {
    this.stopPing();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  sendTyping(chatId: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "typing_start", payload: { chatId } }));
    }
  }

  subscribe(handler: WebSocketEventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();

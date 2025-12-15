import AsyncStorage from "@react-native-async-storage/async-storage";
import { User, Chat, Message, Contact } from "@/store/types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const TOKEN_KEY = "@shepot_token";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthResponse {
  user: {
    id: number;
    email: string;
    displayName: string;
    avatarColor: string;
    bio: string | null;
    createdAt: string;
    lastSeen: string;
  };
  token: string;
}

export interface ServerUser {
  id: number;
  email: string;
  displayName: string;
  avatarColor: string;
  avatarUrl?: string | null;
  bio: string | null;
  createdAt: string;
  lastSeen: string;
}

export interface ServerContact {
  id: number;
  contactUserId: number;
  createdAt: string;
  contactUser?: ServerUser;
  displayName?: string;
  email?: string;
  avatarColor?: string;
}

export interface ServerChat {
  id: number;
  type: "private" | "group";
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  createdAt: string;
  createdById: number;
  createdBy: number;
  maxMembers?: number;
  members: { user: ServerUser; role?: string; joinedAt?: string; addedBy?: number }[];
  lastMessage?: ServerMessage | null;
}

export interface ServerReplyToMessage {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  type: "text" | "image" | "video" | "voice" | "system";
}

export interface ServerMessage {
  id: number;
  chatId: number;
  senderId: number;
  content: string;
  type: "text" | "image" | "video" | "voice" | "system";
  mediaUrl: string | null;
  createdAt: string;
  readBy: number[];
  deliveredTo: number[];
  edited?: boolean;
  sender?: ServerUser;
  replyToId?: number | null;
  replyToMessage?: ServerReplyToMessage | null;
}

export interface PageInfo {
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  pageInfo: PageInfo;
}

class ApiService {
  private token: string | null = null;

  async init(): Promise<void> {
    this.token = await AsyncStorage.getItem(TOKEN_KEY);
  }

  private async getHeaders(): Promise<HeadersInit> {
    if (!this.token) {
      this.token = await AsyncStorage.getItem(TOKEN_KEY);
    }
    return {
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }

  async clearToken(): Promise<void> {
    this.token = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
  }

  async checkEmailAvailable(email: string): Promise<ApiResponse<{ available: boolean }>> {
    const url = `${API_BASE_URL}/api/auth/check-email`;
    console.log("[API] checkEmailAvailable calling:", url, "with email:", email);
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      console.log("[API] checkEmailAvailable status:", response.status);
      const responseData = await response.json();
      console.log("[API] checkEmailAvailable response:", JSON.stringify(responseData));

      if (response.ok && responseData.success) {
        return { success: true, data: { available: responseData.data?.available ?? true } };
      }

      if (responseData.error?.toLowerCase().includes("exists") || 
          responseData.error?.toLowerCase().includes("already") ||
          responseData.data?.available === false) {
        return { success: true, data: { available: false } };
      }

      return { success: true, data: { available: true } };
    } catch (error: any) {
      __DEV__ && console.warn("[API] Check email error:", error?.message || error?.toString() || "Unknown error");
      __DEV__ && console.warn("[API] Check email URL was:", url);
      return { success: false, error: "Network error" };
    }
  }

  async register(
    email: string,
    password: string,
    displayName: string
  ): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });

      const responseData = await response.json();
      console.log("[API] register response:", response.status, responseData);

      if (response.ok && responseData.success && responseData.data) {
        const authData = responseData.data;
        await this.setToken(authData.token);
        console.log("[API] Registration successful, token saved");
        return { success: true, data: authData };
      }

      return { success: false, error: responseData.error || "Registration failed" };
    } catch (error: any) {
      __DEV__ && console.warn("[API] Register error:", error?.message || error);
      return { success: false, error: "Connection error. Please try again." };
    }
  }

  async login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    try {
      console.log("[API] Login attempt for:", email);
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const responseData = await response.json();
      console.log("[API] Login response status:", response.status);
      console.log("[API] Login response data:", JSON.stringify(responseData));

      if (response.ok && responseData.success && responseData.data) {
        const authData = responseData.data;
        await this.setToken(authData.token);
        console.log("[API] Login successful");
        return { success: true, data: authData };
      }

      const errorMessage = responseData.error || responseData.message || "Invalid email or password";
      console.log("[API] Login failed:", errorMessage);
      return { success: false, error: errorMessage };
    } catch (error: any) {
      __DEV__ && console.warn("[API] Login error:", error?.message || error);
      return { success: false, error: "Connection error. Please try again." };
    }
  }

  async getCurrentUser(): Promise<ApiResponse<ServerUser>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.success && responseData.data?.user) {
          return { success: true, data: responseData.data.user };
        }
        if (responseData.user) {
          return { success: true, data: responseData.user };
        }
      }

      if (response.status === 401) {
        await this.clearToken();
      }

      return { success: false, error: "Failed to get user" };
    } catch (error: any) {
      __DEV__ && console.warn("[API] Get current user error:", error?.message || error);
      return { success: false, error: "Network error" };
    }
  }

  async searchUserByEmail(email: string): Promise<ApiResponse<ServerUser | null>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/users/search?email=${encodeURIComponent(email)}`,
        { method: "GET", headers }
      );

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.success && responseData.data?.users?.length > 0) {
          return { success: true, data: responseData.data.users[0] };
        }
        return { success: false, error: "User not found" };
      }

      return { success: false, error: "User not found" };
    } catch (error) {
      __DEV__ && console.warn("Search user error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async updateProfile(updates: {
    displayName?: string;
    avatarColor?: string;
    avatarUrl?: string | null;
    bio?: string;
  }): Promise<ApiResponse<ServerUser>> {
    console.log("[API] updateProfile called with:", updates);
    try {
      const headers = await this.getHeaders();
      console.log("[API] Making PUT request to:", `${API_BASE_URL}/api/users/profile`);
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
      });

      console.log("[API] Response status:", response.status);
      if (response.ok) {
        const responseData = await response.json();
        console.log("[API] Response data:", JSON.stringify(responseData));
        if (responseData.success && responseData.data?.user) {
          console.log("[API] Returning user from data.user");
          return { success: true, data: responseData.data.user };
        }
        if (responseData.user) {
          console.log("[API] Returning user from user");
          return { success: true, data: responseData.user };
        }
        console.log("[API] Could not find user in response");
      } else {
        const errorText = await response.text();
        console.log("[API] Error response:", errorText);
      }

      return { success: false, error: "Failed to update profile" };
    } catch (error) {
      __DEV__ && console.warn("Update profile error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async deleteAccount(): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/users/account`, {
        method: "DELETE",
        headers,
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        await this.clearToken();
        return { success: true };
      }

      return { success: false, error: responseData.error || "Failed to delete account" };
    } catch (error) {
      __DEV__ && console.warn("Delete account error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async getContacts(
    limit: number = 50,
    cursor?: string
  ): Promise<ApiResponse<{ contacts: ServerContact[]; pageInfo: PageInfo }>> {
    try {
      const headers = await this.getHeaders();
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      if (cursor) params.append("cursor", cursor);
      
      const response = await fetch(`${API_BASE_URL}/api/contacts?${params.toString()}`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.success && responseData.data) {
          const contacts = responseData.data.contacts || responseData.data.items || [];
          const pageInfo = responseData.data.pageInfo || { hasMore: false, nextCursor: null };
          return { success: true, data: { contacts, pageInfo } };
        }
      }

      return { success: false, error: "Failed to get contacts" };
    } catch (error) {
      __DEV__ && console.warn("Get contacts error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async addContact(contactUserId: number): Promise<ApiResponse<ServerContact>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: "POST",
        headers,
        body: JSON.stringify({ contactUserId }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        const contact = responseData.data?.contact;
        const contactUser = responseData.data?.contactUser;
        if (contact) {
          return {
            success: true,
            data: {
              id: contact.id,
              contactUserId: contactUser?.id || contactUserId,
              contactUser: contactUser,
            } as ServerContact,
          };
        }
      }

      return { success: false, error: responseData.error || "Failed to add contact" };
    } catch (error) {
      __DEV__ && console.warn("Add contact error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async deleteContact(contactId: number): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/contacts/${contactId}`, {
        method: "DELETE",
        headers,
      });

      if (response.ok) {
        return { success: true };
      }

      return { success: false, error: "Failed to delete contact" };
    } catch (error) {
      __DEV__ && console.warn("Delete contact error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async getChats(
    limit: number = 50,
    cursor?: string
  ): Promise<ApiResponse<{ chats: ServerChat[]; pageInfo: PageInfo }>> {
    try {
      const headers = await this.getHeaders();
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      if (cursor) params.append("cursor", cursor);
      
      const response = await fetch(`${API_BASE_URL}/api/chats?${params.toString()}`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.success && responseData.data) {
          const chats = responseData.data.chats || responseData.data.items || [];
          const pageInfo = responseData.data.pageInfo || { hasMore: false, nextCursor: null };
          return { success: true, data: { chats, pageInfo } };
        }
      }

      return { success: false, error: "Failed to get chats" };
    } catch (error) {
      __DEV__ && console.warn("Get chats error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async createChat(params: {
    type: "private" | "group";
    participantIds: number[];
    name?: string;
  }): Promise<ApiResponse<ServerChat>> {
    try {
      const headers = await this.getHeaders();
      const requestBody = {
        type: params.type,
        memberIds: params.participantIds,
        ...(params.name && { name: params.name }),
      };
      console.log("[API] createChat request:", JSON.stringify(requestBody));
      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();
      console.log("[API] createChat response:", response.status, JSON.stringify(responseData));

      if (response.ok && responseData.success && responseData.data?.chat) {
        return { success: true, data: responseData.data.chat };
      }

      return { success: false, error: responseData.error || "Failed to create chat" };
    } catch (error) {
      __DEV__ && console.warn("Create chat error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async deleteChat(chatId: number): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, {
        method: "DELETE",
        headers,
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        return { success: true };
      }

      return { success: false, error: responseData.error || "Failed to delete chat" };
    } catch (error) {
      __DEV__ && console.warn("Delete chat error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async getGroupDetails(chatId: number): Promise<ApiResponse<{
    chat: ServerChat;
    members: Array<{
      id: number;
      displayName: string;
      avatarColor: string;
      avatarUrl?: string;
      role: "admin" | "member";
      joinedAt: string;
      addedBy: number | null;
    }>;
  }>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/details`, {
        method: "GET",
        headers,
      });

      const responseData = await response.json();

      if (response.ok && responseData.success && responseData.data) {
        return { success: true, data: responseData.data };
      }

      return { success: false, error: responseData.error || "Failed to get group details" };
    } catch (error) {
      __DEV__ && console.warn("Get group details error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async updateGroup(chatId: number, data: {
    name?: string;
    description?: string;
  }): Promise<ApiResponse<ServerChat>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success && responseData.data?.chat) {
        return { success: true, data: responseData.data.chat };
      }

      return { success: false, error: responseData.error || "Failed to update group" };
    } catch (error) {
      __DEV__ && console.warn("Update group error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async updateGroupAvatar(chatId: number, avatarUrl: string): Promise<ApiResponse<{ avatarUrl: string }>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/avatar`, {
        method: "POST",
        headers,
        body: JSON.stringify({ avatarUrl }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        return { success: true, data: { avatarUrl: responseData.data?.avatarUrl || avatarUrl } };
      }

      return { success: false, error: responseData.error || "Failed to update avatar" };
    } catch (error) {
      __DEV__ && console.warn("Update group avatar error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async addGroupMembers(chatId: number, userIds: number[]): Promise<ApiResponse<{
    addedMembers: Array<{
      id: number;
      displayName: string;
      role: "member";
    }>;
    failedIds?: number[];
  }>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/members`, {
        method: "POST",
        headers,
        body: JSON.stringify({ userIds }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        return { success: true, data: responseData.data };
      }

      return { success: false, error: responseData.error || "Failed to add members" };
    } catch (error) {
      __DEV__ && console.warn("Add group members error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async removeGroupMember(chatId: number, userId: number): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/members/${userId}`, {
        method: "DELETE",
        headers,
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        return { success: true };
      }

      return { success: false, error: responseData.error || "Failed to remove member" };
    } catch (error) {
      __DEV__ && console.warn("Remove group member error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async leaveGroup(chatId: number): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/leave`, {
        method: "POST",
        headers,
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        return { success: true };
      }

      return { success: false, error: responseData.error || "Failed to leave group" };
    } catch (error) {
      __DEV__ && console.warn("Leave group error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async changeGroupMemberRole(chatId: number, userId: number, role: "admin" | "member"): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/members/${userId}/role`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ role }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        return { success: true };
      }

      return { success: false, error: responseData.error || "Failed to change role" };
    } catch (error) {
      __DEV__ && console.warn("Change member role error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async getChatMessages(
    chatId: number,
    limit?: number,
    before?: string
  ): Promise<ApiResponse<ServerMessage[]>> {
    try {
      const headers = await this.getHeaders();
      let url = `${API_BASE_URL}/api/chats/${chatId}/messages`;
      const params = new URLSearchParams();
      if (limit) params.append("limit", limit.toString());
      if (before) params.append("before", before);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, { method: "GET", headers });

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.success && responseData.data?.messages) {
          return { success: true, data: responseData.data.messages };
        }
      }

      return { success: false, error: "Failed to get messages" };
    } catch (error) {
      __DEV__ && console.warn("Get messages error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async sendMessage(params: {
    chatId: number;
    content: string;
    type?: "text" | "image" | "video" | "voice";
    mediaUrl?: string;
    replyToId?: number;
  }): Promise<ApiResponse<ServerMessage>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chatId: params.chatId,
          content: params.content,
          type: params.type || "text",
          mediaUrl: params.mediaUrl,
          replyToId: params.replyToId,
        }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success && responseData.data?.message) {
        return { success: true, data: responseData.data.message };
      }

      return { success: false, error: responseData.error || "Failed to send message" };
    } catch (error) {
      __DEV__ && console.warn("Send message error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async markMessageAsRead(messageId: number): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}/read`, {
        method: "PUT",
        headers,
      });

      if (response.ok) {
        return { success: true };
      }

      return { success: false, error: "Failed to mark as read" };
    } catch (error) {
      __DEV__ && console.warn("Mark as read error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async markChatAsRead(chatId: number): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/read`, {
        method: "PUT",
        headers,
      });

      if (response.ok) {
        return { success: true };
      }

      return { success: false, error: "Failed to mark chat as read" };
    } catch (error) {
      __DEV__ && console.warn("Mark chat as read error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async getOnlineUsers(): Promise<ApiResponse<number[]>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/users/online`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const responseData = await response.json();
        const userIds = responseData.data?.userIds || responseData.userIds || [];
        return { success: true, data: userIds };
      }

      return { success: false, error: "Failed to get online users" };
    } catch {
      return { success: false, error: "Network error" };
    }
  }

  async isUserOnline(userId: number): Promise<ApiResponse<{ isOnline: boolean; lastSeen: string }>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/online`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.success && responseData.data) {
          return { 
            success: true, 
            data: { 
              isOnline: responseData.data.isOnline, 
              lastSeen: responseData.data.lastSeen 
            } 
          };
        }
      }

      return { success: false, error: "Failed to check user status" };
    } catch {
      return { success: false, error: "Network error" };
    }
  }

  async editMessage(
    messageId: number,
    content: string
  ): Promise<ApiResponse<ServerMessage>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ content }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success && responseData.data?.message) {
        return { success: true, data: responseData.data.message };
      }

      return { success: false, error: responseData.error || "Failed to edit message" };
    } catch (error) {
      __DEV__ && console.warn("Edit message error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async deleteMessage(messageId: number): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
        method: "DELETE",
        headers,
      });

      if (response.ok) {
        return { success: true };
      }

      const data = await response.json();
      return { success: false, error: data.error || "Failed to delete message" };
    } catch (error) {
      __DEV__ && console.warn("Delete message error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async registerPushToken(pushToken: string): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/users/push-token`, {
        method: "POST",
        headers,
        body: JSON.stringify({ pushToken }),
      });

      if (response.ok) {
        return { success: true };
      }

      return { success: false, error: "Failed to register push token" };
    } catch (error) {
      __DEV__ && console.warn("Register push token error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async removePushToken(): Promise<ApiResponse<void>> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${API_BASE_URL}/api/users/push-token`, {
        method: "DELETE",
        headers,
      });

      if (response.ok) {
        return { success: true };
      }

      return { success: false, error: "Failed to remove push token" };
    } catch (error) {
      __DEV__ && console.warn("Remove push token error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async sendVerificationCode(email: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/send-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        return { success: true, data: { message: responseData.message || "Code sent" } };
      }

      return { success: false, error: responseData.error || "Failed to send verification code" };
    } catch (error) {
      __DEV__ && console.warn("Send verification code error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async verifyEmail(email: string, code: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        return { success: true, data: { message: responseData.message || "Email verified" } };
      }

      return { success: false, error: responseData.error || "Invalid verification code" };
    } catch (error) {
      __DEV__ && console.warn("Verify email error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async requestPasswordReset(email: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        return { success: true, data: { message: responseData.message || "Reset code sent" } };
      }

      return { success: false, error: responseData.error || "Failed to send reset code" };
    } catch (error) {
      __DEV__ && console.warn("Request password reset error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        return { success: true, data: { message: responseData.message || "Password reset successful" } };
      }

      return { success: false, error: responseData.error || "Failed to reset password" };
    } catch (error) {
      __DEV__ && console.warn("Confirm password reset error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async searchMessages(
    query: string,
    limit: number = 50,
    cursor?: string
  ): Promise<ApiResponse<{ messages: ServerMessage[]; pageInfo: PageInfo }>> {
    try {
      const headers = await this.getHeaders();
      const params = new URLSearchParams();
      params.append("q", query);
      params.append("limit", limit.toString());
      if (cursor) params.append("cursor", cursor);
      
      const response = await fetch(
        `${API_BASE_URL}/api/messages/search?${params.toString()}`,
        { method: "GET", headers }
      );

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.success && responseData.data) {
          const messages = responseData.data.messages || responseData.data.items || [];
          const pageInfo = responseData.data.pageInfo || { hasMore: false, nextCursor: null };
          return { success: true, data: { messages, pageInfo } };
        }
      }

      return { success: false, error: "Failed to search messages" };
    } catch (error) {
      __DEV__ && console.warn("Search messages error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async uploadMedia(
    uri: string,
    type: "image" | "video" | "voice",
    onProgress?: (progress: number, uploadedBytes?: number, totalBytes?: number) => void,
    category?: "avatars" | "images" | "videos" | "voice"
  ): Promise<ApiResponse<string>> {
    try {
      const headers = await this.getHeaders();
      const filename = uri.split("/").pop() || `media_${Date.now()}`;
      const mimeType =
        type === "image"
          ? "image/jpeg"
          : type === "video"
            ? "video/mp4"
            : "audio/m4a";

      const uploadCategory = category || (type === "image" ? "images" : type === "video" ? "videos" : "voice");

      console.log("[API] uploadMedia starting for:", type, filename, "category:", uploadCategory);
      onProgress?.(5);

      const uploadResponse = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filename,
          contentType: mimeType,
          category: uploadCategory,
        }),
      });

      if (!uploadResponse.ok) {
        __DEV__ && console.warn("[API] uploadMedia: Failed to get upload URL");
        return { success: false, error: "Failed to get upload URL" };
      }

      const uploadData = await uploadResponse.json();
      console.log("[API] uploadMedia response:", JSON.stringify(uploadData));
      onProgress?.(10);
      
      if (!uploadData.success || !uploadData.data?.uploadURL) {
        return { success: false, error: "Invalid upload response" };
      }
      
      const uploadUrl = uploadData.data.uploadURL;
      const urlPath = new URL(uploadUrl).pathname;
      const key = urlPath.split('/').filter(Boolean).slice(-1)[0]?.replace(/\?.*$/, '') || filename;
      
      console.log("[API] uploadMedia key:", key);

      const fileResponse = await fetch(uri);
      const blob = await fileResponse.blob();
      console.log("[API] uploadMedia blob size:", blob.size);
      onProgress?.(20);

      const totalBytes = blob.size;
      const uploadWithProgress = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl, true);
          xhr.setRequestHeader("Content-Type", mimeType);
          
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = 20 + (event.loaded / event.total) * 70;
              onProgress?.(Math.round(percentComplete), event.loaded, event.total);
            }
          };
          
          xhr.onload = () => {
            resolve(xhr.status >= 200 && xhr.status < 300);
          };
          
          xhr.onerror = () => resolve(false);
          xhr.send(blob);
        });
      };

      const uploadSuccess = await uploadWithProgress();

      if (!uploadSuccess) {
        __DEV__ && console.warn("[API] uploadMedia: Failed to upload file to storage");
        return { success: false, error: "Failed to upload file" };
      }

      console.log("[API] uploadMedia: File uploaded, finalizing...");
      onProgress?.(92);
      
      const baseUploadUrl = uploadUrl.split('?')[0];
      
      const finalizeResponse = await fetch(`${API_BASE_URL}/api/media/finalize`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ uploadedUrl: baseUploadUrl }),
      });
      
      const finalizeData = await finalizeResponse.json();
      console.log("[API] uploadMedia finalize response:", JSON.stringify(finalizeData));
      onProgress?.(98);
      
      if (!finalizeData.success || !finalizeData.data) {
        __DEV__ && console.warn("[API] uploadMedia: Finalize failed");
        return { success: false, error: "Failed to finalize upload" };
      }
      
      const objectPath = finalizeData.data.objectPath || finalizeData.data.url;
      const mediaUrl = objectPath 
        ? `${API_BASE_URL}${objectPath}`
        : `${API_BASE_URL}/api/media/${key}`;
      console.log("[API] uploadMedia final URL:", mediaUrl);
      onProgress?.(100);

      return { success: true, data: mediaUrl };
    } catch (error) {
      __DEV__ && console.warn("Upload media error:", error);
      return { success: false, error: "Network error" };
    }
  }

  serverUserToUser(serverUser: ServerUser): User {
    return {
      id: serverUser.id.toString(),
      visibleId: serverUser.id,
      email: serverUser.email,
      displayName: serverUser.displayName,
      avatarColor: serverUser.avatarColor,
      avatarUrl: serverUser.avatarUrl || undefined,
      bio: serverUser.bio || undefined,
      createdAt: serverUser.createdAt,
    };
  }

  serverContactToContact(serverContact: ServerContact): Contact {
    const contactUser = (serverContact as any).contactUser;
    return {
      id: serverContact.id.toString(),
      visibleId: contactUser?.id || serverContact.contactUserId,
      displayName: contactUser?.displayName || serverContact.displayName || "",
      email: contactUser?.email || serverContact.email || "",
      avatarColor: contactUser?.avatarColor || serverContact.avatarColor || "#3B82F6",
      avatarUrl: contactUser?.avatarUrl || undefined,
      bio: contactUser?.bio || undefined,
    };
  }

  serverChatToChat(serverChat: ServerChat, currentUserId: number): Chat {
    const members = serverChat.members || [];
    const isGroup = serverChat.type === 'group';
    
    const otherMember = members.find((m: any) => {
      const memberId = m.user?.id || m.id;
      return memberId !== currentUserId;
    });
    const participant = (otherMember?.user || otherMember) as ServerUser | undefined;

    const participants = members.map((m: any) => {
      const user = m.user || m;
      return {
        id: user.id?.toString() || "",
        visibleId: user.id,
        displayName: user.displayName || "",
        email: user.email || "",
        avatarColor: user.avatarColor || "#3B82F6",
        avatarUrl: user.avatarUrl || undefined,
        bio: user.bio || undefined,
        role: m.role || "member",
      };
    });

    return {
      id: serverChat.id.toString(),
      type: serverChat.type,
      name: serverChat.name || undefined,
      description: serverChat.description || undefined,
      avatarUrl: serverChat.avatarUrl || undefined,
      createdBy: serverChat.createdBy,
      memberCount: members.length,
      participantIds: members.map((m: any) => {
        const memberId = m.user?.id || m.id;
        return memberId?.toString() || "";
      }),
      participant: participant
        ? {
            id: participant.id?.toString() || "",
            visibleId: participant.id,
            displayName: participant.displayName || "",
            email: participant.email || "",
            avatarColor: participant.avatarColor || "#3B82F6",
            avatarUrl: participant.avatarUrl || undefined,
            bio: participant.bio || undefined,
          }
        : undefined,
      participants: isGroup ? participants : undefined,
      members: isGroup ? members.map((m: any) => ({
        id: m.id,
        chatId: m.chatId,
        visibleId: m.user?.id || m.userId,
        displayName: m.user?.displayName || "",
        email: m.user?.email || "",
        avatarColor: m.user?.avatarColor || "#3B82F6",
        avatarUrl: m.user?.avatarUrl || undefined,
        role: m.role || "member",
        joinedAt: m.joinedAt || m.createdAt,
        addedBy: m.addedBy,
      })) : undefined,
      lastMessage: serverChat.lastMessage
        ? this.serverMessageToMessage(serverChat.lastMessage, currentUserId)
        : undefined,
      unreadCount: 0,
      updatedAt: serverChat.lastMessage?.createdAt || serverChat.createdAt,
      avatarColor: serverChat.avatarColor || undefined,
    };
  }

  serverMessageToMessage(
    serverMessage: ServerMessage,
    currentUserId: number
  ): Message {
    const isOwn = serverMessage.senderId === currentUserId;
    const deliveredTo = serverMessage.deliveredTo || [];
    const readBy = serverMessage.readBy || [];
    
    const isDelivered = isOwn
      ? deliveredTo.length > 1
      : deliveredTo.includes(currentUserId);

    const isRead = isOwn
      ? readBy.some(id => id !== currentUserId)
      : readBy.includes(currentUserId);

    let status: "sent" | "delivered" | "read" = "sent";
    if (isRead) {
      status = "read";
    } else if (isDelivered) {
      status = "delivered";
    }

    const mediaType = serverMessage.type === "image" 
      ? "photo" 
      : serverMessage.type === "video" 
        ? "video" 
        : serverMessage.type === "voice" 
          ? "audio" 
          : undefined;

    return {
      id: serverMessage.id.toString(),
      chatId: serverMessage.chatId.toString(),
      senderId: serverMessage.senderId.toString(),
      text: serverMessage.content,
      timestamp: serverMessage.createdAt,
      status,
      type: serverMessage.type,
      mediaType,
      mediaUrl: serverMessage.mediaUrl || undefined,
      replyToId: serverMessage.replyToId?.toString(),
      replyToMessage: serverMessage.replyToMessage
        ? {
            id: serverMessage.replyToMessage.id.toString(),
            senderId: serverMessage.replyToMessage.senderId.toString(),
            senderName: serverMessage.replyToMessage.senderName,
            content: serverMessage.replyToMessage.content,
            type: serverMessage.replyToMessage.type,
          }
        : undefined,
      readBy: readBy.map(id => id.toString()),
      isEdited: serverMessage.edited ?? false,
    };
  }
}

export const apiService = new ApiService();
export default apiService;

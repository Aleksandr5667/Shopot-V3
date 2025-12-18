import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Chat, Message, Contact } from "@/store/types";
import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { apiService } from "@/services/api";
import { notificationSoundService } from "@/services/notificationSound";
import { chatCache } from "@/services/chatCache";
import { welcomeChatService } from "@/services/welcomeChat";

interface ChatsContextType {
  chats: Chat[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreChats: boolean;
  createChat: (contact: Contact) => Promise<Chat | null>;
  createGroupChat: (name: string, participantIds: number[]) => Promise<Chat | null>;
  deleteChat: (chatId: string) => Promise<boolean>;
  markAsRead: (chatId: string) => void;
  setActiveChat: (chatId: string | null) => void;
  refreshChats: () => Promise<void>;
  loadMoreChats: () => Promise<void>;
  updateChatLastMessage: (chatId: string, message: Message) => void;
}

const ChatsContext = createContext<ChatsContextType | null>(null);

const CHATS_PAGE_SIZE = 50;

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { subscribe, onlineUsers } = useWebSocket();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  
  const setActiveChat = useCallback((chatId: string | null) => {
    console.log("[ChatsContext] setActiveChat:", chatId);
    activeChatIdRef.current = chatId;
  }, []);

  const markUserOnlineByActivity = useCallback((userId: number) => {
    if (!userId || userId === user?.visibleId) return;
    
    setChats((prev) => {
      let hasChanges = false;
      const updated = prev.map((chat) => {
        if (chat.type === "private" && chat.participant) {
          const participantVisibleId = chat.participant.visibleId;
          if (participantVisibleId === userId && !chat.participant.isOnline) {
            hasChanges = true;
            return {
              ...chat,
              participant: {
                ...chat.participant,
                isOnline: true,
              },
            };
          }
        }
        return chat;
      });
      return hasChanges ? updated : prev;
    });
  }, [user?.visibleId]);

  const loadFromCache = useCallback(async () => {
    const cached = await chatCache.getChats();
    if (cached && cached.length > 0) {
      const filteredCached = cached.filter(chat => !welcomeChatService.isWelcomeChat(chat.id));
      if (filteredCached.length > 0) {
        const sortedCached = filteredCached.sort((a, b) => 
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );
        setChats(sortedCached);
        setIsLoading(false);
        return true;
      }
    }
    return false;
  }, []);

  const loadFromServer = useCallback(async () => {
    if (!user?.visibleId) return;
    
    try {
      setIsSyncing(true);
      const result = await apiService.getChats(CHATS_PAGE_SIZE);
      if (result.success && result.data) {
        const mappedChats = result.data.chats.map((serverChat) =>
          apiService.serverChatToChat(serverChat, user.visibleId!)
        );
        const sortedChats = mappedChats.sort((a, b) => 
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );
        
        setChats((prevChats) => {
          const onlineStatusMap = new Map<number, boolean>();
          prevChats.forEach((chat) => {
            if (chat.type === "private" && chat.participant?.visibleId !== undefined && chat.participant.isOnline !== undefined) {
              onlineStatusMap.set(chat.participant.visibleId, chat.participant.isOnline);
            }
          });
          
          let chatsWithOnlineStatus = sortedChats.map((chat) => {
            if (chat.type === "private" && chat.participant?.visibleId !== undefined) {
              const savedOnlineStatus = onlineStatusMap.get(chat.participant.visibleId);
              if (savedOnlineStatus !== undefined) {
                return {
                  ...chat,
                  participant: {
                    ...chat.participant,
                    isOnline: savedOnlineStatus,
                  },
                };
              }
            }
            return chat;
          });
          
          chatCache.saveChats(chatsWithOnlineStatus);
          return chatsWithOnlineStatus;
        });
        
        if (result.data.chats.length === 0) {
          welcomeChatService.isWelcomeChatDismissed().then((dismissed) => {
            if (!dismissed) {
              setChats((currentChats) => {
                const realChats = currentChats.filter(c => !welcomeChatService.isWelcomeChat(c.id));
                if (realChats.length === 0) {
                  const welcomeChat = welcomeChatService.createWelcomeChat();
                  return [welcomeChat];
                }
                return currentChats;
              });
            }
          });
        }
        
        setHasMoreChats(result.data.pageInfo.hasMore);
        setNextCursor(result.data.pageInfo.nextCursor);
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to load chats from server:", error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [user?.visibleId]);

  const loadMoreChats = useCallback(async () => {
    if (!user?.visibleId || isLoadingMore || !hasMoreChats || !nextCursor) return;
    
    try {
      setIsLoadingMore(true);
      const result = await apiService.getChats(CHATS_PAGE_SIZE, nextCursor);
      if (result.success && result.data) {
        const mappedChats = result.data.chats.map((serverChat) =>
          apiService.serverChatToChat(serverChat, user.visibleId!)
        );
        
        setChats((prev) => {
          const onlineStatusMap = new Map<number, boolean>();
          prev.forEach((chat) => {
            if (chat.type === "private" && chat.participant?.visibleId !== undefined && chat.participant.isOnline !== undefined) {
              onlineStatusMap.set(chat.participant.visibleId, chat.participant.isOnline);
            }
          });
          
          const existingIds = new Set(prev.map(c => c.id));
          const newChatsWithStatus = mappedChats
            .filter(c => !existingIds.has(c.id))
            .map((chat) => {
              if (chat.type === "private" && chat.participant?.visibleId !== undefined) {
                const savedOnlineStatus = onlineStatusMap.get(chat.participant.visibleId);
                if (savedOnlineStatus !== undefined) {
                  return {
                    ...chat,
                    participant: {
                      ...chat.participant,
                      isOnline: savedOnlineStatus,
                    },
                  };
                }
              }
              return chat;
            });
          const merged = [...prev, ...newChatsWithStatus];
          chatCache.saveChats(merged);
          return merged;
        });
        
        setHasMoreChats(result.data.pageInfo.hasMore);
        setNextCursor(result.data.pageInfo.nextCursor);
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to load more chats:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user?.visibleId, isLoadingMore, hasMoreChats, nextCursor]);

  const loadChats = useCallback(async () => {
    if (!user?.visibleId) return;
    
    const hadCache = await loadFromCache();
    if (!hadCache) {
      setIsLoading(true);
    }
    await loadFromServer();
  }, [user?.visibleId, loadFromCache, loadFromServer]);

  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user, loadChats]);

  useEffect(() => {
    if (onlineUsers.size === 0) return;
    
    setChats((prev) => {
      let hasChanges = false;
      const updated = prev.map((chat) => {
        if (chat.type === "private" && chat.participant) {
          const participantVisibleId = chat.participant.visibleId;
          
          const isOnline = participantVisibleId !== undefined && onlineUsers.has(participantVisibleId);
          
          if (chat.participant.isOnline !== isOnline) {
            hasChanges = true;
            return {
              ...chat,
              participant: {
                ...chat.participant,
                isOnline,
              },
            };
          }
        }
        return chat;
      });
      return hasChanges ? updated : prev;
    });
  }, [onlineUsers]);

  useEffect(() => {
    notificationSoundService.initialize();
    return () => {
      notificationSoundService.cleanup();
    };
  }, []);

  useEffect(() => {
    if (!user?.visibleId) return;

    const unsubscribe = subscribe((event) => {
      if (event.type === "new_message") {
        const serverMessage = event.message;
        if (!serverMessage || typeof serverMessage.chatId === "undefined" || typeof serverMessage.senderId === "undefined") {
          return;
        }
        const message = apiService.serverMessageToMessage(serverMessage, user.visibleId!);
        const chatId = message.chatId;
        const isFromOther = message.senderId !== user.visibleId?.toString();
        
        const isActiveChatMessage = activeChatIdRef.current === chatId;
        const shouldIncrementUnread = isFromOther && !isActiveChatMessage;
        
        setChats((prev) => {
          const existingChat = prev.find((c) => c.id === chatId);
          
          if (isFromOther && AppState.currentState === "active" && !isActiveChatMessage) {
            notificationSoundService.playReceiveSound();
          }
          
          if (existingChat) {
            const updated = prev.map((chat) =>
              chat.id === chatId
                ? { 
                    ...chat, 
                    lastMessage: message, 
                    updatedAt: message.timestamp,
                    unreadCount: shouldIncrementUnread
                      ? (chat.unreadCount || 0) + 1 
                      : chat.unreadCount
                  }
                : chat
            );
            const sorted = updated.sort((a, b) => 
              new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
            );
            chatCache.saveChats(sorted);
            return sorted;
          } else {
            console.log("[ChatsContext] New chat detected, fetching chat list...");
            loadChats();
            return prev;
          }
        });
      } else if (event.type === "chat_deleted") {
        const deletedChatId = event.chatId.toString();
        console.log("[ChatsContext] Chat deleted by other user:", deletedChatId);
        
        setChats((prev) => {
          const updated = prev.filter((c) => c.id !== deletedChatId);
          chatCache.saveChats(updated);
          return updated;
        });
      } else if (event.type === "chat_updated") {
        const chatId = event.chatId.toString();
        const chatData = event.chat;
        console.log("[ChatsContext] Chat updated:", chatId);
        
        setChats((prev) => {
          const updated = prev.map((chat) => {
            if (chat.id === chatId && chatData) {
              return {
                ...chat,
                name: chatData.name || chat.name,
                avatarUrl: chatData.avatarUrl || chat.avatarUrl,
                description: chatData.description || chat.description,
              };
            }
            return chat;
          });
          chatCache.saveChats(updated);
          return updated;
        });
      } else if (event.type === "members_added" || event.type === "member_removed" || event.type === "group_role_changed") {
        console.log("[ChatsContext] Group membership changed, refreshing chats...");
        loadChats();
      } else if (event.type === "removed_from_chat") {
        const chatId = event.chatId.toString();
        console.log("[ChatsContext] You were removed from chat:", chatId);
        setChats((prev) => {
          const updated = prev.filter((c) => c.id !== chatId);
          chatCache.saveChats(updated);
          return updated;
        });
      } else if (event.type === "member_left") {
        const chatId = event.chatId.toString();
        const leftUserId = event.userId;
        
        if (leftUserId === user.visibleId) {
          console.log("[ChatsContext] Current user left group:", chatId);
          setChats((prev) => {
            const updated = prev.filter((c) => c.id !== chatId);
            chatCache.saveChats(updated);
            return updated;
          });
        } else {
          console.log("[ChatsContext] User left group:", leftUserId, "from:", chatId);
          loadChats();
        }
      } else if (event.type === "group_owner_changed") {
        const chatId = event.chatId.toString();
        const newOwnerId = event.newOwnerId;
        console.log("[ChatsContext] Group owner changed:", chatId, "new owner:", newOwnerId);
        
        setChats((prev) => {
          const updated = prev.map((chat) => {
            if (chat.id === chatId) {
              return { ...chat, createdBy: newOwnerId };
            }
            return chat;
          });
          chatCache.saveChats(updated);
          return updated;
        });
      } else if (event.type === "message_read") {
        const chatId = event.chatId.toString();
        const readByUserId = event.readByUserId;
        console.log("[ChatsContext] Message read in chat:", chatId, "by:", readByUserId);
        
        setChats((prev) => {
          const updated = prev.map((chat) => {
            if (chat.id === chatId && chat.lastMessage) {
              const currentReadBy = chat.lastMessage.readBy || [];
              const userIdStr = readByUserId.toString();
              if (!currentReadBy.includes(userIdStr)) {
                return {
                  ...chat,
                  lastMessage: {
                    ...chat.lastMessage,
                    readBy: [...currentReadBy, userIdStr],
                    status: "read" as const,
                  },
                };
              }
            }
            return chat;
          });
          chatCache.saveChats(updated);
          return updated;
        });
      } else if (event.type === "chat_read") {
        const chatId = event.chatId.toString();
        const readByUserId = event.readByUserId;
        console.log("[ChatsContext] Chat read:", chatId, "by:", readByUserId);
        
        markUserOnlineByActivity(readByUserId);
        
        setChats((prev) => {
          const updated = prev.map((chat) => {
            if (chat.id === chatId && chat.lastMessage) {
              const currentReadBy = chat.lastMessage.readBy || [];
              const userIdStr = readByUserId.toString();
              if (!currentReadBy.includes(userIdStr)) {
                return {
                  ...chat,
                  lastMessage: {
                    ...chat.lastMessage,
                    readBy: [...currentReadBy, userIdStr],
                    status: "read" as const,
                  },
                };
              }
            }
            return chat;
          });
          chatCache.saveChats(updated);
          return updated;
        });
      } else if (event.type === "user_online") {
        const onlineUserId = event.userId;
        
        setChats((prev) => {
          let hasChanges = false;
          const updated = prev.map((chat) => {
            if (chat.type === "private" && chat.participant) {
              const participantVisibleId = chat.participant.visibleId;
              
              if (participantVisibleId === onlineUserId) {
                hasChanges = true;
                return {
                  ...chat,
                  participant: {
                    ...chat.participant,
                    isOnline: true,
                  },
                };
              }
            }
            return chat;
          });
          return hasChanges ? updated : prev;
        });
      } else if (event.type === "user_offline") {
        const offlineUserId = event.userId;
        
        setChats((prev) => {
          let hasChanges = false;
          const updated = prev.map((chat) => {
            if (chat.type === "private" && chat.participant) {
              const participantVisibleId = chat.participant.visibleId;
              
              if (participantVisibleId === offlineUserId) {
                hasChanges = true;
                return {
                  ...chat,
                  participant: {
                    ...chat.participant,
                    isOnline: false,
                  },
                };
              }
            }
            return chat;
          });
          return hasChanges ? updated : prev;
        });
      } else if (event.type === "user_deleted") {
        const deletedUserId = event.userId;
        console.log("[ChatsContext] User deleted:", deletedUserId);
        
        setChats((prev) => {
          const updated = prev.filter((chat) => {
            if (chat.type === "private" && chat.participant?.visibleId === deletedUserId) {
              return false;
            }
            return true;
          });
          if (updated.length !== prev.length) {
            chatCache.saveChats(updated);
          }
          return updated;
        });
      }
    });

    return unsubscribe;
  }, [user?.visibleId, subscribe, loadChats, markUserOnlineByActivity]);

  const createChat = useCallback(
    async (contact: Contact): Promise<Chat | null> => {
      if (!user?.visibleId) return null;

      try {
        const result = await apiService.createChat({
          type: "private",
          participantIds: [parseInt(contact.id, 10)],
        });

        if (result.success && result.data) {
          const newChat = apiService.serverChatToChat(result.data, user.visibleId);
          setChats((prev) => {
            const exists = prev.find(c => c.id === newChat.id);
            if (exists) return prev;
            return [newChat, ...prev];
          });
          return newChat;
        }
      } catch (error) {
        __DEV__ && console.warn("Failed to create chat:", error);
      }

      return null;
    },
    [user?.visibleId]
  );

  const createGroupChat = useCallback(
    async (name: string, participantIds: number[]): Promise<Chat | null> => {
      if (!user?.visibleId) return null;

      try {
        const result = await apiService.createChat({
          type: "group",
          participantIds,
          name,
        });

        if (result.success && result.data) {
          const newChat = apiService.serverChatToChat(result.data, user.visibleId);
          setChats((prev) => [newChat, ...prev]);
          return newChat;
        }
      } catch (error) {
        __DEV__ && console.warn("Failed to create group chat:", error);
      }

      return null;
    },
    [user]
  );

  const deleteChat = useCallback(async (chatId: string): Promise<boolean> => {
    if (welcomeChatService.isWelcomeChat(chatId)) {
      await welcomeChatService.dismissWelcomeChat();
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      return true;
    }

    const numericId = parseInt(chatId, 10);
    if (isNaN(numericId)) return false;

    let deletedChat: Chat | undefined;
    setChats((prev) => {
      deletedChat = prev.find((c) => c.id === chatId);
      const updated = prev.filter((c) => c.id !== chatId);
      chatCache.saveChats(updated);
      return updated;
    });

    try {
      let result;
      
      if (deletedChat?.type === "group") {
        result = await apiService.leaveGroup(numericId);
      } else {
        result = await apiService.deleteChat(numericId);
      }
      
      if (!result.success && deletedChat) {
        setChats((prev) => {
          const restored = [...prev, deletedChat!].sort(
            (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
          );
          chatCache.saveChats(restored);
          return restored;
        });
        return false;
      }
      return true;
    } catch (error) {
      __DEV__ && console.warn("Failed to delete chat:", error);
      if (deletedChat) {
        setChats((prev) => {
          const restored = [...prev, deletedChat!].sort(
            (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
          );
          chatCache.saveChats(restored);
          return restored;
        });
      }
      return false;
    }
  }, [user?.visibleId]);

  const markAsRead = useCallback((chatId: string) => {
    console.log("[ChatsContext] markAsRead called for chat:", chatId);
    
    if (welcomeChatService.isWelcomeChat(chatId)) {
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
      return;
    }
    
    const numericChatId = parseInt(chatId, 10);
    if (!isNaN(numericChatId)) {
      apiService.markChatAsRead(numericChatId).catch((err) => {
        __DEV__ && console.warn("[ChatsContext] markAsRead API error:", err);
      });
    }
    setChats((prev) => {
      const updated = prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c));
      chatCache.saveChats(updated);
      return updated;
    });
  }, []);

  const refreshChats = useCallback(async () => {
    await loadChats();
  }, [loadChats]);

  const updateChatLastMessage = useCallback((chatId: string, message: Message) => {
    console.log("[ChatsContext] updateChatLastMessage for chat:", chatId);
    setChats((prev) => {
      const existingChat = prev.find((c) => c.id === chatId);
      if (!existingChat) return prev;
      
      const updated = prev.map((chat) =>
        chat.id === chatId
          ? { 
              ...chat, 
              lastMessage: message, 
              updatedAt: message.timestamp,
            }
          : chat
      );
      const sorted = updated.sort((a, b) => 
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      chatCache.saveChats(sorted);
      return sorted;
    });
  }, []);

  return (
    <ChatsContext.Provider
      value={{
        chats,
        isLoading,
        isLoadingMore,
        hasMoreChats,
        createChat,
        createGroupChat,
        deleteChat,
        markAsRead,
        setActiveChat,
        refreshChats,
        loadMoreChats,
        updateChatLastMessage,
      }}
    >
      {children}
    </ChatsContext.Provider>
  );
}

export function useChatsContext() {
  const context = useContext(ChatsContext);
  if (!context) {
    throw new Error("useChatsContext must be used within a ChatsProvider");
  }
  return context;
}

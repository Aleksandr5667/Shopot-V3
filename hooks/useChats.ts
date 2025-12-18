import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AppState } from "react-native";
import { Chat, Message, Contact } from "@/store/types";
import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { apiService } from "@/services/api";
import { notificationSoundService } from "@/services/notificationSound";
import { chatCache } from "@/services/chatCache";
import { messageQueue, QueuedMessage } from "@/services/messageQueue";
import { welcomeChatService } from "@/services/welcomeChat";
import { deletedMessagesService } from "@/services/deletedMessagesService";

type UpdateChatLastMessageFn = (chatId: string, message: Message) => void;

export function useChats() {
  const { user } = useAuth();
  const { subscribe } = useWebSocket();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadFromCache = useCallback(async () => {
    const cached = await chatCache.getChats();
    if (cached && cached.length > 0) {
      setChats(cached);
      setIsLoading(false);
      return true;
    }
    return false;
  }, []);

  const loadFromServer = useCallback(async () => {
    if (!user?.visibleId) return;
    
    try {
      setIsSyncing(true);
      const result = await apiService.getChats();
      if (result.success && result.data) {
        const mappedChats = result.data.chats.map((serverChat) =>
          apiService.serverChatToChat(serverChat, user.visibleId!)
        );
        setChats(mappedChats);
        await chatCache.saveChats(mappedChats);
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to load chats from server:", error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [user?.visibleId]);

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
        
        setChats((prev) => {
          const existingChat = prev.find((c) => c.id === chatId);
          
          if (existingChat) {
            const updated = prev.map((chat) =>
              chat.id === chatId
                ? { 
                    ...chat, 
                    lastMessage: message, 
                    updatedAt: message.timestamp,
                    unreadCount: isFromOther
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
            console.log("[useChats] New chat detected, fetching chat list...");
            loadChats();
            return prev;
          }
        });
      } else if (event.type === "message_updated") {
        // Update message in cache even when not viewing the chat
        const serverMessage = event.message as any;
        if (!serverMessage) return;
        
        const messageId = (serverMessage.id ?? serverMessage.messageId)?.toString();
        const chatIdNum = serverMessage.chatId;
        const content = serverMessage.content;
        
        if (!messageId || chatIdNum === undefined) return;
        
        const chatIdStr = chatIdNum.toString();
        
        // Update the message in cache
        chatCache.getMessages(chatIdStr).then((cachedMessages) => {
          if (cachedMessages && cachedMessages.length > 0) {
            const messageExists = cachedMessages.some((m) => m.id === messageId);
            if (messageExists) {
              const updatedMessages = cachedMessages.map((m) => {
                if (m.id === messageId) {
                  console.log("[useChats] Updating cached message", messageId, "in chat", chatIdStr);
                  return {
                    ...m,
                    text: content ?? m.text,
                    isEdited: true,
                  };
                }
                return m;
              });
              chatCache.saveMessages(chatIdStr, updatedMessages);
            }
          }
        }).catch((err) => {
          __DEV__ && console.warn("[useChats] Error updating cached message:", err);
        });
        
        // Also update lastMessage in chat list if it's the last message
        setChats((prev) => {
          const chat = prev.find((c) => c.id === chatIdStr);
          if (chat && chat.lastMessage?.id === messageId) {
            const updated = prev.map((c) =>
              c.id === chatIdStr
                ? {
                    ...c,
                    lastMessage: {
                      ...c.lastMessage!,
                      text: content ?? c.lastMessage!.text,
                      isEdited: true,
                    },
                  }
                : c
            );
            chatCache.saveChats(updated);
            return updated;
          }
          return prev;
        });
      } else if (event.type === "message_deleted") {
        const messageId = event.messageId?.toString();
        const chatIdNum = event.chatId;
        
        if (!messageId || chatIdNum === undefined) return;
        
        const chatIdStr = chatIdNum.toString();
        
        deletedMessagesService.markAsDeleted(messageId);
        console.log("[useChats] Marked message as deleted:", messageId);
        
        chatCache.getMessages(chatIdStr).then((cachedMessages) => {
          if (cachedMessages && cachedMessages.length > 0) {
            const filteredMessages = cachedMessages.filter((m) => m.id !== messageId);
            if (filteredMessages.length !== cachedMessages.length) {
              console.log("[useChats] Deleting cached message", messageId, "from chat", chatIdStr);
              chatCache.saveMessages(chatIdStr, filteredMessages);
            }
          }
        }).catch((err) => {
          __DEV__ && console.warn("[useChats] Error deleting cached message:", err);
        });
      } else if (event.type === "chat_deleted") {
        const deletedChatId = event.chatId?.toString();
        if (!deletedChatId) return;
        
        console.log("[useChats] Chat deleted event:", deletedChatId);
        setChats((prev) => {
          const updated = prev.filter((c) => c.id !== deletedChatId);
          chatCache.saveChats(updated);
          return updated;
        });
        chatCache.deleteChat(deletedChatId);
      }
    });

    return unsubscribe;
  }, [user?.visibleId, subscribe, loadChats]);

  const createChat = useCallback(
    async (contact: Contact): Promise<Chat | null> => {
      console.log("[createChat] Contact:", JSON.stringify(contact));
      console.log("[createChat] User visibleId:", user?.visibleId);
      
      if (!user?.visibleId) {
        console.log("[createChat] No user visibleId");
        return null;
      }
      
      if (!contact.visibleId) {
        console.log("[createChat] No contact visibleId");
        return null;
      }

      const existingChat = chats.find(
        (c) => c.type === 'private' && c.participant?.visibleId === contact.visibleId
      );
      if (existingChat) {
        console.log("[createChat] Found existing private chat:", existingChat.id);
        return existingChat;
      }

      try {
        console.log("[createChat] Creating new chat with participantId:", contact.visibleId);
        const result = await apiService.createChat({
          type: "private",
          participantIds: [contact.visibleId],
        });
        console.log("[createChat] API result:", JSON.stringify(result));

        if (result.success && result.data) {
          const newChat = apiService.serverChatToChat(result.data, user.visibleId);
          setChats((prev) => [newChat, ...prev]);
          return newChat;
        }
      } catch (error) {
        __DEV__ && console.warn("Failed to create chat:", error);
      }

      return null;
    },
    [user, chats]
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
    try {
      const numericId = parseInt(chatId, 10);
      const result = await apiService.deleteChat(numericId);
      
      if (result.success) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        return true;
      }
      return false;
    } catch (error) {
      __DEV__ && console.warn("Failed to delete chat:", error);
      return false;
    }
  }, []);

  const markAsRead = useCallback(async (chatId: string) => {
    const numericChatId = parseInt(chatId, 10);
    if (!isNaN(numericChatId)) {
      apiService.markChatAsRead(numericChatId).catch((err) => {
        __DEV__ && console.warn("[markAsRead] API error:", err);
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

  return {
    chats,
    isLoading,
    createChat,
    createGroupChat,
    deleteChat,
    markAsRead,
    refreshChats,
  };
}

export function useCreateChat() {
  const { user } = useAuth();

  const createChat = useCallback(
    async (participantIds: number[]): Promise<Chat | null> => {
      if (!user?.visibleId) return null;

      try {
        const result = await apiService.createChat({
          type: participantIds.length > 1 ? "group" : "private",
          participantIds,
        });

        if (result.success && result.data) {
          const newChat = apiService.serverChatToChat(result.data, user.visibleId);
          return newChat;
        }
      } catch (error) {
        __DEV__ && console.warn("Failed to create chat:", error);
      }

      return null;
    },
    [user?.visibleId]
  );

  return { createChat };
}

const MESSAGES_PAGE_SIZE = 50;

export function useMessages(chatId: string, updateChatLastMessage?: UpdateChatLastMessageFn, participantCount?: number) {
  const { user } = useAuth();
  const { subscribe, sendTyping } = useWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const recipientCount = participantCount ? participantCount - 1 : 1;
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const [chatDeleted, setChatDeleted] = useState(false);
  const typingTimeoutRef = useRef<{ [key: number]: ReturnType<typeof setTimeout> }>({});
  const pendingDeliveryRef = useRef<Map<string, { deliveredTo: number[]; readBy?: string[] }>>(new Map());

  const loadFromCache = useCallback(async () => {
    await deletedMessagesService.initialize();
    const cached = await chatCache.getMessages(chatId);
    const numericChatId = parseInt(chatId, 10);
    const pendingQueue = !isNaN(numericChatId) ? messageQueue.getQueueForChat(numericChatId) : [];
    
    if (cached && cached.length > 0) {
      let serverMessages = cached.filter((m) => !m.id.startsWith("temp_") && !deletedMessagesService.isDeleted(m.id));
      
      const pendingQueueIds = new Set(pendingQueue.map((q) => q.id));
      let tempMessages = cached.filter((m) => m.id.startsWith("temp_") && pendingQueueIds.has(m.id));
      
      pendingQueue.forEach((queuedMsg) => {
        const existsInTemp = tempMessages.some((m) => m.id === queuedMsg.id);
        if (!existsInTemp) {
          tempMessages.push({
            id: queuedMsg.id,
            tempId: queuedMsg.id,
            chatId: chatId,
            senderId: user?.id || "",
            text: queuedMsg.content,
            type: queuedMsg.type,
            mediaType: queuedMsg.type === "image" ? "photo" : queuedMsg.type === "video" ? "video" : queuedMsg.type === "voice" ? "audio" : undefined,
            mediaUri: queuedMsg.mediaUri,
            audioDuration: queuedMsg.audioDuration,
            timestamp: new Date(queuedMsg.createdAt).toISOString(),
            status: queuedMsg.status === "failed" ? "error" : "sending",
            isUploading: queuedMsg.status === "uploading",
            uploadProgress: queuedMsg.uploadProgress,
            uploadedBytes: queuedMsg.mediaSize && queuedMsg.uploadProgress ? Math.round((queuedMsg.uploadProgress / 100) * queuedMsg.mediaSize) : undefined,
            totalBytes: queuedMsg.mediaSize,
            replyToId: queuedMsg.replyToId?.toString(),
          });
        }
      });
      
      let mergedMessages = [...serverMessages, ...tempMessages];
      mergedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(mergedMessages);
      await chatCache.saveMessages(chatId, mergedMessages);
      setIsLoading(false);
      return true;
    }
    return false;
  }, [chatId, user?.id]);

  const loadFromServer = useCallback(async () => {
    if (!user?.visibleId) return;
    
    if (welcomeChatService.isWelcomeChat(chatId)) {
      const welcomeMessages = welcomeChatService.getWelcomeMessages();
      setMessages(welcomeMessages);
      setHasMoreMessages(false);
      setIsLoading(false);
      setIsSyncing(false);
      return;
    }
    
    try {
      setIsSyncing(true);
      const numericChatId = parseInt(chatId, 10);
      if (isNaN(numericChatId)) {
        setIsLoading(false);
        setIsSyncing(false);
        return;
      }

      const result = await apiService.getChatMessages(numericChatId, MESSAGES_PAGE_SIZE);
      if (result.success && result.data) {
        const mappedMessages = result.data.map((serverMessage) =>
          apiService.serverMessageToMessage(serverMessage, user.visibleId!)
        ).filter(m => !deletedMessagesService.isDeleted(m.id));
        
        setHasMoreMessages(result.data.length >= MESSAGES_PAGE_SIZE);
        
        const pendingQueue = messageQueue.getQueueForChat(numericChatId);
        let mergedMessages = [...mappedMessages];
        
        pendingQueue.forEach((queuedMsg) => {
          const existsInServer = mergedMessages.some((m) => m.id === queuedMsg.id);
          if (!existsInServer) {
            mergedMessages.push({
              id: queuedMsg.id,
              tempId: queuedMsg.id,
              chatId: chatId,
              senderId: user.id,
              text: queuedMsg.content,
              type: queuedMsg.type,
              mediaType: queuedMsg.type === "image" ? "photo" : queuedMsg.type === "video" ? "video" : queuedMsg.type === "voice" ? "audio" : undefined,
              mediaUri: queuedMsg.mediaUri,
              audioDuration: queuedMsg.audioDuration,
              timestamp: new Date(queuedMsg.createdAt).toISOString(),
              status: queuedMsg.status === "failed" ? "error" : "sending",
              isUploading: queuedMsg.status === "uploading",
              uploadProgress: queuedMsg.uploadProgress,
              uploadedBytes: queuedMsg.mediaSize && queuedMsg.uploadProgress ? Math.round((queuedMsg.uploadProgress / 100) * queuedMsg.mediaSize) : undefined,
              totalBytes: queuedMsg.mediaSize,
              replyToId: queuedMsg.replyToId?.toString(),
            });
          }
        });
        
        mergedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setMessages(mergedMessages);
        await chatCache.saveMessages(chatId, mergedMessages);
        
        apiService.markChatAsRead(numericChatId).catch((err) => {
          __DEV__ && console.warn("[useMessages] Mark as read error:", err);
        });
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to load messages from server:", error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [chatId, user?.visibleId, user?.id]);

  const loadMoreMessages = useCallback(async () => {
    if (!user?.visibleId || isLoadingMore || !hasMoreMessages || messages.length === 0) return;
    
    const numericChatId = parseInt(chatId, 10);
    if (isNaN(numericChatId)) return;

    const oldestMessage = messages[0];
    const beforeTimestamp = oldestMessage?.timestamp;
    
    if (!beforeTimestamp) return;

    try {
      setIsLoadingMore(true);

      const result = await apiService.getChatMessages(numericChatId, MESSAGES_PAGE_SIZE, beforeTimestamp);
      if (result.success && result.data) {
        const mappedMessages = result.data.map((serverMessage) =>
          apiService.serverMessageToMessage(serverMessage, user.visibleId!)
        );
        
        if (mappedMessages.length < MESSAGES_PAGE_SIZE) {
          setHasMoreMessages(false);
        }
        
        if (mappedMessages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = mappedMessages.filter(m => !existingIds.has(m.id));
            if (newMessages.length === 0) {
              setHasMoreMessages(false);
              return prev;
            }
            const merged = [...newMessages, ...prev];
            merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            chatCache.saveMessages(chatId, merged);
            return merged;
          });
        } else {
          setHasMoreMessages(false);
        }
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, user?.visibleId, isLoadingMore, hasMoreMessages, messages]);

  const loadMessages = useCallback(async () => {
    if (!user?.visibleId) return;
    
    const hadCache = await loadFromCache();
    if (!hadCache) {
      setIsLoading(true);
    }
    await loadFromServer();
  }, [user?.visibleId, loadFromCache, loadFromServer]);

  useEffect(() => {
    if (user) {
      loadMessages();
    }
  }, [user, loadMessages]);


  useEffect(() => {
    if (!user?.visibleId) return;

    const numericChatId = parseInt(chatId, 10);
    if (isNaN(numericChatId)) return;

    const unsubscribe = subscribe((event) => {
      if (event.type === "new_message") {
        const serverMessage = event.message;
        if (!serverMessage || typeof serverMessage.chatId === "undefined" || typeof serverMessage.senderId === "undefined") {
          return;
        }
        if (serverMessage.chatId === numericChatId) {
          const message = apiService.serverMessageToMessage(serverMessage, user.visibleId!);
          const isOwnMessage = serverMessage.senderId === user.visibleId;
          
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            
            if (isOwnMessage) {
              const hasTempMessage = prev.some((m) => m.id.startsWith("temp_"));
              if (hasTempMessage) {
                return prev;
              }
            }
            
            const updated = [...prev, message];
            chatCache.saveMessages(chatId, updated);
            return updated;
          });
          
          if (message.senderId !== user.visibleId?.toString()) {
            apiService.markChatAsRead(numericChatId).catch((err) => {
              __DEV__ && console.warn("[useMessages] Mark new message as read error:", err);
            });
          }
        }
      } else if (event.type === "message_updated") {
        const serverMessage = event.message as any;
        if (!serverMessage) return;
        
        const updatedMessageId = (serverMessage.id ?? serverMessage.messageId)?.toString();
        const updatedChatId = serverMessage.chatId;
        
        if (!updatedMessageId || updatedChatId === undefined) return;
        
        if (updatedChatId === numericChatId) {
          setMessages((prev) => {
            const updated = prev.map((m) => {
              if (m.id === updatedMessageId) {
                return {
                  ...m,
                  text: serverMessage.content ?? m.text,
                  isEdited: serverMessage.edited ?? true,
                };
              }
              return m;
            });
            chatCache.saveMessages(chatId, updated);
            return updated;
          });
        }
      } else if (event.type === "message_deleted") {
        if (typeof event.chatId !== "undefined" && typeof event.messageId !== "undefined" && event.chatId === numericChatId) {
          const deletedId = event.messageId.toString();
          deletedMessagesService.markAsDeleted(deletedId);
          setMessages((prev) => {
            const updated = prev.filter((m) => m.id !== deletedId);
            chatCache.saveMessages(chatId, updated);
            return updated;
          });
        }
      } else if (event.type === "message_delivered") {
        console.log("[useMessages] message_delivered event:", event.messageId, "chatId:", event.chatId, "current:", numericChatId);
        if (typeof event.chatId !== "undefined" && typeof event.messageId !== "undefined" && event.chatId === numericChatId) {
          const messageIdStr = event.messageId.toString();
          const deliveredTo = event.deliveredTo || [];
          console.log("[useMessages] Updating message", messageIdStr, "to delivered");
          setMessages((prev) => {
            const found = prev.find((m) => m.id === messageIdStr);
            console.log("[useMessages] Found message:", found?.id, "status:", found?.status);
            if (!found) {
              console.log("[useMessages] Message not found, storing pending delivery for:", messageIdStr);
              pendingDeliveryRef.current.set(messageIdStr, { deliveredTo });
              return prev;
            }
            const updated = prev.map((m) => {
              if (m.id === messageIdStr && m.status === "sent") {
                console.log("[useMessages] Changing status to delivered for:", m.id);
                return { ...m, status: "delivered" as const };
              }
              return m;
            });
            chatCache.saveMessages(chatId, updated);
            return updated;
          });
        }
      } else if (event.type === "message_read") {
        console.log("[useMessages] message_read event:", event.messageId, "chatId:", event.chatId, "current:", numericChatId);
        if (typeof event.chatId !== "undefined" && typeof event.messageId !== "undefined" && event.chatId === numericChatId) {
          const messageIdStr = event.messageId.toString();
          const readByUserIdStr = event.readByUserId.toString();
          console.log("[useMessages] Updating message", messageIdStr, "to read by:", readByUserIdStr, "recipientCount:", recipientCount);
          setMessages((prev) => {
            const updated = prev.map((m) => {
              if (m.id === messageIdStr && (m.status === "sent" || m.status === "delivered")) {
                const currentReadBy = m.readBy || [];
                if (!currentReadBy.includes(readByUserIdStr)) {
                  const newReadBy = [...currentReadBy, readByUserIdStr];
                  const allRead = newReadBy.length >= recipientCount;
                  console.log("[useMessages] readBy count:", newReadBy.length, "recipientCount:", recipientCount, "allRead:", allRead);
                  return { 
                    ...m, 
                    status: allRead ? "read" as const : "delivered" as const,
                    readBy: newReadBy,
                    readAt: event.readAt,
                  };
                }
              }
              return m;
            });
            chatCache.saveMessages(chatId, updated);
            return updated;
          });
        }
      } else if (event.type === "chat_read") {
        console.log("[useMessages] chat_read event:", "chatId:", event.chatId, "current:", numericChatId, "readBy:", event.readByUserId, "recipientCount:", recipientCount);
        if (typeof event.chatId !== "undefined" && event.chatId === numericChatId) {
          const readByUserIdStr = event.readByUserId.toString();
          console.log("[useMessages] Marking all messages as read by:", readByUserIdStr);
          setMessages((prev) => {
            let hasChanges = false;
            const updated = prev.map((m) => {
              if (m.senderId === user.visibleId?.toString() && (m.status === "sent" || m.status === "delivered")) {
                const currentReadBy = m.readBy || [];
                if (!currentReadBy.includes(readByUserIdStr)) {
                  hasChanges = true;
                  const newReadBy = [...currentReadBy, readByUserIdStr];
                  const allRead = newReadBy.length >= recipientCount;
                  console.log("[useMessages] Changing status for:", m.id, "allRead:", allRead);
                  return { 
                    ...m, 
                    status: allRead ? "read" as const : "delivered" as const,
                    readBy: newReadBy,
                    readAt: event.readAt,
                  };
                }
              }
              return m;
            });
            if (hasChanges) {
              chatCache.saveMessages(chatId, updated);
            }
            return hasChanges ? updated : prev;
          });
        }
      } else if (event.type === "typing") {
        if (typeof event.chatId !== "undefined" && typeof event.userId !== "undefined" && event.chatId === numericChatId && event.userId !== user.visibleId) {
          setTypingUsers((prev) => {
            if (!prev.includes(event.userId)) {
              return [...prev, event.userId];
            }
            return prev;
          });

          if (typingTimeoutRef.current[event.userId]) {
            clearTimeout(typingTimeoutRef.current[event.userId]);
          }
          typingTimeoutRef.current[event.userId] = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((id) => id !== event.userId));
            delete typingTimeoutRef.current[event.userId];
          }, 3000);
        }
      } else if (event.type === "chat_deleted") {
        if (typeof event.chatId !== "undefined" && event.chatId === numericChatId) {
          console.log("[useMessages] Chat deleted:", numericChatId);
          setChatDeleted(true);
        }
      }
    });

    return () => {
      unsubscribe();
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
      typingTimeoutRef.current = {};
    };
  }, [chatId, user?.visibleId, subscribe, recipientCount]);

  useEffect(() => {
    const numericChatId = parseInt(chatId, 10);
    if (isNaN(numericChatId) || !user?.visibleId) return;

    messageQueue.setCallbacks(
      (tempId, serverMessage, msgChatId) => {
        if (msgChatId === numericChatId) {
          notificationSoundService.playSendSound();
          const serverIdStr = String(serverMessage.id);
          const pendingDelivery = pendingDeliveryRef.current.get(serverIdStr);
          if (pendingDelivery) {
            console.log("[useMessages] Applying pending delivery for:", serverIdStr);
            pendingDeliveryRef.current.delete(serverIdStr);
          }
          setMessages((prev) => {
            const updated = prev.map((m) => {
              if (m.id === tempId) {
                const deliveredTo = pendingDelivery?.deliveredTo || serverMessage.deliveredTo || [];
                let newStatus: "sent" | "delivered" = "sent";
                if (deliveredTo.length > 1) {
                  newStatus = "delivered";
                }
                return {
                  ...m,
                  id: serverIdStr,
                  tempId: m.tempId,
                  status: newStatus,
                  isUploading: false,
                  timestamp: serverMessage.createdAt || m.timestamp,
                  mediaUrl: serverMessage.mediaUrl || m.mediaUrl,
                  replyToMessage: serverMessage.replyToMessage ? {
                    id: String(serverMessage.replyToMessage.id),
                    senderId: String(serverMessage.replyToMessage.senderId),
                    senderName: serverMessage.replyToMessage.senderName,
                    content: serverMessage.replyToMessage.content,
                    type: serverMessage.replyToMessage.type,
                  } : m.replyToMessage,
                };
              }
              return m;
            });
            chatCache.saveMessages(chatId, updated);
            return updated;
          });
        }
      },
      (tempId, msgChatId, error) => {
        if (msgChatId === numericChatId) {
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.id === tempId ? { ...m, status: "error" as const, isUploading: false, uploadError: true } : m
            );
            chatCache.saveMessages(chatId, updated);
            return updated;
          });
        }
      }
    );

    const unsubscribeQueue = messageQueue.subscribe((queue) => {
      const chatQueue = queue.filter((m) => m.chatId === numericChatId);
      chatQueue.forEach((queuedMsg) => {
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === queuedMsg.id);
          if (existing) {
            const updated = prev.map((m) =>
              m.id === queuedMsg.id
                ? {
                    ...m,
                    status: queuedMsg.status === "failed" ? "error" as const : "sending" as const,
                    uploadProgress: queuedMsg.uploadProgress,
                    uploadedBytes: queuedMsg.mediaSize && queuedMsg.uploadProgress ? Math.round((queuedMsg.uploadProgress / 100) * queuedMsg.mediaSize) : undefined,
                    totalBytes: queuedMsg.mediaSize,
                    isUploading: queuedMsg.status === "uploading",
                  }
                : m
            );
            chatCache.saveMessages(chatId, updated);
            return updated;
          }
          return prev;
        });
      });
    });

    return unsubscribeQueue;
  }, [chatId, user?.visibleId]);

  const sendMessage = useCallback(
    async (
      text?: string,
      mediaType?: "photo" | "video" | "audio",
      mediaUri?: string,
      audioDuration?: number,
      replyToId?: string
    ) => {
      if (!user?.visibleId) return;
      if (!text && !mediaUri) return;
      if (welcomeChatService.isWelcomeChat(chatId)) return;

      const numericChatId = parseInt(chatId, 10);
      if (isNaN(numericChatId)) return;

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const uploadType =
        mediaType === "photo"
          ? "image"
          : mediaType === "video"
            ? "video"
            : mediaType === "audio"
              ? "voice"
              : "text";

      const tempMessage: Message = {
        id: tempId,
        tempId: tempId,
        chatId: chatId,
        senderId: user.id,
        text: text || undefined,
        type: uploadType,
        mediaType: mediaType,
        mediaUri: mediaUri,
        audioDuration: audioDuration,
        timestamp: new Date().toISOString(),
        status: "sending",
        isUploading: mediaUri && mediaType ? true : false,
        uploadProgress: mediaUri && mediaType ? 0 : undefined,
        replyToId: replyToId,
      };
      setMessages((prev) => {
        const updated = [...prev, tempMessage];
        chatCache.saveMessages(chatId, updated);
        return updated;
      });
      
      if (updateChatLastMessage) {
        updateChatLastMessage(chatId, tempMessage);
      }

      const numericReplyToId = replyToId ? parseInt(replyToId, 10) : undefined;

      await messageQueue.enqueue({
        id: tempId,
        chatId: numericChatId,
        content: text,
        type: uploadType as "text" | "image" | "video" | "voice",
        mediaUri: mediaUri,
        audioDuration: audioDuration,
        replyToId: numericReplyToId,
      });
    },
    [user, chatId]
  );

  const editMessage = useCallback(
    async (messageId: string, content: string): Promise<boolean> => {
      if (welcomeChatService.isWelcomeChat(chatId)) return false;
      const numericMessageId = parseInt(messageId, 10);
      if (isNaN(numericMessageId)) return false;

      let originalMessage: Message | undefined;
      setMessages((prev) => {
        originalMessage = prev.find((m) => m.id === messageId);
        const updated = prev.map((m) => 
          m.id === messageId ? { ...m, text: content, isEdited: true } : m
        );
        chatCache.saveMessages(chatId, updated);
        return updated;
      });

      try {
        const result = await apiService.editMessage(numericMessageId, content);
        if (result.success && result.data && user?.visibleId) {
          const updatedMessage = apiService.serverMessageToMessage(result.data, user.visibleId);
          setMessages((prev) => {
            const updated = prev.map((m) => (m.id === messageId ? updatedMessage : m));
            chatCache.saveMessages(chatId, updated);
            return updated;
          });
          return true;
        } else if (originalMessage) {
          setMessages((prev) => {
            const restored = prev.map((m) => (m.id === messageId ? originalMessage! : m));
            chatCache.saveMessages(chatId, restored);
            return restored;
          });
        }
      } catch (error) {
        __DEV__ && console.warn("Failed to edit message:", error);
        if (originalMessage) {
          setMessages((prev) => {
            const restored = prev.map((m) => (m.id === messageId ? originalMessage! : m));
            chatCache.saveMessages(chatId, restored);
            return restored;
          });
        }
      }
      return false;
    },
    [user?.visibleId, chatId]
  );

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (welcomeChatService.isWelcomeChat(chatId)) return false;
    const isTemporaryMessage = messageId.startsWith("temp_");
    
    deletedMessagesService.markAsDeleted(messageId);
    
    setMessages((prev) => {
      const updated = prev.filter((m) => m.id !== messageId);
      chatCache.saveMessages(chatId, updated);
      return updated;
    });

    if (isTemporaryMessage) {
      await messageQueue.removeFromQueue(messageId);
      return true;
    }

    const numericMessageId = parseInt(messageId, 10);
    if (isNaN(numericMessageId)) return true;

    try {
      const result = await apiService.deleteMessage(numericMessageId);
      return result.success;
    } catch (error) {
      __DEV__ && console.warn("Failed to delete message:", error);
      return false;
    }
  }, [chatId]);

  const hideMessageLocally = useCallback((messageId: string): void => {
    if (welcomeChatService.isWelcomeChat(chatId)) return;
    setMessages((prev) => {
      const updated = prev.filter((m) => m.id !== messageId);
      chatCache.saveMessages(chatId, updated);
      return updated;
    });
  }, [chatId]);

  const markMessageAsRead = useCallback(async (messageId: string) => {
    const numericMessageId = parseInt(messageId, 10);
    if (isNaN(numericMessageId)) return;

    await apiService.markMessageAsRead(numericMessageId);
  }, []);

  const sendTypingIndicator = useCallback(() => {
    const numericChatId = parseInt(chatId, 10);
    if (!isNaN(numericChatId)) {
      sendTyping(numericChatId);
    }
  }, [chatId, sendTyping]);

  const retryMessage = useCallback(async (messageId: string) => {
    if (welcomeChatService.isWelcomeChat(chatId)) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status: "sending" as const, uploadError: false } : m
      )
    );
    await messageQueue.retryFailed(messageId);
  }, [chatId]);

  const getPendingCount = useCallback(() => {
    const numericChatId = parseInt(chatId, 10);
    if (isNaN(numericChatId)) return 0;
    return messageQueue.getQueueForChat(numericChatId).length;
  }, [chatId]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMoreMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    hideMessageLocally,
    markMessageAsRead,
    refreshMessages: loadMessages,
    loadMoreMessages,
    typingUsers,
    sendTypingIndicator,
    retryMessage,
    getPendingCount,
    chatDeleted,
  };
}

const SEARCH_PAGE_SIZE = 50;

export function useMessageSearch() {
  const { user } = useAuth();
  const [results, setResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState("");

  const searchMessages = useCallback(
    async (query: string) => {
      if (!user?.visibleId || !query.trim()) {
        setResults([]);
        setHasMoreResults(false);
        setNextCursor(null);
        setCurrentQuery("");
        return;
      }

      try {
        setIsSearching(true);
        setCurrentQuery(query);
        const result = await apiService.searchMessages(query, SEARCH_PAGE_SIZE);
        if (result.success && result.data) {
          const mappedMessages = result.data.messages.map((serverMessage) =>
            apiService.serverMessageToMessage(serverMessage, user.visibleId!)
          );
          setResults(mappedMessages);
          setHasMoreResults(result.data.pageInfo.hasMore);
          setNextCursor(result.data.pageInfo.nextCursor);
        }
      } catch (error) {
        __DEV__ && console.warn("Failed to search messages:", error);
      } finally {
        setIsSearching(false);
      }
    },
    [user?.visibleId]
  );

  const loadMoreResults = useCallback(async () => {
    if (!user?.visibleId || isLoadingMore || !hasMoreResults || !nextCursor || !currentQuery.trim()) return;

    try {
      setIsLoadingMore(true);
      const result = await apiService.searchMessages(currentQuery, SEARCH_PAGE_SIZE, nextCursor);
      if (result.success && result.data) {
        const mappedMessages = result.data.messages.map((serverMessage) =>
          apiService.serverMessageToMessage(serverMessage, user.visibleId!)
        );
        
        setResults((prev) => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = mappedMessages.filter(m => !existingIds.has(m.id));
          return [...prev, ...newMessages];
        });
        
        setHasMoreResults(result.data.pageInfo.hasMore);
        setNextCursor(result.data.pageInfo.nextCursor);
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to load more search results:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user?.visibleId, isLoadingMore, hasMoreResults, nextCursor, currentQuery]);

  const clearSearch = useCallback(() => {
    setResults([]);
    setHasMoreResults(false);
    setNextCursor(null);
    setCurrentQuery("");
  }, []);

  return {
    results,
    isSearching,
    isLoadingMore,
    hasMoreResults,
    searchMessages,
    loadMoreResults,
    clearSearch,
  };
}

export function useOnlineStatus() {
  const { onlineUsers } = useWebSocket();
  
  const onlineUsersArray = useMemo(() => Array.from(onlineUsers), [onlineUsers]);

  const isOnline = useCallback(
    (userId: number) => {
      return onlineUsers.has(userId);
    },
    [onlineUsers]
  );

  const checkUserOnline = useCallback((userId: number): boolean => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  const refreshOnlineStatus = useCallback(() => {
  }, []);

  return {
    isOnline,
    checkUserOnline,
    refreshOnlineStatus,
    onlineUsers: onlineUsersArray,
  };
}

const CONTACTS_PAGE_SIZE = 50;

export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreContacts, setHasMoreContacts] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadFromCache = useCallback(async () => {
    const cached = await chatCache.getContacts();
    if (cached && cached.length > 0) {
      setContacts(cached);
      setIsLoading(false);
      return true;
    }
    return false;
  }, []);

  const loadFromServer = useCallback(async () => {
    try {
      setIsSyncing(true);
      const result = await apiService.getContacts(CONTACTS_PAGE_SIZE);
      if (result.success && result.data) {
        const mappedContacts = result.data.contacts.map((serverContact) =>
          apiService.serverContactToContact(serverContact)
        );
        setContacts(mappedContacts);
        setHasMoreContacts(result.data.pageInfo.hasMore);
        setNextCursor(result.data.pageInfo.nextCursor);
        await chatCache.saveContacts(mappedContacts);
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to load contacts from server:", error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  const loadMoreContacts = useCallback(async () => {
    if (isLoadingMore || !hasMoreContacts || !nextCursor) return;
    
    try {
      setIsLoadingMore(true);
      const result = await apiService.getContacts(CONTACTS_PAGE_SIZE, nextCursor);
      if (result.success && result.data) {
        const mappedContacts = result.data.contacts.map((serverContact) =>
          apiService.serverContactToContact(serverContact)
        );
        
        setContacts((prev) => {
          const existingIds = new Set(prev.map(c => c.id));
          const newContacts = mappedContacts.filter(c => !existingIds.has(c.id));
          const merged = [...prev, ...newContacts];
          chatCache.saveContacts(merged);
          return merged;
        });
        
        setHasMoreContacts(result.data.pageInfo.hasMore);
        setNextCursor(result.data.pageInfo.nextCursor);
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to load more contacts:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreContacts, nextCursor]);

  const loadContacts = useCallback(async () => {
    const hadCache = await loadFromCache();
    if (!hadCache) {
      setIsLoading(true);
    }
    await loadFromServer();
  }, [loadFromCache, loadFromServer]);

  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user, loadContacts]);

  const searchUser = useCallback(async (email: string) => {
    try {
      const result = await apiService.searchUserByEmail(email);
      if (result.success && result.data) {
        return {
          success: true,
          user: {
            id: result.data.id.toString(),
            visibleId: result.data.id,
            displayName: result.data.displayName,
            email: result.data.email,
            avatarColor: result.data.avatarColor,
          } as Contact,
        };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Search failed" };
    }
  }, []);

  const addContact = useCallback(
    async (contactUserId: number, tempContactData?: Partial<Contact>): Promise<{ success: boolean; error?: string }> => {
      const tempId = `temp_${Date.now()}`;
      const tempContact: Contact = {
        id: tempId,
        visibleId: contactUserId,
        displayName: tempContactData?.displayName || "...",
        email: tempContactData?.email || "",
        avatarColor: tempContactData?.avatarColor || "#3B82F6",
      };
      
      setContacts((prev) => {
        const updated = [...prev, tempContact];
        chatCache.saveContacts(updated);
        return updated;
      });

      try {
        const result = await apiService.addContact(contactUserId);
        if (result.success && result.data) {
          const newContact = apiService.serverContactToContact(result.data);
          setContacts((prev) => {
            const updated = prev.map(c => c.id === tempId ? newContact : c);
            chatCache.saveContacts(updated);
            return updated;
          });
          return { success: true };
        }
        setContacts((prev) => {
          const updated = prev.filter(c => c.id !== tempId);
          chatCache.saveContacts(updated);
          return updated;
        });
        return { success: false, error: result.error };
      } catch (error) {
        setContacts((prev) => {
          const updated = prev.filter(c => c.id !== tempId);
          chatCache.saveContacts(updated);
          return updated;
        });
        return { success: false, error: "Failed to add contact" };
      }
    },
    []
  );

  const deleteContact = useCallback(async (contactId: string) => {
    const numericId = parseInt(contactId, 10);
    if (isNaN(numericId)) return;

    let deletedContact: Contact | undefined;
    setContacts((prev) => {
      deletedContact = prev.find((c) => c.id === contactId);
      const updated = prev.filter((c) => c.id !== contactId);
      chatCache.saveContacts(updated);
      return updated;
    });

    try {
      const result = await apiService.deleteContact(numericId);
      if (!result.success && deletedContact) {
        setContacts((prev) => {
          const restored = [...prev, deletedContact!];
          chatCache.saveContacts(restored);
          return restored;
        });
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to delete contact:", error);
      if (deletedContact) {
        setContacts((prev) => {
          const restored = [...prev, deletedContact!];
          chatCache.saveContacts(restored);
          return restored;
        });
      }
    }
  }, []);

  return {
    contacts,
    isLoading,
    isLoadingMore,
    hasMoreContacts,
    searchUser,
    addContact,
    deleteContact,
    refreshContacts: loadContacts,
    loadMoreContacts,
  };
}

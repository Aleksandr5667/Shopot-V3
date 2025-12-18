import React, { useCallback, useLayoutEffect, useState, useEffect, useRef, useMemo } from "react";
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Alert, ActionSheetIOS, Pressable, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { HeaderButton } from "@react-navigation/elements";
import { ChatsStackParamList } from "@/navigation/types";
import { Message } from "@/store/types";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageInput } from "@/components/MessageInput";
import { MediaPicker } from "@/components/MediaPicker";
import { SystemMessage } from "@/components/SystemMessage";
import { Avatar } from "@/components/Avatar";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useChatsContext } from "@/contexts/ChatsContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useMessages, useOnlineStatus } from "@/hooks/useChats";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTranslation } from "react-i18next";
import { messageQueue } from "@/services/messageQueue";
import { notificationSoundService } from "@/services/notificationSound";
import { apiService } from "@/services/api";
import { welcomeChatService } from "@/services/welcomeChat";
import * as Clipboard from "expo-clipboard";
import { MessageActionSheet, ActionItem } from "@/components/MessageActionSheet";
import { SearchBar } from "@/components/SearchBar";

type Props = NativeStackScreenProps<ChatsStackParamList, "Chat">;

type DateSeparator = {
  type: "dateSeparator";
  id: string;
  date: string;
};

type ListItem = Message | DateSeparator;

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

export default function ChatScreen({ route, navigation }: Props) {
  const { chatId, participant, isGroup, groupName, groupAvatarUrl, memberCount, groupParticipants } = route.params;
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { markAsRead, setActiveChat, updateChatLastMessage } = useChatsContext();
  const { isOnline, checkUserOnline, refreshOnlineStatus } = useOnlineStatus();
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [isParticipantOnline, setIsParticipantOnline] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [dynamicGroupAvatarUrl, setDynamicGroupAvatarUrl] = useState<string | undefined>(groupAvatarUrl);
  const [dynamicMemberCount, setDynamicMemberCount] = useState<number>(memberCount || groupParticipants?.length || 0);
  
  const participantCount = isGroup ? dynamicMemberCount : 2;
  const { messages, sendMessage, editMessage, deleteMessage, hideMessageLocally, typingUsers, sendTypingIndicator, loadMoreMessages, isLoadingMore, hasMoreMessages, chatDeleted } = useMessages(chatId, updateChatLastMessage, participantCount);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [deletingMessageIds, setDeletingMessageIds] = useState<Set<string>>(new Set());
  const [deletingMessageOwnership, setDeletingMessageOwnership] = useState<Map<string, boolean>>(new Map());
  const flatListRef = useRef<FlatList<ListItem>>(null);
  const prevMessagesCountRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  const displayName = isGroup ? (groupName || "Group") : (participant?.displayName || "Chat");
  const avatarColor = isGroup ? "#10B981" : (participant?.avatarColor || "#0088CC");
  const avatarUrl = isGroup ? dynamicGroupAvatarUrl : participant?.avatarUrl;
  const isWelcomeChat = welcomeChatService.isWelcomeChat(chatId);

  useFocusEffect(
    useCallback(() => {
      if (isGroup) {
        const numericId = parseInt(chatId, 10);
        apiService.getGroupDetails(numericId).then((result) => {
          if (result.success && result.data?.chat?.avatarUrl) {
            setDynamicGroupAvatarUrl(result.data.chat.avatarUrl);
          }
        }).catch(() => {});
      }
    }, [isGroup, chatId])
  );
  const participantId = participant?.id ? parseInt(String(participant.id), 10) : undefined;
  
  useEffect(() => {
    setActiveChat(chatId);
    markAsRead(chatId);
    
    return () => {
      setActiveChat(null);
    };
  }, [chatId, markAsRead, setActiveChat]);

  useEffect(() => {
    if (chatDeleted) {
      navigation.goBack();
    }
  }, [chatDeleted, navigation]);
  
  useEffect(() => {
    if (participantId) {
      setIsParticipantOnline(checkUserOnline(participantId));
    }
  }, [participantId, checkUserOnline]);

  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (!participantId && !isGroup) return;
      
      if (event.type === "user_online" && event.userId === participantId) {
        setIsParticipantOnline(true);
      } else if (event.type === "user_offline" && event.userId === participantId) {
        setIsParticipantOnline(false);
      }
      
      if (isGroup) {
        if (event.type === "members_added" && event.chatId.toString() === chatId) {
          const addedCount = event.addedMembers?.length || 1;
          setDynamicMemberCount(prev => prev + addedCount);
        } else if (event.type === "member_removed" && event.chatId.toString() === chatId) {
          setDynamicMemberCount(prev => Math.max(1, prev - 1));
        } else if (event.type === "member_left" && event.chatId.toString() === chatId) {
          setDynamicMemberCount(prev => Math.max(1, prev - 1));
        }
      }
    });
    
    return unsubscribe;
  }, [participantId, isGroup, subscribe, chatId]);

  useFocusEffect(
    useCallback(() => {
      if (participantId && !isGroup) {
        refreshOnlineStatus();
        setIsParticipantOnline(checkUserOnline(participantId));
      }
    }, [participantId, isGroup, refreshOnlineStatus, checkUserOnline])
  );

  const participantOnline = participantId ? (isOnline(participantId) || isParticipantOnline) : false;

  const handleHeaderPress = useCallback(() => {
    if (isGroup) {
      navigation.navigate("GroupInfo", { chatId });
    } else if (participant) {
      navigation.navigate("UserProfile", { user: participant });
    }
  }, [navigation, participant, isGroup, chatId]);

  const toggleSearchMode = useCallback(() => {
    if (isSearchMode) {
      setIsSearchMode(false);
      setSearchQuery("");
      setSearchResults([]);
      setCurrentSearchIndex(0);
    } else {
      setIsSearchMode(true);
    }
  }, [isSearchMode]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const results = messages.filter(
      (m) => m.text && m.text.toLowerCase().includes(lowerQuery)
    );
    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    if (results.length > 0) {
      scrollToMessage(results[0].id);
    }
  }, [messages]);

  const goToPrevResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const newIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
    setCurrentSearchIndex(newIndex);
    scrollToMessage(searchResults[newIndex].id);
  }, [searchResults, currentSearchIndex]);

  const goToNextResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const newIndex = currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0;
    setCurrentSearchIndex(newIndex);
    scrollToMessage(searchResults[newIndex].id);
  }, [searchResults, currentSearchIndex]);

  const getTypingText = useCallback(() => {
    if (typingUsers.length === 0) return null;
    
    if (isGroup && groupParticipants) {
      const typingParticipant = groupParticipants.find(p => {
        const pId = typeof p.id === 'number' ? p.id : parseInt(String(p.id), 10);
        return typingUsers.includes(pId);
      });
      if (typingParticipant) {
        return `${typingParticipant.displayName} ${t("chats.isTyping")}`;
      }
    }
    
    return t("chats.typing");
  }, [typingUsers, isGroup, groupParticipants, t]);

  const typingText = getTypingText();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity 
          onPress={handleHeaderPress}
          activeOpacity={0.7}
          style={styles.headerTitle}
        >
          <Avatar
            name={displayName}
            color={avatarColor}
            avatarUrl={avatarUrl}
            size={32}
            isOnline={isGroup ? undefined : participantOnline}
          />
          <View style={styles.headerInfo}>
            <ThemedText style={styles.headerName} numberOfLines={1}>
              {displayName}
            </ThemedText>
            {typingText ? (
              <ThemedText style={[styles.headerSubtitle, { color: "#25D366" }]} numberOfLines={1}>
                {typingText}
              </ThemedText>
            ) : isGroup ? (
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                {dynamicMemberCount} {t("chat.members")}
              </ThemedText>
            ) : participantOnline ? (
              <ThemedText style={[styles.headerSubtitle, { color: "#25D366" }]} numberOfLines={1}>
                {t("chat.online")}
              </ThemedText>
            ) : participant?.email ? (
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                {participant.email}
              </ThemedText>
            ) : null}
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <HeaderButton onPress={toggleSearchMode}>
          <Feather name={isSearchMode ? "x" : "search"} size={24} color={theme.text} />
        </HeaderButton>
      ),
    });
  }, [navigation, participant, isGroup, groupParticipants, dynamicMemberCount, theme, displayName, avatarColor, avatarUrl, participantOnline, t, handleHeaderPress, typingText, isSearchMode, toggleSearchMode]);

  const shouldScrollRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    shouldScrollRef.current = true;
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (shouldScrollRef.current) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      shouldScrollRef.current = false;
    }
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const replyToId = replyingToMessage?.id;
      setReplyingToMessage(null);
      await sendMessage(text, undefined, undefined, undefined, replyToId);
      scrollToBottom();
    },
    [sendMessage, replyingToMessage, scrollToBottom]
  );

  const handleMediaSelected = useCallback(
    async (uri: string, type: "photo" | "video") => {
      const replyToId = replyingToMessage?.id;
      setReplyingToMessage(null);
      await sendMessage(undefined, type, uri, undefined, replyToId);
      scrollToBottom();
    },
    [sendMessage, replyingToMessage, scrollToBottom]
  );

  const handleVoiceMessage = useCallback(
    async (uri: string, duration: number) => {
      const replyToId = replyingToMessage?.id;
      setReplyingToMessage(null);
      await sendMessage(undefined, "audio", uri, duration, replyToId);
      scrollToBottom();
    },
    [sendMessage, replyingToMessage, scrollToBottom]
  );

  const handleReply = useCallback((message: Message) => {
    setReplyingToMessage(message);
  }, []);

  useEffect(() => {
    if (isLoadingMoreRef.current) {
      isLoadingMoreRef.current = false;
      prevMessagesCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMessagesCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.senderId === user?.id) {
        shouldScrollRef.current = true;
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, user?.id]);

  useEffect(() => {
    if (isLoadingMore) {
      isLoadingMoreRef.current = true;
    }
  }, [isLoadingMore]);

  const listItems = useMemo((): ListItem[] => {
    const seen = new Set<string>();
    const unique = messages.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    const sorted = [...unique].reverse();
    
    const items: ListItem[] = [];
    let lastDate: Date | null = null;
    
    for (let i = sorted.length - 1; i >= 0; i--) {
      const msg = sorted[i];
      const msgDate = new Date(msg.timestamp);
      
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        items.unshift({
          type: "dateSeparator",
          id: `date_${msgDate.toDateString()}`,
          date: msg.timestamp,
        });
        lastDate = msgDate;
      }
      items.unshift(msg);
    }
    
    return items;
  }, [messages]);

  const scrollToMessage = useCallback((messageId: string) => {
    const index = listItems.findIndex(item => 
      item.type !== "dateSeparator" && item.id === messageId
    );
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 1500);
    }
  }, [listItems]);

  const cancelReply = useCallback(() => {
    setReplyingToMessage(null);
  }, []);

  const handleMediaPress = useCallback(
    (message: Message) => {
      const mediaSource = message.mediaUri || message.mediaUrl;
      let mediaType: "photo" | "video" | null = null;
      
      if (message.mediaType === "photo" || message.type === "image") {
        mediaType = "photo";
      } else if (message.mediaType === "video" || message.type === "video") {
        mediaType = "video";
      }
      
      if (mediaSource && mediaType) {
        navigation.navigate("MediaViewer", {
          uri: mediaSource,
          type: mediaType,
        });
      }
    },
    [navigation]
  );

  const handleCopyMessage = useCallback(async (message: Message) => {
    const textToCopy = message.text || "";
    if (textToCopy) {
      await Clipboard.setStringAsync(textToCopy);
    }
  }, []);

  const handleForwardMessage = useCallback((message: Message) => {
    const messageType = message.type || "text";
    const validTypes = ["text", "image", "video", "voice"];
    if (!validTypes.includes(messageType)) {
      return;
    }
    navigation.navigate("ForwardMessage", {
      messageContent: message.text || "",
      messageType: messageType as "text" | "image" | "video" | "voice",
      mediaUrl: message.mediaUrl,
      mediaUri: message.mediaUri,
      audioDuration: message.audioDuration,
    });
  }, [navigation]);

  const handleMessageLongPress = useCallback(
    (message: Message) => {
      if (message.type === "system") return;
      setSelectedMessage(message);
      setActionSheetVisible(true);
    },
    []
  );

  const closeActionSheet = useCallback(() => {
    setActionSheetVisible(false);
    setSelectedMessage(null);
  }, []);

  const startDeleteAnimation = useCallback((messageId: string, isOwnMessage: boolean) => {
    notificationSoundService.playDeleteSound();
    setDeletingMessageIds(prev => new Set(prev).add(messageId));
    setDeletingMessageOwnership(prev => new Map(prev).set(messageId, isOwnMessage));
  }, []);

  const handleDeleteAnimationComplete = useCallback((messageId: string) => {
    const isOwnMessage = deletingMessageOwnership.get(messageId);
    setDeletingMessageIds(prev => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    setDeletingMessageOwnership(prev => {
      const next = new Map(prev);
      next.delete(messageId);
      return next;
    });
    if (isOwnMessage) {
      deleteMessage(messageId);
    } else {
      hideMessageLocally(messageId);
    }
  }, [deleteMessage, hideMessageLocally, deletingMessageOwnership]);

  const showDeleteConfirm = useCallback((messageId: string, isOwnMessage: boolean) => {
    if (Platform.OS === "web") {
      if (window.confirm(`${t("chat.deleteMessage")}\n\n${t("chat.deleteConfirm")}`)) {
        startDeleteAnimation(messageId, isOwnMessage);
      }
    } else {
      Alert.alert(
        t("chat.deleteMessage"),
        t("chat.deleteConfirm"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("chat.delete"),
            style: "destructive",
            onPress: () => startDeleteAnimation(messageId, isOwnMessage),
          },
        ]
      );
    }
  }, [startDeleteAnimation, t]);

  const getActionItems = useCallback((): ActionItem[] => {
    if (!selectedMessage) return [];
    const message = selectedMessage;
    const isOwnMessage = message.senderId === user?.id;
    const isTextMessage = message.type === "text" || message.type === undefined;
    const canEdit = isOwnMessage && isTextMessage;
    const canCopy = isTextMessage && message.text;
    
    const actions: ActionItem[] = [];
    
    if (isWelcomeChat) {
      if (canCopy) {
        actions.push({
          id: "copy",
          label: t("chat.copy"),
          icon: "copy",
          onPress: () => handleCopyMessage(message),
        });
      }
      return actions;
    }
    
    if (canCopy) {
      actions.push({
        id: "copy",
        label: t("chat.copy"),
        icon: "copy",
        onPress: () => handleCopyMessage(message),
      });
    }
    
    actions.push({
      id: "reply",
      label: t("chat.reply"),
      icon: "corner-up-left",
      onPress: () => setReplyingToMessage(message),
    });
    
    actions.push({
      id: "forward",
      label: t("chat.forward"),
      icon: "share",
      onPress: () => handleForwardMessage(message),
    });
    
    if (canEdit) {
      actions.push({
        id: "edit",
        label: t("chat.edit"),
        icon: "edit-2",
        onPress: () => {
          setEditingMessage(message);
          setEditText(message.text || "");
        },
      });
    }
    
    actions.push({
      id: "delete",
      label: t("chat.delete"),
      icon: "trash-2",
      onPress: () => showDeleteConfirm(message.id, isOwnMessage),
      destructive: true,
    });
    
    return actions;
  }, [selectedMessage, user?.id, t, handleCopyMessage, handleForwardMessage, showDeleteConfirm, isWelcomeChat]);

  const handleSaveEdit = useCallback(() => {
    if (editingMessage && editText.trim()) {
      const messageId = editingMessage.id;
      const newText = editText.trim();
      setEditingMessage(null);
      setEditText("");
      editMessage(messageId, newText);
    } else {
      setEditingMessage(null);
      setEditText("");
    }
  }, [editingMessage, editText, editMessage]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setEditText("");
  }, []);

  const handleEditMessage = useCallback(
    (message: Message) => {
      setEditingMessage(message);
      setEditText(message.text || "");
    },
    []
  );

  const handleDeleteMessage = useCallback(
    (message: Message) => {
      if (Platform.OS === "web") {
        if (window.confirm(`${t("chat.deleteMessage")}\n\n${t("chat.deleteConfirm")}`)) {
          deleteMessage(message.id);
        }
      } else {
        Alert.alert(
          t("chat.deleteMessage"),
          t("chat.deleteConfirm"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("chat.delete"),
              style: "destructive",
              onPress: () => deleteMessage(message.id),
            },
          ]
        );
      }
    },
    [deleteMessage, t]
  );

  const handleRetryMessage = useCallback(
    async (message: Message) => {
      await messageQueue.retryFailed(message.id);
    },
    []
  );

  const renderDateSeparatorComponent = useCallback(
    (timestamp: string) => {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      let label: string;
      if (isToday) {
        label = t("common.today");
      } else if (isYesterday) {
        label = t("common.yesterday");
      } else {
        label = date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
      }

      return (
        <View style={styles.dateSeparator}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {label}
          </ThemedText>
        </View>
      );
    },
    [theme.textSecondary, t]
  );

  const renderListItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === "dateSeparator") {
        return renderDateSeparatorComponent(item.date);
      }
      
      if (item.type === "system") {
        return <SystemMessage message={item} />;
      }
      return (
        <MessageBubble
          message={item}
          isOwn={item.senderId === user?.id}
          isGroup={isGroup}
          onMediaPress={() => handleMediaPress(item)}
          onLongPress={() => handleMessageLongPress(item)}
          onRetry={() => handleRetryMessage(item)}
          onQuotedMessagePress={item.replyToId ? () => scrollToMessage(item.replyToId!) : undefined}
          isHighlighted={item.id === highlightedMessageId}
          isDeleting={deletingMessageIds.has(item.id)}
          onDeleteAnimationComplete={() => handleDeleteAnimationComplete(item.id)}
        />
      );
    },
    [user?.id, isGroup, handleMediaPress, handleMessageLongPress, handleRetryMessage, scrollToMessage, highlightedMessageId, renderDateSeparatorComponent, deletingMessageIds, handleDeleteAnimationComplete]
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 24}
    >
      {isSearchMode ? (
        <View style={[styles.searchPanel, { backgroundColor: theme.backgroundSecondary, borderBottomColor: theme.inputBorder }]}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder={t("chat.searchMessages")}
            autoFocus
          />
          {searchResults.length > 0 ? (
            <View style={styles.searchNavigation}>
              <ThemedText style={[styles.searchCount, { color: theme.textSecondary }]}>
                {t("chat.messagesFound", { count: searchResults.length })}
              </ThemedText>
              <Pressable onPress={goToPrevResult} style={styles.searchNavButton}>
                <Feather name="chevron-up" size={20} color={theme.primary} />
              </Pressable>
              <Pressable onPress={goToNextResult} style={styles.searchNavButton}>
                <Feather name="chevron-down" size={20} color={theme.primary} />
              </Pressable>
            </View>
          ) : searchQuery.length >= 2 ? (
            <ThemedText style={[styles.noResults, { color: theme.textSecondary }]}>
              {t("chat.noMessagesFound")}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      <FlatList
        ref={flatListRef}
        data={listItems}
        renderItem={renderListItem}
        keyExtractor={(item) => item.type === "dateSeparator" ? item.id : ((item as Message).tempId || item.id)}
        inverted
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={handleContentSizeChange}
        onEndReached={hasMoreMessages ? loadMoreMessages : undefined}
        onEndReachedThreshold={0.3}
        ListFooterComponent={isLoadingMore ? (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : null}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
              viewPosition: 0.5,
            });
          }, 100);
        }}
      />

      {!isWelcomeChat && replyingToMessage ? (
        <View style={[styles.replyPanel, { backgroundColor: theme.backgroundSecondary, borderTopColor: theme.inputBorder }]}>
          <View style={[styles.replyIndicator, { backgroundColor: theme.primary }]} />
          <View style={styles.replyContent}>
            <ThemedText style={[styles.replyName, { color: theme.primary }]} numberOfLines={1}>
              {replyingToMessage.senderId === user?.id?.toString() ? t("chat.you") : (participant?.displayName || t("chat.message"))}
            </ThemedText>
            <ThemedText style={[styles.replyText, { color: theme.textSecondary }]} numberOfLines={1}>
              {replyingToMessage.type === "image" ? t("chat.photo") : 
               replyingToMessage.type === "video" ? t("chat.video") :
               replyingToMessage.type === "voice" ? t("chat.voiceMessage") :
               replyingToMessage.text || ""}
            </ThemedText>
          </View>
          <Pressable style={styles.replyCancelButton} onPress={cancelReply} hitSlop={10}>
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      {!isWelcomeChat ? (
        <MessageInput
          onSend={handleSend}
          onAttachPress={() => setShowMediaPicker(true)}
          onVoiceMessage={handleVoiceMessage}
          onTyping={sendTypingIndicator}
          editingMessage={editingMessage}
          editText={editText}
          onEditTextChange={setEditText}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={handleSaveEdit}
        />
      ) : null}

      <MediaPicker
        visible={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onMediaSelected={handleMediaSelected}
      />

      <MessageActionSheet
        visible={actionSheetVisible}
        onClose={closeActionSheet}
        actions={getActionItems()}
        cancelLabel={t("common.cancel")}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerInfo: {
    marginLeft: Spacing.sm,
    flex: 1,
    maxWidth: 200,
  },
  headerName: {
    fontWeight: "600",
    fontSize: 17,
  },
  headerSubtitle: {
    fontSize: 12,
  },
  messagesList: {
    paddingVertical: Spacing.md,
  },
  dateSeparator: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  replyPanel: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
  },
  replyIndicator: {
    width: 3,
    height: 36,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  replyContent: {
    flex: 1,
    justifyContent: "center",
  },
  replyName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
  },
  replyCancelButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  loadingMore: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  searchPanel: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  searchNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  searchCount: {
    fontSize: 13,
    marginRight: Spacing.sm,
  },
  searchNavButton: {
    padding: Spacing.xs,
  },
  noResults: {
    fontSize: 13,
    marginTop: Spacing.xs,
    textAlign: "center",
    paddingHorizontal: Spacing.md,
  },
});

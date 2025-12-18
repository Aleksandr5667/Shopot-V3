import React, { useCallback, useState, useMemo } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAndroidBottomInset } from "@/hooks/useScreenInsets";
import { useNavigation, DrawerActions, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform } from "react-native";
import { ChatsStackParamList } from "@/navigation/types";
import { Chat } from "@/store/types";
import { ChatListItem } from "@/components/ChatListItem";
import { ThemedText } from "@/components/ThemedText";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { useTheme } from "@/hooks/useTheme";
import { useChatsContext } from "@/contexts/ChatsContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useContacts, useCreateChat, useOnlineStatus } from "@/hooks/useChats";
import { useSearch, SearchResult } from "@/hooks/useSearch";
import { Spacing } from "@/constants/theme";

type NavigationProp = NativeStackNavigationProp<ChatsStackParamList, "ChatsList">;

export default function ChatsListScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { chats, isLoading, isLoadingMore, hasMoreChats, refreshChats, markAsRead, deleteChat, loadMoreChats } = useChatsContext();
  const { contacts } = useContacts();
  const { createChat } = useCreateChat();
  const { query, results, isSearching, search, clearSearch } = useSearch();
  const { isOnline, refreshOnlineStatus, onlineUsers } = useOnlineStatus();
  const { onlineUsers: wsOnlineUsers } = useWebSocket();
  const [isSearchMode, setIsSearchMode] = useState(false);

  const combinedOnlineKey = useMemo(() => {
    const wsArray = Array.from(wsOnlineUsers);
    return `${onlineUsers.join(',')}_${wsArray.join(',')}`;
  }, [onlineUsers, wsOnlineUsers]);

  useFocusEffect(
    useCallback(() => {
      refreshOnlineStatus();
    }, [refreshOnlineStatus])
  );

  const handleChatPress = useCallback(
    (chat: Chat) => {
      markAsRead(chat.id);
      const isGroup = chat.type === 'group';
      navigation.navigate("Chat", { 
        chatId: chat.id,
        participant: isGroup ? undefined : (chat.participant || { id: "", displayName: "Unknown", avatarColor: "#0088CC" }),
        isGroup,
        groupName: isGroup ? (chat.name || "Group") : undefined,
        groupAvatarUrl: isGroup ? chat.avatarUrl : undefined,
        memberCount: isGroup ? (chat.memberCount || chat.participantIds?.length || 0) : undefined,
        groupParticipants: chat.participants,
      });
    },
    [navigation, markAsRead]
  );

  const openDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const handleSearchResultPress = useCallback(
    async (result: SearchResult) => {
      console.log("[Search] Result pressed:", result.type, result.user?.visibleId || result.contact?.visibleId);
      
      const navigateToChat = (chat: Chat) => {
        console.log("[Search] Navigating to chat:", chat.id);
        setIsSearchMode(false);
        clearSearch();
        markAsRead(chat.id);
        const isGroupChat = chat.type === 'group';
        navigation.navigate("Chat", { 
          chatId: chat.id,
          participant: isGroupChat ? undefined : (chat.participant || { id: "", displayName: "Unknown", avatarColor: "#0088CC" }),
          isGroup: isGroupChat,
          groupName: isGroupChat ? (chat.name || "Group") : undefined,
          groupAvatarUrl: isGroupChat ? chat.avatarUrl : undefined,
          memberCount: isGroupChat ? (chat.memberCount || chat.participantIds?.length || 0) : undefined,
          groupParticipants: chat.participants,
        });
      };
      
      if (result.type === "chat" && result.chat) {
        navigateToChat(result.chat);
      } else if (result.type === "contact" && result.contact) {
        const foundContact = result.contact;
        const contactVisibleId = typeof foundContact.visibleId === 'string' 
          ? parseInt(foundContact.visibleId, 10) 
          : foundContact.visibleId;
        const existingChat = chats.find(
          (c) => c.type === 'private' && c.participant?.visibleId === contactVisibleId
        );
        if (existingChat) {
          navigateToChat(existingChat);
        } else if (contactVisibleId) {
          console.log("[Search] Creating chat for contact:", contactVisibleId);
          const newChat = await createChat([contactVisibleId]);
          console.log("[Search] Created chat:", newChat?.id);
          if (newChat) {
            refreshChats();
            setIsSearchMode(false);
            clearSearch();
            markAsRead(newChat.id);
            navigation.navigate("Chat", { 
              chatId: newChat.id,
              participant: {
                id: foundContact.id,
                visibleId: contactVisibleId,
                displayName: foundContact.displayName || foundContact.email || "Contact",
                email: foundContact.email,
                avatarColor: foundContact.avatarColor || "#0088CC",
                avatarUrl: foundContact.avatarUrl,
              },
              isGroup: false,
            });
          }
        }
      } else if (result.type === "user" && result.user) {
        const foundUser = result.user;
        const userVisibleId = typeof foundUser.visibleId === 'string' 
          ? parseInt(foundUser.visibleId, 10) 
          : foundUser.visibleId;
        console.log("[Search] User result, visibleId:", userVisibleId);
        const existingChat = chats.find(
          (c) => c.type === 'private' && c.participant?.visibleId === userVisibleId
        );
        if (existingChat) {
          console.log("[Search] Found existing private chat:", existingChat.id);
          navigateToChat(existingChat);
        } else if (userVisibleId) {
          console.log("[Search] Creating new chat for user:", userVisibleId);
          const newChat = await createChat([userVisibleId]);
          console.log("[Search] Created chat result:", newChat?.id);
          if (newChat) {
            refreshChats();
            setIsSearchMode(false);
            clearSearch();
            markAsRead(newChat.id);
            navigation.navigate("Chat", { 
              chatId: newChat.id,
              participant: {
                id: foundUser.id,
                visibleId: userVisibleId,
                displayName: foundUser.displayName || foundUser.email || "User",
                email: foundUser.email,
                avatarColor: foundUser.avatarColor || "#0088CC",
                avatarUrl: foundUser.avatarUrl,
              },
              isGroup: false,
            });
          } else {
            console.log("[Search] Failed to create chat");
            setIsSearchMode(false);
            clearSearch();
          }
        }
      }
    },
    [navigation, markAsRead, chats, clearSearch, createChat, refreshChats]
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      search(text, chats, contacts);
    },
    [search, chats, contacts]
  );

  const toggleSearch = useCallback(() => {
    if (isSearchMode) {
      setIsSearchMode(false);
      clearSearch();
    } else {
      setIsSearchMode(true);
    }
  }, [isSearchMode, clearSearch]);

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      await deleteChat(chatId);
    },
    [deleteChat]
  );

  const renderItem = useCallback(
    ({ item }: { item: Chat }) => {
      const isGroupChat = item.type === "group";
      const participantId = item.participant?.visibleId ? Number(item.participant.visibleId) : null;
      const isOnlineFromApi = participantId ? isOnline(participantId) : false;
      const isOnlineFromWs = participantId ? wsOnlineUsers.has(participantId) : false;
      const participantOnline = !isGroupChat && (isOnlineFromApi || isOnlineFromWs);
      
      return (
        <ChatListItem 
          chat={item} 
          onPress={() => handleChatPress(item)} 
          onDelete={handleDeleteChat}
          isOnline={participantOnline}
        />
      );
    },
    [handleChatPress, handleDeleteChat, isOnline, wsOnlineUsers, onlineUsers]
  );


  const HeaderBackground = Platform.OS === "ios" ? (
    <BlurView
      intensity={100}
      tint={isDark ? "dark" : "light"}
      style={StyleSheet.absoluteFill}
    />
  ) : (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundRoot }]} />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {HeaderBackground}
        <View style={styles.headerContent}>
          <Pressable
            onPress={openDrawer}
            style={({ pressed }) => [
              styles.headerButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Feather name="align-left" size={24} color={theme.text} />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <ThemedText type="h4" style={styles.headerTitle}>
              {t("chats.title")}
            </ThemedText>
          </View>

          <Pressable
            onPress={toggleSearch}
            style={({ pressed }) => [
              styles.headerButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Feather name={isSearchMode ? "x" : "search"} size={24} color={theme.text} />
          </Pressable>
        </View>
        {isSearchMode ? (
          <SearchBar
            value={query}
            onChangeText={handleSearchChange}
            placeholder={t("chats.search")}
            autoFocus
          />
        ) : null}
      </View>

      {isSearchMode && query.length >= 2 ? (
        <View
          style={[
            styles.searchResultsContainer,
            { paddingTop: insets.top + (isSearchMode ? 100 : 56) },
          ]}
        >
          <SearchResults
            results={results}
            onResultPress={handleSearchResultPress}
            isSearching={isSearching}
          />
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          extraData={combinedOnlineKey}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: insets.top + (isSearchMode ? 100 : 56),
              paddingBottom: getAndroidBottomInset(insets.bottom) + Spacing.xl + 70,
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshChats}
              tintColor={theme.primary}
              progressViewOffset={insets.top + 56}
            />
          }
          onEndReached={hasMoreChats ? loadMoreChats : undefined}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: Spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontWeight: "700",
  },
  listContent: {
    flexGrow: 1,
  },
  searchResultsContainer: {
    flex: 1,
  },
  loadingMore: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
});

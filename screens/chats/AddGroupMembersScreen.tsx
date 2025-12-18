import React, { useState, useCallback, useLayoutEffect, useMemo, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAndroidBottomInset } from "@/hooks/useScreenInsets";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useContacts } from "@/hooks/useChats";
import { useChatsContext } from "@/contexts/ChatsContext";
import { apiService } from "@/services/api";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";
import { ChatsStackParamList } from "@/navigation/types";
import { Contact } from "@/store/types";
import { welcomeChatService } from "@/services/welcomeChat";

type NavigationProp = NativeStackNavigationProp<ChatsStackParamList, "AddGroupMembers">;
type AddMembersRouteProp = RouteProp<ChatsStackParamList, "AddGroupMembers">;

interface SearchUser {
  id: string;
  visibleId: number;
  displayName: string;
  email?: string;
  avatarColor: string;
  isFromSearch?: boolean;
}

export function AddGroupMembersScreen() {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<AddMembersRouteProp>();
  const insets = useSafeAreaInsets();
  const { contacts, isLoading: isLoadingContacts, isLoadingMore, hasMoreContacts, loadMoreContacts } = useContacts();
  const { chats } = useChatsContext();
  const { chatId, existingMemberIds } = route.params;

  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t("group.addMembers"),
    });
  }, [navigation, t]);

  const availableContacts = useMemo((): SearchUser[] => {
    const combined: SearchUser[] = [];
    const seenIds = new Set<number>();

    chats.forEach((chat) => {
      if (welcomeChatService.isWelcomeChat(chat.id)) return;
      if (!chat.isGroup && chat.participant) {
        const visibleId = chat.participant.visibleId || parseInt(chat.participant.id, 10);
        if (!seenIds.has(visibleId) && !existingMemberIds.includes(visibleId)) {
          seenIds.add(visibleId);
          combined.push({
            id: chat.participant.id,
            visibleId,
            displayName: chat.participant.displayName,
            email: chat.participant.email,
            avatarColor: chat.participant.avatarColor,
            isFromSearch: false,
          });
        }
      }
    });

    contacts.forEach((c) => {
      const visibleId = c.visibleId || parseInt(c.id, 10);
      if (!seenIds.has(visibleId) && !existingMemberIds.includes(visibleId)) {
        seenIds.add(visibleId);
        combined.push({
          id: c.id,
          visibleId,
          displayName: c.displayName,
          email: c.email,
          avatarColor: c.avatarColor,
          isFromSearch: false,
        });
      }
    });

    return combined;
  }, [chats, contacts, existingMemberIds]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await apiService.searchUserByEmail(searchTerm.trim());
        if (result.success && result.data) {
          const user = result.data;
          const userId = typeof user.id === "number" ? user.id : parseInt(user.id, 10);
          
          if (!existingMemberIds.includes(userId)) {
            setSearchResults([
              {
                id: String(userId),
                visibleId: userId,
                displayName: user.displayName || user.email || "User",
                email: user.email,
                avatarColor: user.avatarColor || "#6366F1",
                isFromSearch: true,
              },
            ]);
          } else {
            setSearchResults([]);
          }
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, existingMemberIds]);

  const displayList = useMemo((): SearchUser[] => {
    if (searchTerm.trim().length >= 2) {
      const contactMatches = availableContacts.filter(
        (c) =>
          c.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const contactIds = new Set(contactMatches.map((c) => c.id));

      const filteredSearchResults = searchResults.filter(
        (u) => !contactIds.has(u.id)
      );

      return [...contactMatches, ...filteredSearchResults];
    }
    return availableContacts;
  }, [searchTerm, availableContacts, searchResults]);

  const toggleUser = useCallback((user: SearchUser) => {
    setSelectedUsers((prev) => {
      const isSelected = prev.some((u) => u.id === user.id);
      if (isSelected) {
        return prev.filter((u) => u.id !== user.id);
      }
      return [...prev, user];
    });
  }, []);

  const isUserSelected = useCallback(
    (userId: string) => selectedUsers.some((u) => u.id === userId),
    [selectedUsers]
  );

  const handleAddMembers = useCallback(async () => {
    if (selectedUsers.length === 0 || isAdding) return;

    setIsAdding(true);
    try {
      const numericChatId = parseInt(chatId, 10);
      const userIds = selectedUsers.map((u) => u.visibleId);
      const result = await apiService.addGroupMembers(numericChatId, userIds);

      if (result.success) {
        navigation.goBack();
      } else {
        Alert.alert(t("common.error"), result.error || t("errors.somethingWentWrong"));
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
    } finally {
      setIsAdding(false);
    }
  }, [selectedUsers, chatId, navigation, t, isAdding]);

  const gradientColors = isDark
    ? [theme.primary + "40", theme.primary + "20", "transparent"] as const
    : [theme.primary + "25", theme.primary + "10", "transparent"] as const;

  const renderBlurBackground = () => {
    if (Platform.OS === "ios") {
      return (
        <BlurView
          intensity={isDark ? 15 : 30}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      );
    }
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? "rgba(30,32,34,0.97)" : "rgba(255,255,255,0.95)" },
        ]}
      />
    );
  };

  const cardStyle = isDark ? CardStyles.dark : CardStyles.light;

  const renderUser = ({ item }: { item: SearchUser }) => {
    const selected = isUserSelected(item.id);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.contactItem,
          { backgroundColor: selected ? `${theme.primary}15` : "transparent" },
          pressed ? { opacity: 0.7 } : {},
        ]}
        onPress={() => toggleUser(item)}
      >
        <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
          <ThemedText style={styles.avatarText}>
            {item.displayName?.charAt(0)?.toUpperCase() ?? "?"}
          </ThemedText>
        </View>
        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <ThemedText type="body" style={{ color: theme.text }}>
              {item.displayName}
            </ThemedText>
            {item.isFromSearch ? (
              <View style={[styles.searchBadge, { backgroundColor: theme.primary }]}>
                <Feather name="globe" size={10} color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          {item.email ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {item.email}
            </ThemedText>
          ) : null}
        </View>
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: selected ? theme.primary : "transparent",
              borderColor: selected ? theme.primary : theme.inputBorder,
            },
          ]}
        >
          {selected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
        </View>
      </Pressable>
    );
  };

  if (isLoadingContacts) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.headerGradient}
        />

        <View style={[styles.searchCard, cardStyle]}>
          {renderBlurBackground()}
          <View style={styles.searchContent}>
            <View style={[styles.searchIconContainer, { backgroundColor: theme.primary + "18" }]}>
              <Feather name="search" size={18} color={theme.primary} />
            </View>
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={t("search.searchByEmail")}
              placeholderTextColor={theme.textSecondary}
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            {searchTerm.length > 0 ? (
              <Pressable
                onPress={() => setSearchTerm("")}
                style={({ pressed }) => [pressed ? { opacity: 0.7 } : {}]}
              >
                <Feather name="x-circle" size={20} color={theme.textSecondary} />
              </Pressable>
            ) : null}
            {isSearching ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : null}
          </View>
        </View>

        {selectedUsers.length > 0 ? (
          <View style={styles.selectedSection}>
            <ThemedText
              type="caption"
              style={[styles.sectionLabel, { color: theme.textSecondary }]}
            >
              {t("chats.selectedParticipants", { count: selectedUsers.length })}
            </ThemedText>
            <View style={[styles.selectedCard, cardStyle]}>
              {renderBlurBackground()}
              <View style={styles.selectedContent}>
                {selectedUsers.slice(0, 6).map((user) => (
                  <Pressable
                    key={user.id}
                    style={({ pressed }) => [
                      styles.miniAvatar,
                      { backgroundColor: user.avatarColor },
                      pressed ? { opacity: 0.7 } : {},
                    ]}
                    onPress={() => toggleUser(user)}
                  >
                    <ThemedText style={styles.miniAvatarText}>
                      {user.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                    </ThemedText>
                    <View style={[styles.removeIcon, { backgroundColor: theme.accent }]}>
                      <Feather name="x" size={10} color="#FFFFFF" />
                    </View>
                  </Pressable>
                ))}
                {selectedUsers.length > 6 ? (
                  <View style={[styles.miniAvatar, { backgroundColor: theme.backgroundTertiary }]}>
                    <ThemedText style={[styles.miniAvatarText, { color: theme.text }]}>
                      +{selectedUsers.length - 6}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.contactsSection}>
        <ThemedText
          type="caption"
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          {(searchTerm.trim().length >= 2
            ? t("search.results")
            : t("group.selectMembers")).toUpperCase()}
        </ThemedText>

        <View style={[styles.contactsCard, cardStyle]}>
          {renderBlurBackground()}
          <FlatList
            data={displayList}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            contentContainerStyle={[styles.list, { paddingBottom: getAndroidBottomInset(insets.bottom) + Spacing.xl + 70 }]}
            ItemSeparatorComponent={() => (
              <View style={[styles.divider, { backgroundColor: theme.divider, marginLeft: Spacing.lg + 40 + Spacing.md }]} />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="users" size={48} color={theme.textSecondary} style={{ opacity: 0.5 }} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                  {searchTerm.trim().length >= 2
                    ? t("search.noResults")
                    : t("group.noMoreContacts")}
                </ThemedText>
              </View>
            }
            onEndReached={searchTerm.trim().length < 2 && hasMoreContacts ? loadMoreContacts : undefined}
            onEndReachedThreshold={0.3}
            ListFooterComponent={isLoadingMore && searchTerm.trim().length < 2 ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : null}
          />
        </View>
      </View>

      {selectedUsers.length > 0 ? (
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            { 
              backgroundColor: isAdding ? theme.textSecondary : theme.primary,
              bottom: getAndroidBottomInset(insets.bottom) + Spacing.lg,
            },
            pressed ? { opacity: 0.8 } : {},
          ]}
          onPress={handleAddMembers}
          disabled={isAdding}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="check" size={24} color="#FFFFFF" />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  headerWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  headerGradient: {
    position: "absolute",
    top: -60,
    left: 0,
    right: 0,
    height: 180,
  },
  searchCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  searchContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  searchIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  selectedSection: {
    marginTop: Spacing.lg,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: "uppercase",
    fontWeight: "600",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  selectedCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  selectedContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  miniAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  miniAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  removeIcon: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  contactsSection: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  contactsCard: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  list: {
    paddingBottom: Spacing["2xl"],
    flexGrow: 1,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 56,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  contactInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  searchBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  addButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
    elevation: 3,
  },
  loadingMore: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
});

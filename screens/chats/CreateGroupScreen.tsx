import React, { useState, useCallback, useLayoutEffect, useMemo } from "react";
import { View, StyleSheet, Pressable, FlatList, TextInput, ActivityIndicator, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAndroidBottomInset } from "@/hooks/useScreenInsets";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useContacts } from "@/hooks/useChats";
import { useChatsContext } from "@/contexts/ChatsContext";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";
import { ChatsStackParamList } from "@/navigation/types";
import { Contact } from "@/store/types";
import { welcomeChatService } from "@/services/welcomeChat";

type NavigationProp = NativeStackNavigationProp<ChatsStackParamList, "CreateGroup">;

export function CreateGroupScreen() {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { contacts, isLoading, isLoadingMore, hasMoreContacts, searchUser, loadMoreContacts } = useContacts();
  const { chats, createGroupChat } = useChatsContext();
  const [groupName, setGroupName] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Contact[]>([]);

  const canCreate = groupName.trim().length > 0 && selectedContacts.length >= 1;

  const createGroup = useCallback(async () => {
    if (!groupName.trim() || selectedContacts.length < 1 || isCreating) return;

    setIsCreating(true);
    try {
      const participantIds = selectedContacts.map((c) => c.visibleId || parseInt(c.id, 10));
      const newChat = await createGroupChat(groupName.trim(), participantIds);

      if (newChat) {
        const finalGroupName = newChat.groupName || groupName.trim();
        navigation.replace("Chat", {
          chatId: newChat.id,
          participant: {
            id: newChat.id,
            displayName: finalGroupName,
            avatarColor: newChat.groupAvatarColor || newChat.avatarColor || "#0088CC",
          },
          isGroup: true,
          groupName: finalGroupName,
          groupAvatarUrl: newChat.avatarUrl,
          memberCount: selectedContacts.length + 1,
          groupParticipants: selectedContacts,
        });
      } else {
        Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
    } finally {
      setIsCreating(false);
    }
  }, [groupName, selectedContacts, createGroupChat, navigation, t, isCreating]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("chats.createGroup"),
      headerRight: () => (
        <Pressable
          onPress={createGroup}
          disabled={!canCreate || isCreating}
          style={({ pressed }) => [
            {
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: canCreate ? theme.primary : theme.divider,
              justifyContent: "center",
              alignItems: "center",
              marginRight: Spacing.sm,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather 
              name="check" 
              size={20} 
              color={canCreate ? "#FFFFFF" : theme.textSecondary} 
            />
          )}
        </Pressable>
      ),
    });
  }, [navigation, t, canCreate, isCreating, createGroup, theme]);

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || query.length < 3) return;

    setIsSearching(true);
    setSearchResults([]);

    const result = await searchUser(query);
    
    setIsSearching(false);

    if (result.success && result.user) {
      const alreadySelected = selectedContacts.some(
        (c) => c.visibleId === result.user?.visibleId || c.id === result.user?.id
      );
      if (!alreadySelected) {
        setSearchResults([result.user]);
      } else {
        setSearchResults([]);
      }
    }
  }, [searchQuery, searchUser, selectedContacts]);

  const toggleContact = useCallback((contact: Contact) => {
    setSelectedContacts((prev) => {
      const isSelected = prev.some((c) => c.id === contact.id || c.visibleId === contact.visibleId);
      if (isSelected) {
        return prev.filter((c) => c.id !== contact.id && c.visibleId !== contact.visibleId);
      }
      return [...prev, contact];
    });
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const isContactSelected = useCallback(
    (contact: Contact) => selectedContacts.some(
      (c) => c.id === contact.id || (c.visibleId && c.visibleId === contact.visibleId)
    ),
    [selectedContacts]
  );

  const allContacts = useMemo(() => {
    const combined: Contact[] = [];
    const seenIds = new Set<string>();

    chats.forEach((chat) => {
      if (welcomeChatService.isWelcomeChat(chat.id)) return;
      if (!chat.isGroup && chat.participant) {
        const id = chat.participant.visibleId?.toString() || chat.participant.id;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          combined.push(chat.participant);
        }
      }
    });

    contacts.forEach((c) => {
      const id = c.visibleId?.toString() || c.id;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        combined.push(c);
      }
    });

    searchResults.forEach((sr) => {
      const id = sr.visibleId?.toString() || sr.id;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        combined.push(sr);
      }
    });

    return combined;
  }, [chats, contacts, searchResults]);

  const gradientColors = isDark
    ? [theme.primary + "40", theme.primary + "20", "transparent"] as const
    : [theme.primary + "25", theme.primary + "10", "transparent"] as const;

  const renderContact = ({ item }: { item: Contact }) => {
    const selected = isContactSelected(item);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.contactItem,
          { backgroundColor: selected ? `${theme.primary}15` : "transparent" },
          pressed ? { opacity: 0.7 } : {},
        ]}
        onPress={() => toggleContact(item)}
      >
        <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
          <ThemedText style={styles.avatarText}>
            {item.displayName?.charAt(0)?.toUpperCase() ?? "?"}
          </ThemedText>
        </View>
        <View style={styles.contactInfo}>
          <ThemedText type="body" style={{ color: theme.text }} numberOfLines={1}>
            {item.displayName}
          </ThemedText>
          {item.email ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
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

  const cardBackgroundColor = isDark ? theme.backgroundDefault : "#FFFFFF";

  const cardStyle = isDark ? CardStyles.dark : CardStyles.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.headerGradient}
        />
        
        <View style={[styles.headerCard, cardStyle, { backgroundColor: cardBackgroundColor }]}>
          <View style={styles.headerContent}>
            <View style={[styles.groupIconContainer, { backgroundColor: theme.primary }]}>
              <Feather name="users" size={24} color="#FFFFFF" />
            </View>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderBottomColor: theme.divider },
              ]}
              placeholder={t("chats.groupName")}
              placeholderTextColor={theme.textSecondary}
              value={groupName}
              onChangeText={setGroupName}
              editable={!isCreating}
            />
          </View>
        </View>

        {selectedContacts.length > 0 ? (
          <View style={styles.selectedSection}>
            <ThemedText
              type="caption"
              style={[styles.sectionLabel, { color: theme.textSecondary }]}
            >
              {t("chats.selectedParticipants", { count: selectedContacts.length })}
            </ThemedText>
            <View style={[styles.selectedCard, cardStyle, { backgroundColor: cardBackgroundColor }]}>
              <View style={styles.selectedContent}>
                {selectedContacts.slice(0, 6).map((contact) => (
                  <Pressable
                    key={contact.id || contact.visibleId}
                    style={({ pressed }) => [
                      styles.miniAvatar,
                      { backgroundColor: contact.avatarColor },
                      pressed ? { opacity: 0.7 } : {},
                    ]}
                    onPress={() => toggleContact(contact)}
                  >
                    <ThemedText style={styles.miniAvatarText}>
                      {contact.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                    </ThemedText>
                    <View style={[styles.removeIcon, { backgroundColor: theme.accent }]}>
                      <Feather name="x" size={10} color="#FFFFFF" />
                    </View>
                  </Pressable>
                ))}
                {selectedContacts.length > 6 ? (
                  <View style={[styles.miniAvatar, { backgroundColor: theme.backgroundTertiary }]}>
                    <ThemedText style={[styles.miniAvatarText, { color: theme.text }]}>
                      +{selectedContacts.length - 6}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.searchSection}>
        <View style={[styles.searchCard, cardStyle, { backgroundColor: cardBackgroundColor }]}>
          <View style={styles.searchContent}>
            <View style={[styles.searchIconContainer, { backgroundColor: theme.primary + "18" }]}>
              <Feather name="search" size={18} color={theme.primary} />
            </View>
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={t("chats.searchByEmail")}
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="search"
            />
            {isSearching ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : searchQuery.length >= 3 ? (
              <Pressable
                onPress={handleSearch}
                style={({ pressed }) => [
                  styles.searchButton,
                  { backgroundColor: theme.primary },
                  pressed ? { opacity: 0.7 } : {},
                ]}
              >
                <Feather name="arrow-right" size={16} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        </View>
        <ThemedText type="caption" style={[styles.searchHint, { color: theme.textSecondary }]}>
          {t("chats.searchHint")}
        </ThemedText>
      </View>

      <View style={styles.contactsSection}>
        <ThemedText
          type="caption"
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          {t("chats.selectParticipants").toUpperCase()}
        </ThemedText>

        <View style={[styles.contactsCard, cardStyle, { backgroundColor: cardBackgroundColor }]}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={allContacts}
              keyExtractor={(item) => item.id || String(item.visibleId)}
              renderItem={renderContact}
              contentContainerStyle={[styles.list, { paddingBottom: getAndroidBottomInset(insets.bottom) + Spacing.xl }]}
              ItemSeparatorComponent={() => (
                <View style={[styles.divider, { backgroundColor: theme.divider, marginLeft: Spacing.lg + 40 + Spacing.md }]} />
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="users" size={48} color={theme.textSecondary} style={{ opacity: 0.5 }} />
                  <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                    {t("chats.searchToAdd")}
                  </ThemedText>
                </View>
              }
              onEndReached={hasMoreContacts ? loadMoreContacts : undefined}
              onEndReachedThreshold={0.3}
              ListFooterComponent={isLoadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : null}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  groupIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
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
  searchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  searchHint: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
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
  loadingMore: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
});

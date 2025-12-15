import React from "react";
import { View, StyleSheet, Pressable, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SearchResult } from "@/hooks/useSearch";
import { ThemedText } from "@/components/ThemedText";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SearchResultsProps {
  results: SearchResult[];
  onResultPress: (result: SearchResult) => void;
  isSearching: boolean;
}

export function SearchResults({ results, onResultPress, isSearching }: SearchResultsProps) {
  const { theme } = useTheme();

  const renderResultItem = ({ item }: { item: SearchResult }) => {
    const getIcon = () => {
      switch (item.type) {
        case "contact":
          return "user";
        case "chat":
          return "message-circle";
        case "message":
          return "file-text";
        case "user":
          return "user-plus";
        default:
          return "search";
      }
    };

    const getTitle = () => {
      switch (item.type) {
        case "contact":
          return item.contact?.displayName || "";
        case "chat":
          return item.chat?.participant?.displayName || "";
        case "message":
          return item.matchedText?.substring(0, 50) || "";
        case "user":
          return item.user?.displayName || "";
        default:
          return "";
      }
    };

    const getSubtitle = () => {
      switch (item.type) {
        case "contact":
          return item.contact?.email || "Contact";
        case "chat":
          return "Chat";
        case "message":
          return "Message";
        case "user":
          return item.user?.email || "Start chat";
        default:
          return "";
      }
    };

    const avatarColor =
      item.type === "contact"
        ? item.contact?.avatarColor
        : item.type === "chat"
        ? item.chat?.participant?.avatarColor
        : item.type === "user"
        ? item.user?.avatarColor
        : undefined;

    const avatarName =
      item.type === "contact"
        ? item.contact?.displayName
        : item.type === "chat"
        ? item.chat?.participant?.displayName
        : item.type === "user"
        ? item.user?.displayName
        : undefined;

    const avatarUrlValue =
      item.type === "contact"
        ? item.contact?.avatarUrl
        : item.type === "chat"
        ? item.chat?.participant?.avatarUrl
        : item.type === "user"
        ? item.user?.avatarUrl
        : undefined;

    return (
      <Pressable
        onPress={() => onResultPress(item)}
        style={({ pressed }) => [
          styles.resultItem,
          { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
        ]}
      >
        {avatarColor && avatarName ? (
          <Avatar name={avatarName} color={avatarColor} avatarUrl={avatarUrlValue} size={44} />
        ) : (
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Feather name={getIcon()} size={20} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.resultContent}>
          <ThemedText style={styles.resultTitle} numberOfLines={1}>
            {getTitle()}
          </ThemedText>
          <ThemedText
            style={[styles.resultSubtitle, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {getSubtitle()}
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </Pressable>
    );
  };

  if (isSearching) {
    return (
      <View style={styles.centered}>
        <ThemedText style={{ color: theme.textSecondary }}>Searching...</ThemedText>
      </View>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <FlatList
      data={results}
      renderItem={renderResultItem}
      keyExtractor={(item, index) =>
        `${item.type}-${item.contact?.id || item.chat?.id || item.message?.id || item.user?.visibleId || index}`
      }
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: Spacing.sm,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  resultContent: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: 14,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
});

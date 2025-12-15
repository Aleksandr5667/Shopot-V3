import React from "react";
import { View, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Chat } from "@/store/types";
import { Avatar } from "./Avatar";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTranslation } from "react-i18next";

interface ChatListItemProps {
  chat: Chat;
  onPress: () => void;
  onDelete?: (chatId: string) => void;
  isOnline?: boolean;
}

export function ChatListItem({ chat, onPress, onDelete, isOnline }: ChatListItemProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { participant, lastMessage, unreadCount } = chat;
  
  const isGroup = chat.type === 'group';
  const displayName = isGroup ? (chat.name || "Group") : (participant?.displayName || "Unknown");
  const avatarColor = isGroup ? "#10B981" : (participant?.avatarColor || "#0088CC");
  const avatarUrl = isGroup ? chat.avatarUrl : participant?.avatarUrl;

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return t("common.yesterday");
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handleLongPress = () => {
    if (!onDelete) return;

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        t("chat.deleteChatConfirm", { name: displayName })
      );
      if (confirmed) {
        onDelete(chat.id);
      }
    } else {
      Alert.alert(
        t("chat.deleteChat"),
        t("chat.deleteChatConfirm", { name: displayName }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => onDelete(chat.id),
          },
        ]
      );
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={500}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed
            ? theme.backgroundSecondary
            : theme.backgroundDefault,
        },
      ]}
    >
      <Avatar
        name={displayName}
        color={avatarColor}
        avatarUrl={avatarUrl}
        size={Spacing.avatarMedium}
        isOnline={isOnline}
      />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            {isGroup ? (
              <Feather name="users" size={14} color={theme.textSecondary} style={styles.groupIcon} />
            ) : null}
            <ThemedText type="body" style={styles.name} numberOfLines={1}>
              {displayName}
            </ThemedText>
          </View>
          {lastMessage ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatTime(lastMessage.timestamp)}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          <ThemedText
            type="small"
            style={[styles.preview, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {lastMessage?.mediaType
              ? lastMessage.mediaType === "photo"
                ? t("chat.photo")
                : lastMessage.mediaType === "audio"
                  ? t("chat.voiceMessage")
                  : t("chat.video")
              : lastMessage?.text || ""}
          </ThemedText>
          {unreadCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText type="caption" style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    height: Spacing.chatListItemHeight,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.sm,
  },
  groupIcon: {
    marginRight: 6,
  },
  name: {
    flex: 1,
    fontWeight: "600",
  },
  preview: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
});

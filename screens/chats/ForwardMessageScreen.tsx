import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { ChatsStackParamList } from "@/navigation/types";
import { ChatListItem } from "@/components/ChatListItem";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useChatsContext } from "@/contexts/ChatsContext";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";
import { useTranslation } from "react-i18next";
import { messageQueue } from "@/services/messageQueue";

type Props = NativeStackScreenProps<ChatsStackParamList, "ForwardMessage">;

export default function ForwardMessageScreen({ route, navigation }: Props) {
  const { messageContent, messageType, mediaUrl, mediaUri, audioDuration } = route.params;
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { chats } = useChatsContext();
  const [forwarding, setForwarding] = useState<string | null>(null);

  const handleForward = useCallback(async (chatId: string, chat: typeof chats[0]) => {
    if (forwarding) return;
    setForwarding(chatId);

    try {
      const tempId = `forward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const numericChatId = parseInt(chatId, 10);
      if (isNaN(numericChatId)) {
        console.error("Invalid chatId for forwarding:", chatId);
        setForwarding(null);
        return;
      }
      
      await messageQueue.enqueue({
        id: tempId,
        chatId: numericChatId,
        content: messageContent || "",
        type: messageType,
        mediaUrl: mediaUrl,
        mediaUri: mediaUri,
        audioDuration: audioDuration,
      });

      navigation.replace("Chat", {
        chatId: chatId,
        participant: chat.isGroup ? undefined : chat.participant,
        isGroup: chat.isGroup,
        groupName: chat.groupName,
        groupAvatarUrl: chat.avatarUrl,
        memberCount: chat.memberCount,
        groupParticipants: chat.participants,
      });
    } catch (error) {
      console.error("Forward error:", error);
      setForwarding(null);
    }
  }, [forwarding, messageContent, messageType, mediaUrl, mediaUri, audioDuration, navigation, chats]);

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

  const gradientColors = isDark
    ? [theme.primary + "40", theme.primary + "20", "transparent"] as const
    : [theme.primary + "25", theme.primary + "10", "transparent"] as const;

  const renderItem = useCallback(({ item }: { item: typeof chats[0] }) => {
    return (
      <ChatListItem
        chat={item}
        onPress={() => handleForward(item.id, item)}
      />
    );
  }, [handleForward]);

  if (chats.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <EmptyState
          icon="message-circle"
          title={t("chats.noChats")}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.headerGradient}
      />
      <View style={styles.sectionWrapper}>
        <ThemedText
          type="caption"
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          {t("chats.selectContact").toUpperCase()}
        </ThemedText>
        <View style={[styles.listCard, cardStyle]}>
          {renderBlurBackground()}
          <FlatList
            data={chats}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  sectionWrapper: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  listCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  listContent: {
    paddingVertical: Spacing.xs,
  },
});

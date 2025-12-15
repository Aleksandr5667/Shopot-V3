import React from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { ChatsStackParamList } from "@/navigation/types";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Avatar } from "@/components/Avatar";
import { ThemedText } from "@/components/ThemedText";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { useTheme } from "@/hooks/useTheme";
import { useOnlineStatus } from "@/hooks/useChats";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";

type Props = NativeStackScreenProps<ChatsStackParamList, "UserProfile">;

export default function UserProfileScreen({ route, navigation }: Props) {
  const { user } = route.params;
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { isOnline } = useOnlineStatus();

  const userId = user.id ? parseInt(String(user.id), 10) : undefined;
  const userOnline = userId ? isOnline(userId) : false;

  const gradientColors = isDark
    ? [theme.primary + "40", theme.primary + "20", "transparent"] as const
    : [theme.primary + "25", theme.primary + "10", "transparent"] as const;

  const cardStyle = isDark ? CardStyles.dark : CardStyles.light;

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.profileWrapper}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.profileGradient}
        />
        <View style={[styles.profileCard, cardStyle]}>
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={isDark ? 15 : 30}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? "rgba(30,32,34,0.97)" : "rgba(255,255,255,0.95)" },
              ]}
            />
          )}
          <View style={styles.profileContent}>
            <Avatar
              name={user.displayName || "?"}
              color={user.avatarColor || "#0088CC"}
              avatarUrl={user.avatarUrl}
              size={100}
              isOnline={userOnline}
            />
            <ThemedText type="h2" style={styles.userName}>
              {user.displayName}
            </ThemedText>
            {userOnline ? (
              <ThemedText style={[styles.status, { color: "#25D366" }]}>
                {t("chat.online")}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </View>

      <SettingsSection title={t("profile.info")}>
        <SettingsItem
          icon="user"
          label={t("profile.about")}
          value={user.bio || t("profile.noBio")}
          multiline
        />
        {user.email ? (
          <SettingsItem
            icon="mail"
            label={t("profile.email")}
            value={user.email}
            multiline
          />
        ) : null}
      </SettingsSection>

      <SettingsSection>
        <SettingsItem
          icon="message-circle"
          label={t("profile.sendMessage")}
          onPress={() => navigation.goBack()}
        />
      </SettingsSection>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  profileWrapper: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  profileGradient: {
    position: "absolute",
    top: -60,
    left: -Spacing.lg,
    right: -Spacing.lg,
    height: 200,
  },
  profileCard: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  profileContent: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  userName: {
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  status: {
    marginTop: Spacing.xs,
    fontSize: 14,
    fontWeight: "500",
  },
});

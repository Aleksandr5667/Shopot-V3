import React, { useCallback, useLayoutEffect } from "react";
import { View, StyleSheet, Alert, Pressable, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation, DrawerActions } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { SettingsStackParamList } from "@/navigation/types";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Avatar } from "@/components/Avatar";
import { ThemedText } from "@/components/ThemedText";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";

type ThemeMode = "system" | "light" | "dark";

type Props = NativeStackScreenProps<SettingsStackParamList, "SettingsMain">;

export default function SettingsScreen({ navigation }: Props) {
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const { t, i18n } = useTranslation();
  const { user, signOut, deleteAccount } = useAuth();
  const drawerNav = useNavigation();

  const getThemeLabel = (mode: ThemeMode) => {
    switch (mode) {
      case "system": return t("settings.light");
      case "light": return t("settings.light");
      case "dark": return t("settings.dark");
    }
  };

  const handleThemeChange = () => {
    const modes: ThemeMode[] = ["light", "dark"];
    const currentIndex = modes.indexOf(themeMode);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length;
    setThemeMode(modes[nextIndex]);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => drawerNav.dispatch(DrawerActions.openDrawer())}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingHorizontal: Spacing.sm })}
        >
          <Feather name="align-left" size={24} color={theme.text} />
        </Pressable>
      ),
    });
  }, [navigation, drawerNav, theme.text]);

  const getCurrentLanguage = () => {
    return i18n.language === "ru" ? t("settings.russian") : t("settings.english");
  };

  const handleLogout = useCallback(() => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(t("settings.logoutConfirm"));
      if (confirmed) {
        signOut();
      }
    } else {
      Alert.alert(t("settings.logout"), t("settings.logoutConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.logout"),
          style: "destructive",
          onPress: signOut,
        },
      ]);
    }
  }, [t, signOut]);

  const handleDeleteAccount = useCallback(() => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(t("settings.deleteAccountConfirm"));
      if (confirmed) {
        deleteAccount();
      }
    } else {
      Alert.alert(t("settings.deleteAccount"), t("settings.deleteAccountConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: deleteAccount,
        },
      ]);
    }
  }, [t, deleteAccount]);

  const gradientColors = isDark
    ? [theme.primary + "40", theme.primary + "20", "transparent"] as const
    : [theme.primary + "25", theme.primary + "10", "transparent"] as const;

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.profileWrapper}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.profileGradient}
        />
        <Pressable
          onPress={() => navigation.navigate("EditProfile")}
          style={({ pressed }) => [
            styles.profileCard,
            isDark ? CardStyles.dark : CardStyles.light,
            pressed ? { opacity: 0.9 } : {},
          ]}
        >
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
            <View style={styles.avatarContainer}>
              <Avatar
                name={user?.displayName || ""}
                color={user?.avatarColor || theme.primary}
                avatarUrl={user?.avatarUrl}
                size={72}
              />
              <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
                <Feather name="edit-2" size={12} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.profileInfo}>
              <ThemedText type="h4" style={styles.userName} numberOfLines={1}>
                {user?.displayName}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                {user?.email}
              </ThemedText>
              {user?.bio ? (
                <ThemedText
                  type="caption"
                  style={[styles.userBio, { color: theme.textSecondary }]}
                  numberOfLines={2}
                >
                  {user.bio}
                </ThemedText>
              ) : null}
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </View>
        </Pressable>
      </View>

      <SettingsSection title={t("settings.account")}>
        <SettingsItem
          icon="globe"
          label={t("settings.language")}
          value={getCurrentLanguage()}
          onPress={() => navigation.navigate("LanguageSettings")}
        />
        <SettingsItem
          icon={isDark ? "moon" : "sun"}
          label={t("settings.theme")}
          value={getThemeLabel(themeMode)}
          onPress={handleThemeChange}
        />
      </SettingsSection>

      <View style={styles.donationWrapper}>
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync("https://www.donationalerts.com/r/aleksandr_fedorina")}
          style={({ pressed }) => [
            styles.donationCard,
            isDark ? CardStyles.dark : CardStyles.light,
            pressed ? { opacity: 0.8 } : {},
          ]}
        >
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
          <View style={styles.donationContent}>
            <View style={[styles.donationIconContainer, { backgroundColor: "#FF6B6B20" }]}>
              <Feather name="heart" size={20} color="#FF6B6B" />
            </View>
            <ThemedText style={[styles.donationTitle, { color: theme.text }]}>
              {t("settings.supportProject")}
            </ThemedText>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </View>
        </Pressable>
      </View>

      <SettingsSection title={t("settings.about")}>
        <SettingsItem
          icon="info"
          label={t("settings.about")}
          value="Shepot"
        />
        <SettingsItem
          icon="code"
          label={t("settings.version")}
          value="1.2.4"
        />
        <SettingsItem
          icon="shield"
          label={t("legal.privacyPolicy")}
          onPress={() => navigation.navigate("Legal", { type: "privacy" })}
        />
        <SettingsItem
          icon="file-text"
          label={t("legal.termsOfUse")}
          onPress={() => navigation.navigate("Legal", { type: "terms" })}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsItem
          icon="log-out"
          label={t("settings.logout")}
          onPress={handleLogout}
          destructive
        />
        <SettingsItem
          icon="trash-2"
          label={t("settings.deleteAccount")}
          onPress={handleDeleteAccount}
          destructive
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
  donationWrapper: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  donationCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  donationContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 52,
  },
  donationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  donationTitle: {
    flex: 1,
    fontSize: 16,
  },
  profileGradient: {
    position: "absolute",
    top: -60,
    left: -Spacing.lg,
    right: -Spacing.lg,
    height: 180,
  },
  profileCard: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  avatarContainer: {
    position: "relative",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  userName: {
    marginBottom: 2,
  },
  userBio: {
    marginTop: Spacing.xs,
    fontStyle: "italic",
  },
});

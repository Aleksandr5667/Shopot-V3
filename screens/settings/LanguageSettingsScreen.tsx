import React, { useCallback } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { SettingsStackParamList } from "@/navigation/types";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { changeLanguage } from "@/i18n";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";

type Props = NativeStackScreenProps<SettingsStackParamList, "LanguageSettings">;

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  icon: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", icon: "globe" },
  { code: "ru", name: "Russian", nativeName: "Русский", icon: "globe" },
];

export default function LanguageSettingsScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { t, i18n } = useTranslation();

  const handleLanguageSelect = useCallback(
    async (langCode: string) => {
      await changeLanguage(langCode);
      navigation.goBack();
    },
    [navigation]
  );

  const cardStyle = isDark ? CardStyles.dark : CardStyles.light;

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

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <ThemedText
          type="caption"
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          {t("settings.language").toUpperCase()}
        </ThemedText>
        <View style={[styles.listCard, cardStyle]}>
          {renderBlurBackground()}
          {LANGUAGES.map((lang, index) => {
            const isSelected = i18n.language === lang.code;
            return (
              <View key={lang.code}>
                <Pressable
                  onPress={() => handleLanguageSelect(lang.code)}
                  style={({ pressed }) => [
                    styles.languageItem,
                    { backgroundColor: isSelected ? `${theme.primary}15` : "transparent" },
                    pressed ? { opacity: 0.7 } : {},
                  ]}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: isSelected ? theme.primary + "18" : theme.backgroundSecondary },
                    ]}
                  >
                    <Feather
                      name={lang.icon as any}
                      size={18}
                      color={isSelected ? theme.primary : theme.textSecondary}
                    />
                  </View>
                  <View style={styles.languageInfo}>
                    <ThemedText type="body" style={[styles.languageName, { color: theme.text }]}>
                      {lang.nativeName}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {lang.name}
                    </ThemedText>
                  </View>
                  {isSelected ? (
                    <View style={[styles.checkContainer, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={14} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
                {index < LANGUAGES.length - 1 ? (
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: theme.divider, marginLeft: Spacing.lg + 32 + Spacing.md },
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.lg,
  },
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: "uppercase",
    fontWeight: "600",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  listCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  languageItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontWeight: "500",
    marginBottom: 2,
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});

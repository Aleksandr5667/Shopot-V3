import React, { useCallback, useLayoutEffect, useState } from "react";
import { View, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { ChatsStackParamList } from "@/navigation/types";
import { ThemedText } from "@/components/ThemedText";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useContacts } from "@/hooks/useChats";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";
import { Contact, getInitials } from "@/store/types";

type Props = NativeStackScreenProps<ChatsStackParamList, "AddContact">;

export default function AddContactScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { searchUser, addContact } = useContacts();
  const [email, setEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [foundUser, setFoundUser] = useState<Contact | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("chats.addContact"),
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.headerButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <ThemedText type="body" style={{ color: theme.primary }}>
            {t("common.cancel")}
          </ThemedText>
        </Pressable>
      ),
    });
  }, [navigation, t, theme.primary]);

  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim());
  };

  const handleSearch = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert(t("errors.somethingWentWrong"), t("auth.invalidEmail"));
      return;
    }

    setIsSearching(true);
    setFoundUser(null);
    setSearchError(null);

    const result = await searchUser(trimmedEmail);
    
    setIsSearching(false);

    if (result.success && result.user) {
      setFoundUser(result.user);
    } else {
      setSearchError(t("chats.userNotFound"));
    }
  }, [email, searchUser, t]);

  const handleAddContact = useCallback(async () => {
    if (!foundUser?.visibleId || isAdding) return;

    setIsAdding(true);
    navigation.goBack();
    
    const result = await addContact(foundUser.visibleId, {
      displayName: foundUser.displayName,
      email: foundUser.email,
      avatarColor: foundUser.avatarColor,
    });
    if (!result.success && result.error) {
      Alert.alert(t("errors.somethingWentWrong"), result.error);
    }
  }, [foundUser, addContact, navigation, t, isAdding]);

  const isValid = isValidEmail(email);
  const cardStyle = isDark ? CardStyles.dark : CardStyles.light;

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.section}>
        <ThemedText
          type="caption"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          {t("chats.searchByEmail").toUpperCase()}
        </ThemedText>
        <View style={[styles.sectionContent, cardStyle]}>
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
          <View style={styles.inputRow}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + "18" }]}>
              <Feather name="at-sign" size={18} color={theme.primary} />
            </View>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setFoundUser(null);
                setSearchError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
          </View>
        </View>
        <ThemedText type="caption" style={[styles.hint, { color: theme.textSecondary }]}>
          {t("chats.addContactHint")}
        </ThemedText>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          onPress={handleSearch}
          disabled={!isValid || isSearching}
          style={styles.searchButton}
        >
          {isSearching ? t("common.loading") : t("chats.searchUser")}
        </Button>
      </View>

      {searchError ? (
        <View style={styles.section}>
          <View style={[styles.sectionContent, cardStyle]}>
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
            <View style={styles.errorContent}>
              <View style={[styles.errorIcon, { backgroundColor: theme.accent + "18" }]}>
                <Feather name="user-x" size={24} color={theme.accent} />
              </View>
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
                {searchError}
              </ThemedText>
            </View>
          </View>
        </View>
      ) : null}

      {foundUser ? (
        <View style={styles.section}>
          <ThemedText
            type="caption"
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            {t("chats.foundUser").toUpperCase()}
          </ThemedText>
          <View style={[styles.sectionContent, cardStyle]}>
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
            <View style={styles.foundUserRow}>
              <View style={[styles.avatar, { backgroundColor: foundUser.avatarColor }]}>
                <ThemedText style={styles.avatarText}>
                  {getInitials(foundUser.displayName)}
                </ThemedText>
              </View>
              <View style={styles.userInfo}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {foundUser.displayName}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {foundUser.email}
                </ThemedText>
              </View>
              <Pressable
                style={[styles.addButton, { backgroundColor: isAdding ? theme.divider : theme.primary }]}
                onPress={handleAddContact}
                disabled={isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Feather name="user-plus" size={20} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: Spacing.lg,
  },
  headerButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
    marginHorizontal: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: "uppercase",
    fontWeight: "600",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  sectionContent: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 52,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  hint: {
    marginTop: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  buttonContainer: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  searchButton: {
    width: "100%",
  },
  errorContent: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  foundUserRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 52,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});

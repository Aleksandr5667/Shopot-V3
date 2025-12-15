import React, { useState, useCallback } from "react";
import { View, StyleSheet, TextInput, Alert, Pressable, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SettingsStackParamList } from "@/navigation/types";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { Avatar } from "@/components/Avatar";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";
import { AVATAR_COLORS as COLORS } from "@/store/types";
import { apiService } from "@/services/api";

type Props = NativeStackScreenProps<SettingsStackParamList, "EditProfile">;

export default function EditProfileScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [selectedColor, setSelectedColor] = useState(user?.avatarColor || COLORS[0]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePickImage = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(t("common.error"), t("errors.permissionDenied"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        try {
          const asset = result.assets[0];
          
          const uploadResponse = await apiService.uploadMedia(asset.uri, "image", undefined, "avatars");
          
          if (uploadResponse.success && uploadResponse.data) {
            setAvatarUrl(uploadResponse.data);
          } else {
            Alert.alert(t("common.error"), t("errors.uploadFailed"));
          }
        } catch (error) {
          console.error("Upload error:", error);
          Alert.alert(t("common.error"), t("errors.uploadFailed"));
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
    }
  }, [t]);

  const handleRemovePhoto = useCallback(() => {
    setAvatarUrl(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert(t("common.error"), t("auth.nameRequired"));
      return;
    }

    const userData = {
      displayName: displayName.trim(),
      bio: bio.trim(),
      avatarColor: selectedColor,
      avatarUrl: avatarUrl || undefined,
    };
    
    navigation.goBack();
    
    try {
      await updateUser(userData);
    } catch (error) {
      Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
    }
  }, [displayName, bio, selectedColor, avatarUrl, updateUser, navigation, t]);

  const gradientColors = isDark
    ? [theme.primary + "40", theme.primary + "20", "transparent"] as const
    : [theme.primary + "25", theme.primary + "10", "transparent"] as const;

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
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.content}>
      <View style={styles.avatarWrapper}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.avatarGradient}
        />
        <View style={[styles.avatarCard, cardStyle]}>
          {renderBlurBackground()}
          <View style={styles.avatarContent}>
            <Pressable 
              onPress={handlePickImage} 
              disabled={isUploading}
              style={({ pressed }) => [pressed ? { opacity: 0.8 } : {}]}
            >
              <View style={styles.avatarContainer}>
                <Avatar 
                  name={displayName || "?"} 
                  color={selectedColor} 
                  avatarUrl={avatarUrl}
                  size={100} 
                />
                <View style={[styles.cameraIcon, { backgroundColor: theme.primary }]}>
                  <Feather name="camera" size={16} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>

            {isUploading ? (
              <ThemedText type="body" style={[styles.changeAvatarText, { color: theme.textSecondary }]}>
                {t("common.loading")}
              </ThemedText>
            ) : (
              <View style={styles.avatarActions}>
                <Pressable 
                  onPress={handlePickImage}
                  style={({ pressed }) => [pressed ? { opacity: 0.7 } : {}]}
                >
                  <ThemedText
                    type="body"
                    style={[styles.changeAvatarText, { color: theme.primary }]}
                  >
                    {t("profile.choosePhoto")}
                  </ThemedText>
                </Pressable>
                {avatarUrl ? (
                  <Pressable 
                    onPress={handleRemovePhoto}
                    style={({ pressed }) => [pressed ? { opacity: 0.7 } : {}]}
                  >
                    <ThemedText
                      type="body"
                      style={[styles.changeAvatarText, { color: theme.accent }]}
                    >
                      {t("profile.removePhoto")}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            )}

            {!avatarUrl ? (
              <>
                <ThemedText
                  type="small"
                  style={[styles.orText, { color: theme.textSecondary }]}
                >
                  {t("profile.orSelectColor")}
                </ThemedText>
                <View style={styles.colorPicker}>
                  {COLORS.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => setSelectedColor(color)}
                      style={({ pressed }) => [
                        styles.colorOption,
                        {
                          backgroundColor: color,
                          borderColor: selectedColor === color ? theme.text : "transparent",
                        },
                        pressed ? { opacity: 0.8 } : {},
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.formSection}>
        <ThemedText
          type="caption"
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          {t("profile.name").toUpperCase()}
        </ThemedText>
        <View style={[styles.inputCard, cardStyle]}>
          {renderBlurBackground()}
          <View style={styles.inputContent}>
            <View style={[styles.inputIconContainer, { backgroundColor: theme.primary + "18" }]}>
              <Feather name="user" size={18} color={theme.primary} />
            </View>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder={t("auth.namePlaceholder")}
              placeholderTextColor={theme.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              maxLength={25}
            />
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {displayName.length}/25
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.formSection}>
        <ThemedText
          type="caption"
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          {t("profile.bio").toUpperCase()}
        </ThemedText>
        <View style={[styles.bioCard, cardStyle]}>
          {renderBlurBackground()}
          <View style={styles.bioContent}>
            <View style={styles.bioHeader}>
              <View style={[styles.inputIconContainer, { backgroundColor: theme.primary + "18" }]}>
                <Feather name="file-text" size={18} color={theme.primary} />
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {bio.length}/150
              </ThemedText>
            </View>
            <TextInput
              style={[styles.bioInput, { color: theme.text }]}
              placeholder={t("profile.bioPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={150}
            />
          </View>
        </View>
      </View>

      <View style={styles.buttonSection}>
        <Button
          onPress={handleSave}
          disabled={isSaving || isUploading}
          style={styles.saveButton}
        >
          {t("profile.saveChanges")}
        </Button>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  avatarWrapper: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  avatarGradient: {
    position: "absolute",
    top: -60,
    left: -Spacing.lg,
    right: -Spacing.lg,
    height: 180,
  },
  avatarCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  avatarContent: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  avatarContainer: {
    position: "relative",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarActions: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  changeAvatarText: {
    fontWeight: "500",
  },
  orText: {
    marginTop: Spacing.lg,
  },
  colorPicker: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
  },
  formSection: {
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
  inputCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  inputContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  inputIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  bioCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  bioContent: {
    padding: Spacing.lg,
  },
  bioHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  bioInput: {
    fontSize: 16,
    minHeight: 100,
  },
  buttonSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  saveButton: {
    marginTop: Spacing.md,
  },
});

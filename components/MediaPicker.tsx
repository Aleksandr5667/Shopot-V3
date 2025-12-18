import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Alert,
  Linking,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};

interface MediaPickerProps {
  visible: boolean;
  onClose: () => void;
  onMediaSelected: (uri: string, type: "photo" | "video") => void;
}

export function MediaPicker({
  visible,
  onClose,
  onMediaSelected,
}: MediaPickerProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  const slideY = useSharedValue(300);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      slideY.value = withSpring(0, SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      slideY.value = withSpring(300, SPRING_CONFIG);
      backdropOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
    opacity: interpolate(slideY.value, [300, 0], [0, 1], Extrapolation.CLAMP),
  }));

  const showSettingsAlert = (message: string) => {
    const buttons: any[] = [{ text: t("common.ok") }];
    if (Platform.OS !== "web") {
      buttons.push({
        text: t("common.settings"),
        onPress: async () => {
          try {
            await Linking.openSettings();
          } catch (e) {}
        },
      });
    }
    Alert.alert(t("errors.permissionDenied"), message, buttons);
  };

  const pickImage = async () => {
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        if (!canAskAgain && Platform.OS !== "web") {
          showSettingsAlert(t("errors.mediaLibraryPermissionRequired"));
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        onMediaSelected(result.assets[0].uri, "photo");
        onClose();
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert(t("errors.error"), t("errors.tryAgain"));
    }
  };

  const pickVideo = async () => {
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        if (!canAskAgain && Platform.OS !== "web") {
          showSettingsAlert(t("errors.mediaLibraryPermissionRequired"));
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 0.8,
        videoMaxDuration: 60,
        allowsEditing: false,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
          Alert.alert(
            t("errors.fileTooLarge"),
            t("errors.fileSizeLimit", { size: MAX_FILE_SIZE_MB })
          );
          return;
        }
        onMediaSelected(asset.uri, "video");
        onClose();
      }
    } catch (error: any) {
      const errorMessage = error?.message || "";
      const isExpectedError = 
        errorMessage.includes("PHPhotos") || 
        errorMessage.includes("3164") ||
        errorMessage.includes("cancelled") ||
        error?.code === "E_PICKER_CANCELLED";
      
      if (isExpectedError) {
        return;
      }
      
      console.error("Error picking video:", error);
      Alert.alert(
        t("errors.videoPickerError"),
        t("errors.tryAgain")
      );
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === "web") {
      return;
    }

    try {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        if (!canAskAgain) {
          showSettingsAlert(t("errors.cameraPermissionRequired"));
        }
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        onMediaSelected(result.assets[0].uri, "photo");
        onClose();
      }
    } catch (error) {
      console.error("Error taking photo:", error);
    }
  };

  const options = [
    {
      icon: "camera" as const,
      label: t("media.openCamera"),
      onPress: takePhoto,
      color: "#FF9500",
      bgColor: "rgba(255, 149, 0, 0.15)",
      hidden: Platform.OS === "web",
    },
    {
      icon: "image" as const,
      label: t("media.chooseFromGallery"),
      onPress: pickImage,
      color: "#34C759",
      bgColor: "rgba(52, 199, 89, 0.15)",
    },
    {
      icon: "video" as const,
      label: t("media.chooseVideo"),
      onPress: pickVideo,
      color: "#AF52DE",
      bgColor: "rgba(175, 82, 222, 0.15)",
    },
  ].filter((opt) => !opt.hidden);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.content,
            contentStyle,
            {
              backgroundColor: isDark ? theme.backgroundSecondary : theme.backgroundDefault,
              paddingBottom: insets.bottom + Spacing.md,
            },
          ]}
        >
          <View style={styles.handle} />
          
          <View style={styles.optionsContainer}>
            {options.map((option) => (
              <Pressable
                key={option.icon}
                onPress={option.onPress}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: pressed
                      ? isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"
                      : "transparent",
                  },
                ]}
              >
                <View style={[styles.iconContainer, { backgroundColor: option.bgColor }]}>
                  <Feather name={option.icon} size={22} color={option.color} />
                </View>
                <ThemedText style={styles.optionLabel}>{option.label}</ThemedText>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <ThemedText style={[styles.cancelText, { color: theme.text }]}>
              {t("media.cancel")}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  content: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.4)",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  optionsContainer: {
    gap: Spacing.xs,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  optionLabel: {
    flex: 1,
    marginLeft: Spacing.md,
    fontSize: 16,
    fontWeight: "500",
  },
  cancelButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

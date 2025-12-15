import React, { useEffect, useRef } from "react";
import { StyleSheet, Animated, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { ThemedText } from "./ThemedText";
import { Spacing } from "@/constants/theme";

type NotificationType = "error" | "success" | "warning" | "info";

interface NotificationBannerProps {
  type: NotificationType;
  message: string;
  visible: boolean;
  onDismiss?: () => void;
  showCloseButton?: boolean;
  inline?: boolean;
  icon?: keyof typeof import("@expo/vector-icons").Feather.glyphMap;
}

const typeConfig = {
  error: {
    icon: "alert-circle" as const,
    backgroundColor: "rgba(180, 60, 60, 0.6)",
  },
  success: {
    icon: "check-circle" as const,
    backgroundColor: "rgba(60, 140, 80, 0.6)",
  },
  warning: {
    icon: "alert-triangle" as const,
    backgroundColor: "rgba(180, 140, 60, 0.6)",
  },
  info: {
    icon: "info" as const,
    backgroundColor: "rgba(60, 120, 180, 0.6)",
  },
};

export function NotificationBanner({
  type,
  message,
  visible,
  onDismiss,
  showCloseButton = true,
  inline = false,
  icon,
}: NotificationBannerProps) {
  const slideAnim = useRef(new Animated.Value(inline ? 0 : -20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const config = typeConfig[type];
  const iconName = icon || config.icon;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 120,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: inline ? 0 : -20,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim, inline]);

  if (!visible) return null;

  const content = (
    <>
      <Feather name={iconName} size={11} color="rgba(255,255,255,0.9)" />
      <ThemedText style={styles.text} numberOfLines={2}>
        {message}
      </ThemedText>
      {showCloseButton && onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          style={({ pressed }) => [
            styles.closeButton,
            { opacity: pressed ? 1 : 0.7 },
          ]}
        >
          <Feather name="x" size={12} color="rgba(255,255,255,0.9)" />
        </Pressable>
      ) : null}
    </>
  );

  const containerStyle = inline ? styles.inlineContainer : styles.floatingContainer;

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          transform: inline ? [] : [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={80}
          tint="dark"
          style={[styles.blurContainer, { backgroundColor: config.backgroundColor }]}
        >
          {content}
        </BlurView>
      ) : (
        <Animated.View style={[styles.blurContainer, { backgroundColor: config.backgroundColor }]}>
          {content}
        </Animated.View>
      )}
    </Animated.View>
  );
}

export function InlineNotificationBanner({
  type,
  message,
  visible,
  onDismiss,
}: Omit<NotificationBannerProps, "inline" | "showCloseButton">) {
  const config = typeConfig[type];

  if (!visible) return null;

  const content = (
    <>
      <Feather name={config.icon} size={11} color="rgba(255,255,255,0.9)" />
      <ThemedText style={styles.text} numberOfLines={2}>
        {message}
      </ThemedText>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          style={({ pressed }) => [
            styles.closeButton,
            { opacity: pressed ? 1 : 0.7 },
          ]}
        >
          <Feather name="x" size={12} color="rgba(255,255,255,0.9)" />
        </Pressable>
      ) : null}
    </>
  );

  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={80}
        tint="dark"
        style={[styles.inlineBanner, { backgroundColor: config.backgroundColor }]}
      >
        {content}
      </BlurView>
    );
  }

  return (
    <Animated.View style={[styles.inlineBanner, { backgroundColor: config.backgroundColor }]}>
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 100,
  },
  inlineContainer: {
    alignSelf: "center",
  },
  blurContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: Spacing.sm,
    paddingRight: 6,
    gap: 6,
    borderRadius: 16,
    overflow: "hidden",
  },
  inlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: Spacing.sm,
    paddingRight: 6,
    gap: 6,
    borderRadius: 16,
    overflow: "hidden",
    alignSelf: "center",
  },
  text: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  closeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
});

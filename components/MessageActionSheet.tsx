import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Modal, Platform, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ActionItem = {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  actions: ActionItem[];
  cancelLabel?: string;
};

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};

export function MessageActionSheet({ visible, onClose, actions, cancelLabel = "Cancel" }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(300);
  const opacity = useSharedValue(0);
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, SPRING_CONFIG);
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(300, { duration: 200 }, () => {
        runOnJS(setShouldRender)(false);
      });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleClose = useCallback(() => {
    opacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(300, { duration: 200 }, () => {
      runOnJS(onClose)();
    });
  }, [onClose]);

  const handleAction = useCallback((action: ActionItem) => {
    opacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(300, { duration: 200 }, () => {
      runOnJS(onClose)();
      runOnJS(action.onPress)();
    });
  }, [onClose]);

  if (!shouldRender) {
    return null;
  }

  const renderContent = () => (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
      <View style={styles.handle} />
      <View style={styles.actionsContainer}>
        {actions.map((action, index) => (
          <Pressable
            key={action.id}
            onPress={() => handleAction(action)}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: pressed 
                  ? theme.backgroundSecondary 
                  : theme.backgroundDefault,
                borderBottomWidth: index < actions.length - 1 ? 1 : 0,
                borderBottomColor: theme.divider,
              },
            ]}
          >
            <View style={[
              styles.iconContainer,
              { backgroundColor: action.destructive ? "#FFEBEE" : theme.backgroundSecondary }
            ]}>
              <Feather
                name={action.icon}
                size={20}
                color={action.destructive ? "#E53935" : theme.primary}
              />
            </View>
            <ThemedText
              style={[
                styles.actionLabel,
                action.destructive && { color: "#E53935" },
              ]}
            >
              {action.label}
            </ThemedText>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={handleClose}
        style={({ pressed }) => [
          styles.cancelButton,
          {
            backgroundColor: pressed 
              ? theme.backgroundSecondary 
              : theme.backgroundDefault,
          },
        ]}
      >
        <ThemedText style={styles.cancelLabel}>{cancelLabel}</ThemedText>
      </Pressable>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
            {Platform.OS === "ios" ? (
              <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]} />
            )}
          </Pressable>
        </Animated.View>
        <Animated.View style={[styles.sheetWrapper, sheetStyle, { backgroundColor: theme.backgroundRoot }]}>
          {renderContent()}
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
  },
  sheetWrapper: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  sheet: {
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 5,
    backgroundColor: "#C4C4C4",
    borderRadius: 2.5,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  actionsContainer: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  cancelButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});

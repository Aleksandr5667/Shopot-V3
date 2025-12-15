import React, { ReactNode } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";

interface SettingsItemProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: ReactNode;
  destructive?: boolean;
  multiline?: boolean;
}

export function SettingsItem({
  icon,
  label,
  value,
  onPress,
  rightElement,
  destructive = false,
  multiline = false,
}: SettingsItemProps) {
  const { theme } = useTheme();

  const iconColor = destructive ? theme.accent : theme.primary;
  const textColor = destructive ? theme.accent : theme.text;

  if (multiline && value) {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.containerMultiline,
          pressed && onPress ? { opacity: 0.7 } : {},
        ]}
      >
        <View style={styles.multilineHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: iconColor + "18" },
            ]}
          >
            <Feather
              name={icon as any}
              size={18}
              color={iconColor}
            />
          </View>
          <ThemedText style={[styles.label, { color: textColor }]}>
            {label}
          </ThemedText>
          {onPress && !rightElement ? (
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          ) : null}
          {rightElement}
        </View>
        <ThemedText type="small" style={[styles.multilineValue, { color: theme.textSecondary }]}>
          {value}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && onPress ? { opacity: 0.7 } : {},
      ]}
    >
      <View style={styles.leftContent}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: iconColor + "18" },
          ]}
        >
          <Feather
            name={icon as any}
            size={18}
            color={iconColor}
          />
        </View>
        <ThemedText style={[styles.label, { color: textColor }]}>
          {label}
        </ThemedText>
      </View>

      <View style={styles.rightContent}>
        {value ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
            {value}
          </ThemedText>
        ) : null}
        {rightElement}
        {onPress && !rightElement ? (
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        ) : null}
      </View>
    </Pressable>
  );
}

interface SettingsSectionProps {
  title?: string;
  children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const { theme, isDark } = useTheme();

  const childrenArray = React.Children.toArray(children);

  return (
    <View style={styles.section}>
      {title ? (
        <ThemedText
          type="caption"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          {title}
        </ThemedText>
      ) : null}
      <View style={[
        styles.sectionContent,
        isDark ? CardStyles.dark : CardStyles.light,
      ]}>
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
        {childrenArray.map((child, index) => (
          <View key={index}>
            {child}
            {index < childrenArray.length - 1 ? (
              <View
                style={[
                  styles.divider,
                  { backgroundColor: theme.divider, marginLeft: Spacing.lg + 36 + Spacing.md },
                ]}
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 52,
  },
  containerMultiline: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  multilineHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  multilineValue: {
    marginTop: Spacing.xs,
    marginLeft: 32 + Spacing.md,
    lineHeight: 20,
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  label: {
    fontSize: 16,
    flex: 1,
    flexShrink: 1,
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexShrink: 1,
    maxWidth: "50%",
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
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});

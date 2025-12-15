import React from "react";
import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Message } from "@/store/types";
import { Spacing } from "@/constants/theme";

interface SystemMessageProps {
  message: Message;
}

export function SystemMessage({ message }: SystemMessageProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const getText = (): string => {
    const { systemAction, text } = message;

    if (text && !systemAction) {
      return text;
    }

    if (!systemAction) {
      return "";
    }

    switch (systemAction.action) {
      case "group_created":
        return t("system.groupCreated", { name: systemAction.actorName });
      case "member_added":
        return t("system.memberAdded", {
          actor: systemAction.actorName,
          target: systemAction.targetName,
        });
      case "member_removed":
        return t("system.memberRemoved", {
          actor: systemAction.actorName,
          target: systemAction.targetName,
        });
      case "member_left":
        return t("system.memberLeft", { name: systemAction.actorName });
      case "name_changed":
        return t("system.nameChanged", {
          actor: systemAction.actorName,
          newName: systemAction.newValue,
        });
      case "avatar_changed":
        return t("system.avatarChanged", { actor: systemAction.actorName });
      case "admin_added":
        return t("system.adminAdded", {
          actor: systemAction.actorName,
          target: systemAction.targetName,
        });
      case "admin_removed":
        return t("system.adminRemoved", {
          actor: systemAction.actorName,
          target: systemAction.targetName,
        });
      default:
        return "";
    }
  };

  const content = getText();

  if (!content) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.bubble, { backgroundColor: theme.divider }]}>
        <ThemedText style={[styles.text, { color: theme.textSecondary }]}>
          {content}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    maxWidth: "80%",
  },
  text: {
    fontSize: 13,
    textAlign: "center",
  },
});

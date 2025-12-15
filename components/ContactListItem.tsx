import React from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Contact } from "@/store/types";
import { Avatar } from "./Avatar";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface ContactListItemProps {
  contact: Contact;
  onPress: () => void;
}

export function ContactListItem({ contact, onPress }: ContactListItemProps) {
  const { theme } = useTheme();

  const handlePress = () => {
    console.log("[ContactListItem] Pressed:", contact.displayName);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Start chat with ${contact.displayName}`}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed
            ? theme.backgroundSecondary
            : theme.backgroundDefault,
          cursor: Platform.OS === "web" ? "pointer" : undefined,
        },
      ]}
    >
      <Avatar
        name={contact.displayName}
        color={contact.avatarColor}
        avatarUrl={contact.avatarUrl}
        size={Spacing.avatarMedium}
      />
      <View style={[styles.content, { pointerEvents: "none" }]}>
        <ThemedText type="body" style={styles.name}>
          {contact.displayName}
        </ThemedText>
        {contact.email ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {contact.email}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  name: {
    fontWeight: "500",
  },
});

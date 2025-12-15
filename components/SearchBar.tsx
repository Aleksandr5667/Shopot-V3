import React, { useRef, useEffect } from "react";
import { View, TextInput, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search",
  autoFocus = false,
  onFocus,
  onBlur,
}: SearchBarProps) {
  const { theme } = useTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  const handleClear = () => {
    onChangeText("");
    inputRef.current?.focus();
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundSecondary },
      ]}
    >
      <Feather name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {value.length > 0 ? (
        <Pressable onPress={handleClear} style={styles.clearButton}>
          <Feather name="x" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
  },
  clearButton: {
    padding: Spacing.xs,
  },
});

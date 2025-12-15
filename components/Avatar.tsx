import React, { memo } from "react";
import { View, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { getInitials } from "@/store/types";

interface AvatarProps {
  name: string;
  color: string;
  avatarUrl?: string | null;
  size?: number;
  isOnline?: boolean;
}

function OnlineIndicator({ size }: { size: number }) {
  return (
    <View
      style={[
        styles.onlineIndicator,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          bottom: 0,
          right: 0,
        },
      ]}
    />
  );
}

function AvatarComponent({ name, color, avatarUrl, size = 48, isOnline }: AvatarProps) {
  const initials = getInitials(name);
  const fontSize = size * 0.4;
  const indicatorSize = Math.max(10, size * 0.25);

  const renderOnlineIndicator = () => {
    if (!isOnline) return null;
    return <OnlineIndicator size={indicatorSize} />;
  };

  if (avatarUrl) {
    return (
      <View style={[styles.wrapper, { width: size, height: size }]}>
        <Image
          source={{ uri: avatarUrl }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          contentFit="cover"
          transition={200}
        />
        {renderOnlineIndicator()}
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      >
        <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
      </View>
      {renderOnlineIndicator()}
    </View>
  );
}

export const Avatar = memo(AvatarComponent);

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  image: {
    backgroundColor: "#E0E0E0",
  },
  onlineIndicator: {
    position: "absolute",
    backgroundColor: "#22C55E",
    borderWidth: 0,
  },
});

import React, { useState, useEffect, memo } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Image } from "expo-image";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Feather } from "@expo/vector-icons";
import { BorderRadius } from "@/constants/theme";
import { mediaCache } from "@/services/mediaCache";

interface VideoThumbnailProps {
  videoUri: string;
  style?: any;
  showPlayButton?: boolean;
}

const thumbnailCache: { [key: string]: string } = {};

export function linkThumbnailToUrl(localUri: string, remoteUrl: string): void {
  if (thumbnailCache[localUri]) {
    thumbnailCache[remoteUrl] = thumbnailCache[localUri];
  }
}

export function getThumbnailFromCache(uri: string): string | null {
  return thumbnailCache[uri] || null;
}

async function generateThumbnail(videoUri: string): Promise<string | null> {
  if (thumbnailCache[videoUri]) {
    return thumbnailCache[videoUri];
  }

  if (Platform.OS === "web") {
    return null;
  }

  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 1000,
      quality: 0.7,
    });
    thumbnailCache[videoUri] = uri;
    return uri;
  } catch (error) {
    console.warn("[VideoThumbnail] Error generating thumbnail:", error);
    return null;
  }
}

async function tryGenerateFromCachedVideo(remoteUrl: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  
  try {
    const cachedUri = await mediaCache.getCachedUri(remoteUrl);
    if (cachedUri) {
      const thumbnail = await generateThumbnail(cachedUri);
      if (thumbnail) {
        thumbnailCache[remoteUrl] = thumbnail;
        return thumbnail;
      }
    }
  } catch (error) {
    console.warn("[VideoThumbnail] Error generating from cached video:", error);
  }
  return null;
}

function VideoThumbnailComponent({ videoUri, style, showPlayButton = true }: VideoThumbnailProps) {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(thumbnailCache[videoUri] || null);
  const [isLoading, setIsLoading] = useState(!thumbnailCache[videoUri]);
  
  const isRemoteUrl = videoUri.startsWith("http://") || videoUri.startsWith("https://");

  useEffect(() => {
    if (thumbnailCache[videoUri]) {
      setThumbnailUri(thumbnailCache[videoUri]);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    if (isRemoteUrl) {
      tryGenerateFromCachedVideo(videoUri).then((uri) => {
        if (mounted) {
          setThumbnailUri(uri);
          setIsLoading(false);
        }
      });
    } else {
      generateThumbnail(videoUri).then((uri) => {
        if (mounted) {
          setThumbnailUri(uri);
          setIsLoading(false);
        }
      });
    }

    return () => {
      mounted = false;
    };
  }, [videoUri, isRemoteUrl]);

  return (
    <View style={[styles.container, style]}>
      {thumbnailUri ? (
        <Image
          source={{ uri: thumbnailUri }}
          style={[styles.thumbnail, style]}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.placeholder, style]}>
          {isLoading ? null : (
            <Feather name="video" size={40} color="#666" />
          )}
        </View>
      )}
      
      {showPlayButton && (
        <View style={styles.playButtonContainer}>
          <View style={styles.playButton}>
            <Feather name="play" size={28} color="#FFFFFF" />
          </View>
        </View>
      )}
    </View>
  );
}

export const VideoThumbnail = memo(VideoThumbnailComponent);

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
    borderRadius: BorderRadius.xs,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.xs,
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.xs,
  },
  playButtonContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 4,
  },
});

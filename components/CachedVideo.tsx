import React, { useState, useEffect } from "react";
import { View, StyleSheet, Platform, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { mediaCache, DownloadProgress } from "@/services/mediaCache";
import { useTheme } from "@/hooks/useTheme";
import { CircularProgress } from "./CircularProgress";
import { VideoThumbnail } from "./VideoThumbnail";
import { BorderRadius } from "@/constants/theme";

interface CachedVideoProps {
  source: { uri: string };
  style?: any;
  showPlayButton?: boolean;
  thumbnailUrl?: string;
}

export function CachedVideo({
  source,
  style,
  showPlayButton = true,
  thumbnailUrl,
}: CachedVideoProps) {
  const { theme } = useTheme();
  
  const quickCached = Platform.OS !== "web" ? mediaCache.getQuickCachedUri(source.uri) : null;
  
  const [cachedUri, setCachedUri] = useState<string | null>(quickCached);
  const [isLoading, setIsLoading] = useState(!quickCached && Platform.OS !== "web");
  const [downloadInfo, setDownloadInfo] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    if (quickCached) {
      setCachedUri(quickCached);
      setIsLoading(false);
      return;
    }
    
    let mounted = true;

    const cacheVideo = async () => {
      if (Platform.OS === "web") {
        setCachedUri(source.uri);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setDownloadInfo(null);
        
        const uri = await mediaCache.cacheMedia(source.uri, (info) => {
          if (mounted) {
            setDownloadInfo(info);
          }
        });
        
        if (mounted) {
          setCachedUri(uri);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("[CachedVideo] Cache error:", error);
        if (mounted) {
          setCachedUri(source.uri);
          setIsLoading(false);
        }
      }
    };

    cacheVideo();

    return () => {
      mounted = false;
    };
  }, [source.uri, quickCached]);

  if (isLoading) {
    const progressPercent = downloadInfo ? downloadInfo.progress * 100 : 0;
    const bytesWritten = downloadInfo?.bytesWritten || 0;
    const bytesTotal = downloadInfo?.bytesTotal || 0;
    
    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    
    const showBytesInfo = bytesTotal > 0;
    
    if (thumbnailUrl) {
      return (
        <View style={[styles.placeholder, style]}>
          <Image
            source={{ uri: thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={2}
          />
          <View style={styles.downloadOverlay}>
            <CircularProgress
              progress={progressPercent}
              size={64}
              strokeWidth={3}
              color="#FFFFFF"
              backgroundColor="rgba(255,255,255,0.25)"
              showPercentage={true}
              showIcon={true}
              iconName="download"
              hasError={false}
            />
            {showBytesInfo ? (
              <Text style={styles.bytesText}>
                {formatBytes(bytesWritten)} / {formatBytes(bytesTotal)}
              </Text>
            ) : null}
          </View>
        </View>
      );
    }
    
    return (
      <View style={[styles.placeholder, style, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={styles.downloadOverlay}>
          <CircularProgress
            progress={progressPercent}
            size={64}
            strokeWidth={3}
            color="#FFFFFF"
            backgroundColor="rgba(255,255,255,0.25)"
            showPercentage={true}
            showIcon={true}
            iconName="download"
            hasError={false}
          />
          {showBytesInfo ? (
            <Text style={styles.bytesText}>
              {formatBytes(bytesWritten)} / {formatBytes(bytesTotal)}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  if (!cachedUri) {
    return (
      <View style={[styles.placeholder, style, { backgroundColor: theme.backgroundSecondary }]}>
        <CircularProgress
          progress={0}
          size={48}
          color={theme.textSecondary}
          showPercentage={false}
          showIcon={true}
          iconName="video"
          hasError={false}
        />
      </View>
    );
  }

  return (
    <VideoThumbnail
      videoUri={cachedUri}
      style={style}
      showPlayButton={showPlayButton}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.xs,
  },
  downloadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.xs,
  },
  bytesText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
});

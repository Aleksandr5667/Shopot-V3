import React, { useState, useEffect } from "react";
import { View, StyleSheet, Platform, Text } from "react-native";
import { Image, ImageStyle } from "expo-image";
import { mediaCache, DownloadProgress } from "@/services/mediaCache";
import { useTheme } from "@/hooks/useTheme";
import { CircularProgress } from "./CircularProgress";

interface CachedImageProps {
  source: { uri: string };
  style?: ImageStyle | ImageStyle[];
  contentFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  placeholder?: string;
  thumbnailUrl?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function CachedImage({
  source,
  style,
  contentFit = "cover",
  placeholder,
  thumbnailUrl,
  onLoad,
  onError,
}: CachedImageProps) {
  const { theme } = useTheme();
  const [cachedUri, setCachedUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadInfo, setDownloadInfo] = useState<DownloadProgress | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const cacheImage = async () => {
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
        console.error("[CachedImage] Cache error:", error);
        if (mounted) {
          setCachedUri(source.uri);
          setIsLoading(false);
        }
      }
    };

    cacheImage();

    return () => {
      mounted = false;
    };
  }, [source.uri]);

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
        <View style={[styles.placeholder, style as any]}>
          <Image
            source={{ uri: thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit={contentFit}
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
      <View style={[styles.placeholder, style as any, { backgroundColor: theme.backgroundSecondary }]}>
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
      <View style={[styles.placeholder, style as any, { backgroundColor: theme.backgroundSecondary }]}>
        <CircularProgress
          progress={0}
          size={48}
          color={theme.textSecondary}
          showPercentage={false}
          showIcon={true}
          iconName="image"
          hasError={false}
        />
      </View>
    );
  }

  const handleImageError = async (e: any) => {
    console.warn("[CachedImage] Load error, falling back to original URL");
    if (!hasError && cachedUri !== source.uri) {
      setHasError(true);
      await mediaCache.removeCacheEntry(source.uri);
      setCachedUri(source.uri);
    }
    onError?.();
  };

  return (
    <Image
      source={{ uri: hasError ? source.uri : cachedUri }}
      style={style}
      contentFit={contentFit}
      placeholder={placeholder}
      onLoad={onLoad}
      onError={handleImageError}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
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
  },
  bytesText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
});

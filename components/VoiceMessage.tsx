import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { mediaCache, DownloadProgress } from "@/services/mediaCache";
import { useTranslation } from "react-i18next";
import { audioPlayerManager } from "@/services/audioPlayerManager";

interface VoiceMessageProps {
  uri: string;
  duration: number;
  isOwn: boolean;
  messageId?: string;
  isListened?: boolean;
  onListened?: (messageId: string) => void;
}

const WAVEFORM_BARS = 32;
const BAR_WIDTH = 3;
const BAR_GAP = 1.5;

interface WaveformBarProps {
  index: number;
  heightRatio: number;
  progress: SharedValue<number>;
  primaryColor: string;
  secondaryColor: string;
}

function WaveformBar({ index, heightRatio, progress, primaryColor, secondaryColor }: WaveformBarProps) {
  const barProgress = index / WAVEFORM_BARS;
  const maxHeight = 24;
  const minHeight = 4;
  const height = minHeight + (maxHeight - minHeight) * heightRatio;

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = barProgress <= progress.value;
    return {
      backgroundColor: isActive ? primaryColor : secondaryColor,
    };
  });

  return (
    <Animated.View
      style={[
        styles.waveformBar,
        { height },
        animatedStyle,
      ]}
    />
  );
}

export function VoiceMessage({ uri, duration, isOwn, messageId, isListened: initialListened = false, onListened }: VoiceMessageProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [hasError, setHasError] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasBeenListened, setHasBeenListened] = useState(initialListened);
  
  const playerIdRef = useRef<string>(audioPlayerManager.generatePlayerId());
  const hasMarkedListenedRef = useRef(false);
  const shouldAutoPlayRef = useRef(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    setHasBeenListened(initialListened);
    if (initialListened) {
      hasMarkedListenedRef.current = true;
    }
  }, [initialListened]);

  const player = useAudioPlayer(audioUri ?? undefined);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    console.log("[VoiceMessage] Player/status changed", { 
      hasPlayer: !!player, 
      audioUri: audioUri?.substring(0, 50),
      isLoaded: status?.isLoaded,
      duration: status?.duration,
      shouldAutoPlay: shouldAutoPlayRef.current
    });
  }, [player, status, audioUri]);

  useEffect(() => {
    if (player) {
      player.loop = false;
    }
  }, [player]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    
    let mounted = true;
    
    const preloadAudio = async () => {
      try {
        const cached = await mediaCache.getCachedUri(uri);
        if (cached && mounted) {
          setAudioUri(cached);
        }
      } catch (error) {
        // Silent fail for preload
      }
    };
    
    preloadAudio();
    
    return () => {
      mounted = false;
    };
  }, [uri]);

  const waveformHeights = useMemo(() => {
    return Array.from({ length: WAVEFORM_BARS }, (_, i) => {
      const normalizedPos = i / WAVEFORM_BARS;
      const centerFactor = 1 - Math.abs(normalizedPos - 0.5) * 1.2;
      const wave1 = Math.sin(normalizedPos * Math.PI * 3) * 0.25;
      const wave2 = Math.sin(normalizedPos * Math.PI * 5 + 0.8) * 0.15;
      const wave3 = Math.cos(normalizedPos * Math.PI * 7) * 0.1;
      const seed = (i * 17 + 13) % 23;
      const randomness = (seed / 23) * 0.2;
      const base = 0.3 + centerFactor * 0.35 + wave1 + wave2 + wave3 + randomness;
      return Math.max(0.2, Math.min(1, base));
    });
  }, []);

  useEffect(() => {
    if (!status) return;
    
    if (status.isLoaded && status.duration > 0) {
      const currentProgress = status.currentTime / status.duration;
      progress.value = currentProgress;
      
      if (status.playing) {
        setIsPlaying(true);
        
        if (!hasMarkedListenedRef.current && !hasBeenListened) {
          hasMarkedListenedRef.current = true;
          setHasBeenListened(true);
          if (messageId && onListened) {
            onListened(messageId);
          }
        }
      }
      
      const hasReachedEnd = status.currentTime >= status.duration - 0.15;
      
      if (!status.playing && isPlaying) {
        setIsPlaying(false);
        
        if (hasReachedEnd) {
          progress.value = 0;
          try {
            player.seekTo(0);
          } catch (e) {}
        }
        
        audioPlayerManager.unregisterPlayer(playerIdRef.current);
      }
    }
  }, [status?.currentTime, status?.duration, status?.playing, status?.isLoaded]);

  useEffect(() => {
    if (!audioPlayerManager.isCurrentPlayer(playerIdRef.current) && isPlaying) {
      setIsPlaying(false);
      progress.value = 0;
    }
  }, [status?.playing]);

  useEffect(() => {
    const playerId = playerIdRef.current;
    return () => {
      audioPlayerManager.unregisterPlayer(playerId);
    };
  }, []);

  const handlePress = useCallback(async () => {
    console.log("[VoiceMessage] handlePress called", { platform: Platform.OS, isDownloading, hasError, audioUri: !!audioUri, isLoaded: status?.isLoaded });
    
    if (Platform.OS === "web") {
      console.log("[VoiceMessage] Blocked on web");
      return;
    }
    if (isDownloading) {
      console.log("[VoiceMessage] Already downloading");
      return;
    }
    
    if (hasError) {
      setHasError(false);
    }

    if (audioUri && status?.isLoaded) {
      if (isPlaying) {
        try {
          player.pause();
          setIsPlaying(false);
          audioPlayerManager.unregisterPlayer(playerIdRef.current);
        } catch (e) {
          setIsPlaying(false);
        }
      } else {
        try {
          audioPlayerManager.stopCurrent();
          playerIdRef.current = audioPlayerManager.generatePlayerId();
          audioPlayerManager.registerPlayer(player, playerIdRef.current, () => {
            setIsPlaying(false);
          });
          
          if (status.currentTime >= status.duration - 0.15) {
            player.seekTo(0);
          }
          
          player.play();
          setIsPlaying(true);
        } catch (error: any) {
          setIsPlaying(false);
          if (error?.message?.includes("Session") || error?.message?.includes("dead")) {
            setAudioUri(null);
          }
        }
      }
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(null);
    
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch (e) {}

    try {
      let cachedUri = await mediaCache.getCachedUri(uri);
      
      if (!cachedUri) {
        cachedUri = await mediaCache.cacheMedia(uri, (info) => {
          setDownloadProgress(info);
        });
      }
      
      if (cachedUri) {
        console.log("[VoiceMessage] Got cached URI, setting autoplay flag");
        playerIdRef.current = audioPlayerManager.generatePlayerId();
        shouldAutoPlayRef.current = true;
        setAudioUri(cachedUri);
      } else {
        console.log("[VoiceMessage] No cached URI, setting error");
        setHasError(true);
      }
    } catch (error) {
      console.warn("[VoiceMessage] Download failed:", error);
      setHasError(true);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [uri, audioUri, status, player, isPlaying, isDownloading, hasError]);

  useEffect(() => {
    console.log("[VoiceMessage] Auto-play effect", { audioUri: !!audioUri, isLoaded: status?.isLoaded, shouldAutoPlay: shouldAutoPlayRef.current, isPlaying });
    
    if (!audioUri || !status || !status.isLoaded) return;
    if (!shouldAutoPlayRef.current) return;
    if (isPlaying) return;
    
    console.log("[VoiceMessage] Starting auto-play");
    shouldAutoPlayRef.current = false;
    
    audioPlayerManager.stopCurrent();
    playerIdRef.current = audioPlayerManager.generatePlayerId();
    audioPlayerManager.registerPlayer(player, playerIdRef.current, () => {
      setIsPlaying(false);
    });
    
    try {
      player.play();
      setIsPlaying(true);
    } catch (e) {
      setIsPlaying(false);
    }
  }, [audioUri, status, isPlaying, player]);

  const playButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(isPlaying ? 0.95 : 1, { duration: 150 }) }],
  }));

  const unlistenedBlue = "#007AFF";
  const primaryColor = hasError 
    ? "#FF6B6B" 
    : isOwn 
      ? theme.primary 
      : !hasBeenListened 
        ? unlistenedBlue 
        : "#8E8E93";
  const secondaryColor = hasError 
    ? "#FF6B6B40" 
    : isOwn 
      ? `${theme.primary}40` 
      : !hasBeenListened 
        ? `${unlistenedBlue}35`
        : "#C7C7CC";

  const spinValue = useSharedValue(0);
  
  useEffect(() => {
    if (isDownloading) {
      spinValue.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      spinValue.value = 0;
    }
  }, [isDownloading]);

  const spinAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value}deg` }],
  }));

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderPlayButtonContent = () => {
    if (isDownloading) {
      return (
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.spinnerRing, spinAnimatedStyle]}>
            <View style={styles.spinnerArc} />
          </Animated.View>
          <View style={styles.downloadIconWrapper}>
            <Feather
              name="download"
              size={14}
              color="#FFFFFF"
            />
          </View>
        </View>
      );
    }
    
    return (
      <Feather
        name={hasError ? "alert-circle" : isPlaying ? "pause" : "play"}
        size={20}
        color="#FFFFFF"
        style={isPlaying || hasError ? undefined : styles.playIcon}
      />
    );
  };
  
  const renderDownloadInfo = () => {
    if (!isDownloading || !downloadProgress || downloadProgress.bytesTotal === 0) return null;
    
    return (
      <View style={styles.downloadInfoContainer}>
        <View style={styles.downloadProgressBar}>
          <Animated.View 
            style={[
              styles.downloadProgressFill, 
              { 
                width: `${downloadProgress.progress * 100}%`,
                backgroundColor: primaryColor,
              }
            ]} 
          />
        </View>
      </View>
    );
  };

  const displayDuration = status?.duration > 0 ? status.duration : duration;
  const currentPosition = status?.currentTime || 0;

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} disabled={hasError && isDownloading}>
        <Animated.View
          style={[
            styles.playButton,
            { backgroundColor: primaryColor },
            playButtonAnimatedStyle,
          ]}
        >
          {renderPlayButtonContent()}
        </Animated.View>
      </Pressable>

      <View style={styles.contentContainer}>
        {isDownloading && downloadProgress && downloadProgress.bytesTotal > 0 ? (
          renderDownloadInfo()
        ) : hasError ? (
          <View style={styles.errorContainer}>
            <ThemedText
              type="caption"
              style={[styles.errorText, { color: theme.textSecondary }]}
            >
              {t("chats.audioUnavailable")}
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.waveformWrapper}>
              {waveformHeights.map((heightRatio, index) => (
                <WaveformBar
                  key={index}
                  index={index}
                  heightRatio={heightRatio}
                  progress={progress}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                />
              ))}
            </View>

            <View style={styles.infoRow}>
              <ThemedText
                type="caption"
                style={[styles.duration, { color: theme.textSecondary }]}
              >
                {isPlaying ? formatDuration(currentPosition) : formatDuration(displayDuration)}
              </ThemedText>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 200,
    paddingVertical: Spacing.xs,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  playIcon: {
    marginLeft: 3,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  waveformWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    gap: BAR_GAP,
  },
  waveformBar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  duration: {
    fontSize: 12,
    fontWeight: "500",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  spinnerRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
    borderTopColor: "#FFFFFF",
    position: "absolute",
  },
  spinnerArc: {
    display: "none",
  },
  downloadIconWrapper: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  downloadInfoContainer: {
    flex: 1,
    justifyContent: "center",
  },
  downloadProgressBar: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  downloadProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  errorText: {
    fontSize: 13,
    fontStyle: "italic",
  },
});

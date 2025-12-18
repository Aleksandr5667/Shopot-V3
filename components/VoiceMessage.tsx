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

const WAVEFORM_BARS = 28;
const BAR_WIDTH = 3;
const BAR_GAP = 2;

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VoiceMessage({ uri, duration, isOwn, messageId, isListened: initialListened = false, onListened }: VoiceMessageProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<DownloadProgress | null>(null);
  const [hasError, setHasError] = useState(false);
  const [cachedUri, setCachedUri] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [pendingPlay, setPendingPlay] = useState(false);
  const [hasBeenListened, setHasBeenListened] = useState(initialListened);
  const wasLoadedRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const hasStartedPlayingRef = useRef(false);
  const progress = useSharedValue(0);

  // Sync with prop when service finishes loading listened state
  useEffect(() => {
    setHasBeenListened(initialListened);
  }, [initialListened]);

  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (player) {
      player.loop = false;
    }
  }, [player]);

  // Preload audio in background for faster playback
  const isPreloadingRef = useRef(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (cachedUri) return; // Already cached
    if (isPreloadingRef.current) return; // Already preloading
    
    let mounted = true;
    isPreloadingRef.current = true;
    
    const preloadAudio = async () => {
      try {
        // Check if already cached
        const existingCached = await mediaCache.getCachedUri(uri);
        if (existingCached && mounted) {
          setCachedUri(existingCached);
          return;
        }
        // Preload in background (without showing loading UI)
        const cached = await mediaCache.cacheMedia(uri);
        if (mounted) {
          setCachedUri(cached);
        }
      } catch (error) {
        // Silently fail - will retry when user presses play
      } finally {
        isPreloadingRef.current = false;
      }
    };
    
    preloadAudio();
    
    return () => {
      mounted = false;
    };
  }, [uri, cachedUri]);

  const waveformHeights = useMemo(() => {
    return Array.from({ length: WAVEFORM_BARS }, (_, i) => {
      const normalizedPos = i / WAVEFORM_BARS;
      const wave1 = Math.sin(normalizedPos * Math.PI * 2) * 0.3;
      const wave2 = Math.sin(normalizedPos * Math.PI * 4 + 0.5) * 0.2;
      const wave3 = Math.cos(normalizedPos * Math.PI * 3) * 0.15;
      const randomness = (Math.sin(i * 13.7) * 0.5 + 0.5) * 0.35;
      const base = 0.25 + wave1 + wave2 + wave3 + randomness;
      return Math.max(0.15, Math.min(1, base));
    });
  }, []);

  useEffect(() => {
    const isLoaded = status?.isLoaded ?? false;
    
    if (pendingPlay && isLoaded && !wasLoadedRef.current) {
      setPendingPlay(false);
      setTimeout(() => {
        try {
          audioPlayerManager.registerPlayer(player);
          hasFinishedRef.current = false;
          player.play();
        } catch (error) {
          console.warn("[VoiceMessage] Play failed:", error);
        }
      }, 50);
    }
    
    wasLoadedRef.current = isLoaded;
  }, [status?.isLoaded, pendingPlay, player]);

  useEffect(() => {
    const currentPlayer = player;
    return () => {
      if (currentPlayer) {
        audioPlayerManager.unregisterPlayer(currentPlayer);
      }
    };
  }, [player]);

  useEffect(() => {
    if (status && status.isLoaded && status.duration > 0) {
      const currentProgress = status.currentTime / status.duration;
      progress.value = currentProgress;

      // Track when playing starts
      if (status.playing && !hasStartedPlayingRef.current) {
        hasStartedPlayingRef.current = true;
        // Mark as listened when playback starts
        if (!hasBeenListened) {
          setHasBeenListened(true);
          if (messageId && onListened) {
            onListened(messageId);
          }
        }
      }

      // Reset flag when playing starts fresh
      if (status.playing) {
        hasFinishedRef.current = false;
      }

      // Detect playback end - check if we were playing but now stopped near the end
      const hasReachedEnd = status.currentTime >= status.duration - 0.15;
      const justStopped = hasStartedPlayingRef.current && !status.playing;
      
      if (hasReachedEnd && justStopped && !hasFinishedRef.current) {
        hasFinishedRef.current = true;
        hasStartedPlayingRef.current = false;
        progress.value = 0;
        
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          try {
            player.seekTo(0);
          } catch (error) {
            console.warn("[VoiceMessage] SeekTo failed:", error);
          }
          audioPlayerManager.unregisterPlayer(player);
        }, 50);
      }
    }
  }, [status?.currentTime, status?.duration, status?.playing, status?.isLoaded, progress, player, hasBeenListened, messageId, onListened]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const loadAndPlay = useCallback(async () => {
    if (Platform.OS === "web") return;

    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (audioSource && status?.isLoaded) {
        try {
          if (status.playing) {
            player.pause();
            audioPlayerManager.unregisterPlayer(player);
          } else {
            audioPlayerManager.stopCurrent();
            audioPlayerManager.registerPlayer(player);
            hasFinishedRef.current = false;
            if (status.currentTime >= status.duration - 0.1) {
              player.seekTo(0);
            }
            player.play();
          }
        } catch (error) {
          console.warn("[VoiceMessage] Playback control failed:", error);
        }
        return;
      }

      audioPlayerManager.stopCurrent();

      let audioUri = cachedUri;
      
      if (!audioUri) {
        const existingCached = await mediaCache.getCachedUri(uri);
        if (existingCached) {
          console.log("[VoiceMessage] Found in cache:", existingCached);
          audioUri = existingCached;
          setCachedUri(audioUri);
        }
      }
      
      if (!audioUri) {
        setIsLoading(true);
        setDownloadInfo(null);
        console.log("[VoiceMessage] Downloading audio from:", uri);
        audioUri = await mediaCache.cacheMedia(uri, (info) => {
          setDownloadInfo(info);
        });
        setCachedUri(audioUri);
        setIsLoading(false);
      }

      console.log("[VoiceMessage] Playing from:", audioUri);
      wasLoadedRef.current = false;
      setAudioSource(audioUri);
      setPendingPlay(true);
    } catch (error: any) {
      if (__DEV__) {
        console.warn("[VoiceMessage] Audio unavailable:", uri);
      }
      setHasError(true);
      setIsLoading(false);
    }
  }, [uri, cachedUri, audioSource, status, player]);

  const playButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(status?.playing ? 0.95 : 1, { duration: 150 }) }],
  }));

  const primaryColor = hasError ? "#FF6B6B" : isOwn ? theme.primary : "#7C7C7C";
  const secondaryColor = hasError ? "#FF6B6B40" : isOwn ? `${theme.primary}40` : "#D0D0D0";

  const spinValue = useSharedValue(0);
  
  useEffect(() => {
    if (isLoading) {
      spinValue.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      spinValue.value = 0;
    }
  }, [isLoading, spinValue]);

  const spinAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value}deg` }],
  }));

  const renderPlayButtonContent = () => {
    if (isLoading) {
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
        name={hasError ? "alert-circle" : status?.playing ? "pause" : "play"}
        size={20}
        color="#FFFFFF"
        style={status?.playing || hasError ? undefined : styles.playIcon}
      />
    );
  };
  
  const renderDownloadInfo = () => {
    if (!isLoading || !downloadInfo || downloadInfo.bytesTotal === 0) return null;
    
    return (
      <View style={styles.downloadInfoContainer}>
        <View style={styles.downloadProgressBar}>
          <Animated.View 
            style={[
              styles.downloadProgressFill, 
              { 
                width: `${downloadInfo.progress * 100}%`,
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

  // Background color for unlistened incoming voice messages
  const showUnlistenedBackground = !isOwn && !hasBeenListened;
  const unlistenedBgColor = `${theme.primary}15`; // 15% opacity

  return (
    <View style={[
      styles.container,
      showUnlistenedBackground ? { backgroundColor: unlistenedBgColor, borderRadius: 12, marginHorizontal: -8, paddingHorizontal: 8 } : null,
    ]}>
      <Pressable onPress={hasError || isLoading ? undefined : loadAndPlay}>
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
        {isLoading && downloadInfo && downloadInfo.bytesTotal > 0 ? (
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
                {status?.playing ? formatDuration(currentPosition) : formatDuration(displayDuration)}
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
  downloadText: {
    fontSize: 11,
    fontWeight: "500",
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

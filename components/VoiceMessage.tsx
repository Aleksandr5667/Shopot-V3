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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const wasLoadedRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const hasStartedPlayingRef = useRef(false);
  const playerIdRef = useRef<string>(audioPlayerManager.generatePlayerId());
  const lastStatusTimeRef = useRef(0);
  const progress = useSharedValue(0);

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

  useEffect(() => {
    if (player && audioSource) {
      player.loop = false;
    }
  }, [player, audioSource]);

  const isPreloadingRef = useRef(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (cachedUri) return;
    if (isPreloadingRef.current) return;
    
    let mounted = true;
    isPreloadingRef.current = true;
    
    const preloadAudio = async () => {
      try {
        const existingCached = await mediaCache.getCachedUri(uri);
        if (existingCached && mounted) {
          setCachedUri(existingCached);
          return;
        }
        const cached = await mediaCache.cacheMedia(uri);
        if (mounted) {
          setCachedUri(cached);
        }
      } catch (error) {
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
    const isLoaded = status?.isLoaded ?? false;
    
    if (pendingPlay && isLoaded && !wasLoadedRef.current) {
      setPendingPlay(false);
      player.loop = false;
      audioPlayerManager.stopCurrent();
      audioPlayerManager.registerPlayer(player, playerIdRef.current, () => {
        setIsPlaying(false);
      });
      hasFinishedRef.current = false;
      hasStartedPlayingRef.current = false;
      try {
        player.play();
        setIsPlaying(true);
      } catch (error) {
        setIsPlaying(false);
      }
    }
    
    wasLoadedRef.current = isLoaded;
  }, [status?.isLoaded, pendingPlay, player]);

  useEffect(() => {
    const playerId = playerIdRef.current;
    return () => {
      audioPlayerManager.unregisterPlayer(playerId);
    };
  }, []);

  useEffect(() => {
    if (!audioPlayerManager.isCurrentPlayer(playerIdRef.current) && isPlaying) {
      setIsPlaying(false);
      progress.value = 0;
    }
  }, [status?.playing, isPlaying, progress]);

  useEffect(() => {
    if (status && status.isLoaded && status.duration > 0) {
      const currentProgress = status.currentTime / status.duration;
      progress.value = currentProgress;

      if (status.playing && !hasStartedPlayingRef.current) {
        hasStartedPlayingRef.current = true;
        setIsPlaying(true);
        if (!hasBeenListened) {
          setHasBeenListened(true);
          if (messageId && onListened) {
            onListened(messageId);
          }
        }
      }

      if (status.playing) {
        hasFinishedRef.current = false;
        lastStatusTimeRef.current = status.currentTime;
      }

      const hasReachedEnd = status.currentTime >= status.duration - 0.1;
      const justStopped = !status.playing && hasStartedPlayingRef.current;
      
      if (hasReachedEnd && justStopped && !hasFinishedRef.current) {
        hasFinishedRef.current = true;
        hasStartedPlayingRef.current = false;
        setIsPlaying(false);
        progress.value = 0;
        
        try {
          player.seekTo(0);
          player.pause();
        } catch (error) {
        }
        audioPlayerManager.unregisterPlayer(playerIdRef.current);
      }

      if (!status.playing && hasStartedPlayingRef.current && !hasReachedEnd) {
        const timeSinceLastUpdate = Math.abs(status.currentTime - lastStatusTimeRef.current);
        if (timeSinceLastUpdate < 0.01 && status.currentTime > 0.5) {
          hasFinishedRef.current = true;
          hasStartedPlayingRef.current = false;
          setIsPlaying(false);
          progress.value = 0;
          try {
            player.seekTo(0);
            player.pause();
          } catch (error) {
          }
          audioPlayerManager.unregisterPlayer(playerIdRef.current);
        }
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

    if (isLoadingAudio || pendingPlay) {
      return;
    }

    // If audio is loaded and ready, handle play/pause
    if (audioSource && status?.isLoaded) {
      try {
        if (isPlaying) {
          player.pause();
          setIsPlaying(false);
          audioPlayerManager.unregisterPlayer(playerIdRef.current);
        } else {
          audioPlayerManager.stopCurrent();
          player.loop = false;
          audioPlayerManager.registerPlayer(player, playerIdRef.current, () => {
            setIsPlaying(false);
          });
          hasFinishedRef.current = false;
          hasStartedPlayingRef.current = false;
          if (status.currentTime >= status.duration - 0.1) {
            player.seekTo(0);
          }
          player.play();
          setIsPlaying(true);
        }
      } catch (error: any) {
        setIsPlaying(false);
        if (error?.message?.includes("Session") || error?.message?.includes("Server was dead")) {
          setAudioSource(null);
          setPendingPlay(false);
          wasLoadedRef.current = false;
        }
      }
      return;
    }

    if (audioSource && !status?.isLoaded) {
      setPendingPlay(true);
      return;
    }

    // Start loading audio
    setIsLoadingAudio(true);
    audioPlayerManager.stopCurrent();

    setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).catch(() => {});

    try {
      let audioUri = cachedUri;
      
      if (!audioUri) {
        const existingCached = await mediaCache.getCachedUri(uri);
        if (existingCached) {
          audioUri = existingCached;
          setCachedUri(audioUri);
        }
      }
      
      if (!audioUri) {
        setIsLoading(true);
        setDownloadInfo(null);
        audioUri = await mediaCache.cacheMedia(uri, (info) => {
          setDownloadInfo(info);
        });
        setCachedUri(audioUri);
        setIsLoading(false);
      }
      playerIdRef.current = audioPlayerManager.generatePlayerId();
      wasLoadedRef.current = false;
      hasFinishedRef.current = false;
      hasStartedPlayingRef.current = false;
      setAudioSource(audioUri);
      setPendingPlay(true);
    } catch (error: any) {
      setHasError(true);
      setIsLoading(false);
    } finally {
      setIsLoadingAudio(false);
    }
  }, [uri, cachedUri, audioSource, status, player, isPlaying, isLoadingAudio, pendingPlay]);

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
        name={hasError ? "alert-circle" : isPlaying ? "pause" : "play"}
        size={20}
        color="#FFFFFF"
        style={isPlaying || hasError ? undefined : styles.playIcon}
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

  return (
    <View style={styles.container}>
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

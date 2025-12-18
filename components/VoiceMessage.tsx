import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
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
import { useTranslation } from "react-i18next";
import { useVoicePlayback } from "@/hooks/useVoicePlayback";

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
  
  const [hasBeenListened, setHasBeenListened] = useState(initialListened);
  const hasMarkedListenedRef = useRef(false);
  const progress = useSharedValue(0);

  const { 
    state, 
    currentTime, 
    audioDuration, 
    togglePlayback, 
    hasError,
    isLoading 
  } = useVoicePlayback(uri);

  const isPlaying = state === 'playing';
  const isDownloading = isLoading;

  useEffect(() => {
    setHasBeenListened(initialListened);
    if (initialListened) {
      hasMarkedListenedRef.current = true;
    }
  }, [initialListened]);

  useEffect(() => {
    if (isPlaying && !hasMarkedListenedRef.current && !hasBeenListened) {
      hasMarkedListenedRef.current = true;
      setHasBeenListened(true);
      if (messageId && onListened) {
        onListened(messageId);
      }
    }
  }, [isPlaying, hasBeenListened, messageId, onListened]);

  useEffect(() => {
    const totalDur = audioDuration > 0 ? audioDuration : duration;
    if (totalDur > 0) {
      progress.value = currentTime / totalDur;
    }
    if (state === 'idle' && currentTime === 0) {
      progress.value = 0;
    }
  }, [currentTime, audioDuration, duration, state]);

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

  const handlePress = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (isLoading) return;
    await togglePlayback();
  }, [togglePlayback, isLoading]);

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
  
  const displayDuration = audioDuration > 0 ? audioDuration : duration;
  const currentPosition = currentTime;

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
        {hasError ? (
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
